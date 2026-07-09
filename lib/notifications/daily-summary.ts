import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import Connection, { type IConnection } from "@/models/Connection";
import NotificationSetting from "@/models/NotificationSetting";
import DailySubmission, {
  type IDailySubmission,
  type ISubmissionAttachment,
} from "@/models/DailySubmission";
import { GoogleReconnectError, getValidAccessToken } from "@/lib/google/oauth";
import { getDailySnapshot as gscDailySnapshot } from "@/lib/google/search-console";
import { getDailySnapshot as gaDailySnapshot } from "@/lib/google/analytics";
import {
  fetchData as windsorFetchData,
  getSourceDef as windsorSourceDef,
  resolveFields as windsorResolveFields,
  stripSourcePrefix as windsorStripPrefix,
  formatWindsorValue,
} from "@/lib/windsor/client";
import { summarize, type SummaryAttachment } from "@/lib/anthropic";
import { sendEmail } from "@/lib/email";

/**
 * Core daily-summary orchestrator. Pulls the latest complete day from each
 * enabled connector, asks Claude to write a digest, and emails it via Resend.
 * Server-only. Designed to run within a single Vercel function (≤60s).
 */

const TYPE = "daily-summary" as const;
type ConnectionLean = IConnection & { _id: unknown };

export interface RunResult {
  status: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  "google-search-console": "Google Search Console",
  "google-analytics": "Google Analytics",
  windsor: "Windsor.ai",
};

function fmtDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s}s`;
}

export async function runDailySummary(
  projectId: string,
  opts: { force?: boolean } = {}
): Promise<RunResult> {
  await connectDB();

  const setting = await NotificationSetting.findOne({ projectId, type: TYPE });
  if (!setting) return { status: "skipped: not configured" };

  async function finish(status: string, sent = false): Promise<RunResult> {
    if (setting) {
      setting.lastStatus = status;
      if (sent) setting.lastSentAt = new Date();
      await setting.save();
    }
    return { status };
  }

  if (!setting.enabled && !opts.force) return finish("skipped: disabled");
  if (setting.recipients.length === 0) return finish("skipped: no recipients");
  if (setting.enabledConnectors.length === 0)
    return finish("skipped: no connectors");

  const project = await Project.findById(projectId)
    .select("name domain")
    .lean<{ name: string; domain: string } | null>();
  if (!project) return finish("skipped: project not found");

  const blocks: string[] = [];
  let hasData = false;

  for (const provider of setting.enabledConnectors) {
    const label = PROVIDER_LABELS[provider] ?? provider;
    try {
      const conn = await Connection.findOne({
        projectId,
        provider,
      }).lean<ConnectionLean | null>();

      if (!conn) {
        blocks.push(`## ${label}\nNot connected.`);
        continue;
      }

      if (provider === "windsor") {
        const selections = conn.windsorAccounts ?? [];
        if (selections.length === 0) {
          blocks.push(`## ${label}\nNo accounts selected.`);
          continue;
        }
        // One metric block per selected Windsor account.
        for (const selection of selections) {
          const def = windsorSourceDef(selection.source);
          if (!def) continue;
          const accountLabel = windsorStripPrefix(
            selection.source,
            selection.accountName ?? selection.accountId
          );
          const fields = windsorResolveFields(def, selection.fields);
          const rows = await windsorFetchData({
            source: def.slug,
            fields,
            accounts: [selection.accountId],
            datePreset: "last_1d",
          });
          const totals = rows[0];
          if (!totals) {
            blocks.push(
              `## ${label} — ${def.label} · ${accountLabel}\nNo recent data available.`
            );
            continue;
          }
          hasData = true;
          const lines = def.metrics
            .filter((m) => fields.includes(m.id))
            .map(
              (m) =>
                `- ${m.label}: ${formatWindsorValue(totals[m.id], m.format)}`
            )
            .join("\n");
          blocks.push(
            `## ${label} — ${def.label} · ${accountLabel} — yesterday\n${lines}`
          );
        }
        continue;
      }

      const accessToken = await getValidAccessToken(conn);

      if (provider === "google-search-console") {
        if (!conn.siteUrl) {
          blocks.push(`## ${label}\nNo property selected.`);
          continue;
        }
        const snap = await gscDailySnapshot(accessToken, conn.siteUrl);
        if (!snap.date) {
          blocks.push(`## ${label}\nNo recent data available.`);
          continue;
        }
        hasData = true;
        const queries = snap.topQueries
          .map(
            (q) =>
              `  - "${q.keys?.[0] ?? ""}": ${q.clicks} clicks, ${q.impressions} impressions`
          )
          .join("\n");
        blocks.push(
          `## ${label} (${conn.siteUrl}) — ${snap.date}\n` +
            `- Clicks: ${snap.totals.clicks}\n` +
            `- Impressions: ${snap.totals.impressions}\n` +
            `- CTR: ${(snap.totals.ctr * 100).toFixed(2)}%\n` +
            `- Avg position: ${snap.totals.position.toFixed(1)}\n` +
            (queries ? `- Top queries:\n${queries}` : "")
        );
      } else if (provider === "google-analytics") {
        if (!conn.propertyId) {
          blocks.push(`## ${label}\nNo property selected.`);
          continue;
        }
        const snap = await gaDailySnapshot(accessToken, conn.propertyId);
        hasData = true;
        const pages = snap.topPages
          .map((p) => `  - ${p.dimension}: ${p.metric} views`)
          .join("\n");
        const channels = snap.topChannels
          .map((c) => `  - ${c.dimension}: ${c.metric} sessions`)
          .join("\n");
        blocks.push(
          `## ${label} — yesterday\n` +
            `- Sessions: ${snap.totals.sessions}\n` +
            `- Total users: ${snap.totals.totalUsers}\n` +
            `- Page views: ${snap.totals.screenPageViews}\n` +
            `- Avg session duration: ${fmtDuration(snap.totals.averageSessionDuration)}\n` +
            (pages ? `- Top pages:\n${pages}\n` : "") +
            (channels ? `- Top channels:\n${channels}` : "")
        );
      }
    } catch (err) {
      const note =
        err instanceof GoogleReconnectError
          ? "Authorization expired — needs reconnect."
          : "Data temporarily unavailable.";
      blocks.push(`## ${label}\n${note}`);
    }
  }

  // Fold in the previous day's user submissions when enabled.
  const submissionAttachments: SummaryAttachment[] = [];
  let submissionLinks: ISubmissionAttachment[] = [];
  if (setting.includeDailySubmission) {
    const gathered = await gatherSubmissions(projectId);
    if (gathered.block) {
      blocks.push(gathered.block);
      submissionAttachments.push(...gathered.attachments);
      submissionLinks = gathered.links;
      hasData = true; // updates are worth sending even without connector data
    }
  }

  if (!hasData) return finish("skipped: no data");

  const prompt = buildPrompt(project.name, project.domain, blocks);
  const digest = await summarize(prompt, { attachments: submissionAttachments });
  const html = renderEmail(project.name, digest, submissionLinks);

  await sendEmail({
    to: setting.recipients,
    subject: `Daily SEO summary — ${project.name}`,
    html,
  });

  return finish("sent", true);
}

