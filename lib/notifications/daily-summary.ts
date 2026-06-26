import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import Connection, { type IConnection } from "@/models/Connection";
import NotificationSetting from "@/models/NotificationSetting";
import { GoogleReconnectError, getValidAccessToken } from "@/lib/google/oauth";
import { getDailySnapshot as gscDailySnapshot } from "@/lib/google/search-console";
import { getDailySnapshot as gaDailySnapshot } from "@/lib/google/analytics";
import { summarize } from "@/lib/anthropic";
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

  if (!hasData) return finish("skipped: no data");

  const prompt = buildPrompt(project.name, project.domain, blocks);
  const digest = await summarize(prompt);
  const html = renderEmail(project.name, digest);

  await sendEmail({
    to: setting.recipients,
    subject: `Daily SEO summary — ${project.name}`,
    html,
  });

  return finish("sent", true);
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
    `- 1-3 quick observations or suggested next actions if warranted.`,
    `Return ONLY clean HTML body content using <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. Do NOT include <html>, <head>, <body> tags, markdown, or code fences.`,
  ].join("\n");
}

function renderEmail(projectName: string, bodyHtml: string): string {
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
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
        Sent by WSS SEO Manager · Generated with Claude
      </p>
    </div>
  </body>
</html>`;
}
