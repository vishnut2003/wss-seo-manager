import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import Connection, { type IConnection } from "@/models/Connection";
import NotificationSetting from "@/models/NotificationSetting";
import { GoogleReconnectError, getValidAccessToken } from "@/lib/google/oauth";
import { getMonthlySnapshot as gscMonthlySnapshot } from "@/lib/google/search-console";
import { getMonthlySnapshot as gaMonthlySnapshot } from "@/lib/google/analytics";
import {
  getSnapshot as windsorSnapshot,
  getSourceDef as windsorSourceDef,
  resolveFields as windsorResolveFields,
  toNumber as windsorToNumber,
  formatWindsorValue,
} from "@/lib/windsor/client";
import { summarize } from "@/lib/anthropic";
import { sendEmail } from "@/lib/email";

/**
 * Core monthly-summary orchestrator. Pulls the previous full calendar month
 * (plus the month before it for month-over-month comparison) from each enabled
 * connector, asks Claude to write a digest, and emails it via Resend.
 * Server-only. Designed to run within a single Vercel function (≤60s).
 */

const TYPE = "monthly-summary" as const;
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

/**
 * Previous full calendar month and the month before it (UTC), plus a label.
 * A run on July 3 → current = June 1–30, previous = May 1–31.
 */
function monthRanges(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const curStart = new Date(Date.UTC(y, m - 1, 1));
  const curEnd = new Date(Date.UTC(y, m, 0));
  const prevStart = new Date(Date.UTC(y, m - 2, 1));
  const prevEnd = new Date(Date.UTC(y, m - 1, 0));
  return {
    current: { startDate: fmt(curStart), endDate: fmt(curEnd) },
    previous: { startDate: fmt(prevStart), endDate: fmt(prevEnd) },
    label: curStart.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

/** A " (▲ 12% MoM)" / " (▼ 8% MoM)" suffix, or "" when there's no baseline. */
function delta(current: number, prev: number): string {
  if (!prev) return current ? " (new vs prior month)" : "";
  const pct = ((current - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return " (flat MoM)";
  const arrow = pct > 0 ? "▲" : "▼";
  return ` (${arrow} ${Math.abs(pct).toFixed(0)}% MoM)`;
}

export async function runMonthlySummary(
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

  const { current, previous, label } = monthRanges();
  const blocks: string[] = [];
  let hasData = false;

  for (const provider of setting.enabledConnectors) {
    const providerLabel = PROVIDER_LABELS[provider] ?? provider;
    try {
      const conn = await Connection.findOne({
        projectId,
        provider,
      }).lean<ConnectionLean | null>();

      if (!conn) {
        blocks.push(`## ${providerLabel}\nNot connected.`);
        continue;
      }

      if (provider === "windsor") {
        const selections = conn.windsorAccounts ?? [];
        if (selections.length === 0) {
          blocks.push(`## ${providerLabel}\nNo accounts selected.`);
          continue;
        }
        // One metric block per selected Windsor account.
        for (const selection of selections) {
          const def = windsorSourceDef(selection.source);
          if (!def) continue;
          const accountLabel = selection.accountName ?? selection.accountId;
          const fields = windsorResolveFields(def, selection.fields);
          const snap = await windsorSnapshot(
            def.slug,
            fields,
            selection.accountId,
            current,
            previous
          );
          const lines = def.metrics
            .filter((m) => fields.includes(m.id))
            .map((m) => {
              const cur = windsorToNumber(snap.totals[m.id]);
              const prev = windsorToNumber(snap.prevTotals[m.id]);
              return `- ${m.label}: ${formatWindsorValue(cur, m.format)}${delta(cur, prev)}`;
            })
            .join("\n");
          if (lines) hasData = true;
          blocks.push(
            `## ${providerLabel} — ${def.label} · ${accountLabel} — ${label}\n` +
              (lines || "No data for this period.")
          );
        }
        continue;
      }

      const accessToken = await getValidAccessToken(conn);

      if (provider === "google-search-console") {
        if (!conn.siteUrl) {
          blocks.push(`## ${providerLabel}\nNo property selected.`);
          continue;
        }
        const snap = await gscMonthlySnapshot(
          accessToken,
          conn.siteUrl,
          current,
          previous
        );
        hasData = true;
        const queries = snap.topQueries
          .map(
            (q) =>
              `  - "${q.keys?.[0] ?? ""}": ${q.clicks} clicks, ${q.impressions} impressions`
          )
          .join("\n");
        blocks.push(
          `## ${providerLabel} (${conn.siteUrl}) — ${label}\n` +
            `- Clicks: ${snap.totals.clicks}${delta(snap.totals.clicks, snap.prevTotals.clicks)}\n` +
            `- Impressions: ${snap.totals.impressions}${delta(snap.totals.impressions, snap.prevTotals.impressions)}\n` +
            `- CTR: ${(snap.totals.ctr * 100).toFixed(2)}% (prior month ${(snap.prevTotals.ctr * 100).toFixed(2)}%)\n` +
            `- Avg position: ${snap.totals.position.toFixed(1)} (prior month ${snap.prevTotals.position.toFixed(1)})\n` +
            (queries ? `- Top queries:\n${queries}` : "")
        );
      } else if (provider === "google-analytics") {
        if (!conn.propertyId) {
          blocks.push(`## ${providerLabel}\nNo property selected.`);
          continue;
        }
        const snap = await gaMonthlySnapshot(
          accessToken,
          conn.propertyId,
          current,
          previous
        );
        hasData = true;
        const pages = snap.topPages
          .map((p) => `  - ${p.dimension}: ${p.metric} views`)
          .join("\n");
        const channels = snap.topChannels
          .map((c) => `  - ${c.dimension}: ${c.metric} sessions`)
          .join("\n");
        blocks.push(
          `## ${providerLabel} — ${label}\n` +
            `- Sessions: ${snap.totals.sessions}${delta(snap.totals.sessions, snap.prevTotals.sessions)}\n` +
            `- Total users: ${snap.totals.totalUsers}${delta(snap.totals.totalUsers, snap.prevTotals.totalUsers)}\n` +
            `- Page views: ${snap.totals.screenPageViews}${delta(snap.totals.screenPageViews, snap.prevTotals.screenPageViews)}\n` +
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
      blocks.push(`## ${providerLabel}\n${note}`);
    }
  }

  if (!hasData) return finish("skipped: no data");

  const prompt = buildPrompt(project.name, project.domain, label, blocks);
  const digest = await summarize(prompt);
  const html = renderEmail(project.name, label, digest);

  await sendEmail({
    to: setting.recipients,
    subject: `Monthly SEO summary — ${project.name} (${label})`,
    html,
  });

  return finish("sent", true);
}

function buildPrompt(
  projectName: string,
  domain: string,
  monthLabel: string,
  blocks: string[]
): string {
  return [
    `You are an SEO analyst writing a concise monthly performance email for the project "${projectName}" (${domain}), covering ${monthLabel}.`,
    `Below is the data from the connected sources for that full calendar month. Figures in parentheses show the month-over-month (MoM) change versus the prior month.`,
    ``,
    blocks.join("\n\n"),
    ``,
    `Write a brief, scannable summary an account manager can read in a couple of minutes:`,
    `- Start with a one-sentence headline of how the site performed this month.`,
    `- A short section per data source with the key numbers and notable month-over-month movement.`,
    `- 2-4 observations or suggested next actions, grounded in the trends above.`,
    `Return ONLY clean HTML body content using <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. Do NOT include <html>, <head>, <body> tags, markdown, or code fences.`,
  ].join("\n");
}

function renderEmail(
  projectName: string,
  monthLabel: string,
  bodyHtml: string
): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#8C00FF,#450693);border-radius:16px;padding:24px;color:#ffffff;">
        <h1 style="margin:0;font-size:20px;">Monthly SEO Summary</h1>
        <p style="margin:4px 0 0;opacity:0.9;font-size:14px;">${projectName} · ${monthLabel}</p>
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