const SUBMISSION_TEXT_TYPES = ["text/", "application/json"];
const MAX_INLINE_TEXT = 4000;

/**
 * Collect yesterday's submissions into a prompt block plus the file references
 * the summary needs: images/PDFs are handed to the model to read, small text
 * files are inlined, and every file is linked in the email.
 */
async function gatherSubmissions(projectId: string): Promise<{
  block: string | null;
  attachments: SummaryAttachment[];
  links: ISubmissionAttachment[];
}> {
  // Previous calendar day in UTC (matches the connectors' "yesterday" framing).
  const now = new Date();
  const startToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);

  const submissions = await DailySubmission.find({
    projectId,
    createdAt: { $gte: startYesterday, $lt: startToday },
  })
    .sort({ createdAt: 1 })
    .lean<IDailySubmission[]>();

  if (submissions.length === 0) {
    return { block: null, attachments: [], links: [] };
  }

  const attachments: SummaryAttachment[] = [];
  const links: ISubmissionAttachment[] = [];
  const entries: string[] = [];

  for (const sub of submissions) {
    const who = sub.submittedByName || sub.submittedBy;
    const when = new Date(sub.createdAt).toISOString().slice(11, 16);
    let entry = `**${who}** (${when})\n${sub.body}`;

    for (const file of sub.attachments ?? []) {
      links.push(file);
      const type = file.contentType || "";
      if (type.startsWith("image/")) {
        attachments.push({ kind: "image", url: file.url });
      } else if (type === "application/pdf") {
        attachments.push({ kind: "document", url: file.url });
      } else if (SUBMISSION_TEXT_TYPES.some((t) => type.startsWith(t))) {
        const text = await fetchTextSafe(file.url);
        if (text) {
          entry += `\n\nAttached file "${file.filename}":\n${text.slice(0, MAX_INLINE_TEXT)}`;
        }
      }
    }
    entries.push(entry);
  }

  const block = `## Team updates — yesterday\n${entries.join("\n\n")}`;
  return { block, attachments, links };
}

async function fetchTextSafe(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function buildPrompt(
  projectName: string,
  domain: string,
  blocks: string[]
): string {
  return [
    `You are an SEO analyst writing a concise daily performance email for the project "${projectName}" (${domain}).`,
    `Below is the latest available data from the connected sources. Note that Google Search Console data lags ~2-3 days, so its date may differ from Analytics (yesterday).`,
    ``,
    blocks.join("\n\n"),
    ``,
    `Write a brief, scannable summary an account manager can read in under a minute:`,
    `- Start with a one-sentence headline of how the site is doing.`,
    `- A short section per data source with the key numbers and any notable movement.`,
    `- If a "Team updates" section is present, summarize what the team worked on yesterday in its own section, using any attached images or documents provided for extra context.`,
    `- 1-3 quick observations or suggested next actions if warranted.`,
    `Return ONLY clean HTML body content using <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. Do NOT include <html>, <head>, <body> tags, markdown, or code fences.`,
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Deterministic "Submitted files" section with exact links (not model-generated). */
function renderAttachments(files: ISubmissionAttachment[]): string {
  if (files.length === 0) return "";
  const items = files
    .map(
      (f) =>
        `<li><a href="${escapeHtml(f.url)}" style="color:#8C00FF;">${escapeHtml(
          f.filename
        )}</a></li>`
    )
    .join("");
  return `<h2 style="font-size:16px;margin:20px 0 8px;">Submitted files</h2><ul style="margin:0;padding-left:20px;">${items}</ul>`;
}

function renderEmail(
  projectName: string,
  bodyHtml: string,
  attachments: ISubmissionAttachment[] = []
): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#8C00FF,#450693);border-radius:16px;padding:24px;color:#ffffff;">
        <h1 style="margin:0;font-size:20px;">Daily SEO Summary</h1>
        <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">${projectName}</p>
      </div>
      <div style="background:#ffffff;border:1px solid #ede9fe;border-top:none;border-radius:0 0 16px 16px;padding:24px;font-size:14px;line-height:1.6;">
        ${bodyHtml}
        ${renderAttachments(attachments)}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
        Sent by WSS SEO Manager · Generated with Claude
      </p>
    </div>
  </body>
</html>`;
}
