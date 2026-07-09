import type Anthropic from "@anthropic-ai/sdk";
import { connectDB } from "@/configs/db";
import Connection, {
  type IConnection,
  type ConnectionProvider,
} from "@/models/Connection";
import { GoogleReconnectError, getValidAccessToken } from "@/lib/google/oauth";
import { getProjectDashboard } from "@/lib/google/dashboard-data";
import {
  getDateRange,
  querySearchAnalytics,
  type SearchAnalyticsTotals,
  type SearchAnalyticsRow,
} from "@/lib/google/search-console";
import {
  getConnectorData as gaConnectorData,
  getTotals as gaTotals,
} from "@/lib/google/analytics";
import {
  getConnectorData as windsorConnectorData,
  getSourceDef as windsorSourceDef,
  resolveFields as windsorResolveFields,
} from "@/lib/windsor/client";

/**
 * Read-only Claude tools that let the SEO Manager assistant pull live connector
 * data for a single project. Every executor is server-only and degrades
 * gracefully — a broken/expired/missing connector returns a status string
 * instead of throwing, so the model can tell the user to reconnect rather than
 * hallucinating numbers. Tokens never leave the server.
 */

type ConnectionLean = IConnection & { _id: unknown };

/** Human-facing status the model can relay verbatim. */
type ConnectorGate =
  | { ok: true; token: string; conn: ConnectionLean }
  | { ok: false; status: string };

async function gate(
  projectId: string,
  provider: ConnectionProvider,
  requireField: "siteUrl" | "propertyId"
): Promise<ConnectorGate> {
  await connectDB();
  const conn = await Connection.findOne({ projectId, provider }).lean<
    ConnectionLean | null
  >();
  if (!conn) return { ok: false, status: "not-connected" };
  if (!conn[requireField])
    return { ok: false, status: "no-property (connected, but no property selected)" };
  try {
    const token = await getValidAccessToken(conn);
    return { ok: true, token, conn };
  } catch (err) {
    return {
      ok: false,
      status:
        err instanceof GoogleReconnectError
          ? "reconnect (authorization expired — the connector must be reconnected)"
          : "error (data temporarily unavailable)",
    };
  }
}

function pctChange(cur: number, prev: number): number | null {
  if (!prev) return cur ? 100 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// Tool schemas (Anthropic tool-use format)
// ---------------------------------------------------------------------------

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_project_overview",
    description:
      "Get a full performance snapshot for this project from all connected " +
      "sources (Google Search Console, Google Analytics, and the Windsor.ai " +
      "accounts attached to this project). Returns each connector's status, " +
      "last-28-day totals with month-over-month change, top search queries, " +
      "top pages, top traffic channels, per-account Windsor totals, and a " +
      "6-month trend. Use this first for most questions about how the " +
      "project is doing.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_search_console_detail",
    description:
      "Get deeper Google Search Console data over a custom window: totals " +
      "(clicks, impressions, CTR, average position) plus the top search " +
      "queries and top pages. Use for keyword/query questions or non-28-day " +
      "windows.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Lookback window in days (default 28, max 90).",
        },
        limit: {
          type: "integer",
          description: "How many top queries/pages to return (default 10, max 25).",
        },
      },
    },
  },
  {
    name: "get_analytics_detail",
    description:
      "Get deeper Google Analytics (GA4) data over a custom window: totals " +
      "(sessions, users, page views, avg session duration) plus top pages and " +
      "top traffic channels. Use for traffic/engagement questions or " +
      "non-28-day windows.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Lookback window in days (default 28, max 90).",
        },
      },
    },
  },
  {
    name: "get_windsor_detail",
    description:
      "Get cross-channel marketing data from Windsor.ai for each account " +
      "attached to this project (e.g. a Google Ads account, a Search Console " +
      "site, a Meta Ads account, GA4, Google Business Profile). Returns, per " +
      "account, last-30-day totals (clicks, impressions, ad spend, " +
      "conversions, CTR where available) and the top breakdown rows " +
      "(campaigns, queries, sources…). Use for paid-ads, ad-spend, or ROI " +
      "questions. Returns a status string like 'not-connected' or " +
      "'no-accounts' when the connector isn't set up — relay that instead of " +
      "inventing numbers.",
    input_schema: { type: "object", properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Executors
// ---------------------------------------------------------------------------

function clampDays(days: unknown): number {
  const n = typeof days === "number" ? Math.floor(days) : 28;
  return Math.min(Math.max(n, 1), 90);
}

async function runProjectOverview(projectId: string): Promise<unknown> {
  const dash = await getProjectDashboard(projectId);
  const withMoM = (totals?: object, prev?: object) => {
    if (!totals) return undefined;
    const t = totals as Record<string, number>;
    const p = prev as Record<string, number> | undefined;
    const mom: Record<string, number | null> = {};
    if (p) {
      for (const key of Object.keys(t)) {
        mom[key] = pctChange(t[key], p[key]);
      }
    }
    return { totals, momPercent: p ? mom : null };
  };

  return {
    note: "Windows: last 28 days vs the prior 28 days. momPercent is % change vs prior period.",
    searchConsole: {
      status: dash.gsc.status,
      siteUrl: dash.gsc.siteUrl,
      ...withMoM(dash.gsc.totals, dash.gsc.prevTotals),
      topQueries: dash.gsc.topQueries?.map((r) => ({
        query: r.keys?.[0] ?? "",
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      topPages: dash.gsc.topPages?.map((r) => ({
        page: r.keys?.[0] ?? "",
        clicks: r.clicks,
        impressions: r.impressions,
      })),
      monthlyTrend: dash.gsc.monthly,
    },
    analytics: {
      status: dash.ga.status,
      ...withMoM(dash.ga.totals, dash.ga.prevTotals),
      topPages: dash.ga.topPages,
      topChannels: dash.ga.topChannels,
      monthlyTrend: dash.ga.monthly,
    },
    windsorAccounts: {
      status: dash.windsor.status,
      note: "Last-30-day totals per Windsor.ai account attached to this project. Use get_windsor_detail for top campaigns/queries.",
      accounts: dash.windsor.accounts?.map((account) => ({
        source: account.sourceLabel,
        account: account.accountName ?? account.accountId,
        totals: account.metrics.reduce<Record<string, number>>((acc, m) => {
          acc[m.label] = m.value;
          return acc;
        }, {}),
      })),
    },
  };
}

async function runSearchConsoleDetail(
  projectId: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const g = await gate(projectId, "google-search-console", "siteUrl");
  if (!g.ok) return { status: g.status };

  const days = clampDays(input.days);
  const limit = Math.min(
    Math.max(typeof input.limit === "number" ? Math.floor(input.limit) : 10, 1),
    25
  );
  const range = getDateRange(days, 3);
  const base = { startDate: range.startDate, endDate: range.endDate };
  const siteUrl = g.conn.siteUrl as string;

  const [totalsRows, queries, pages] = await Promise.all([
    querySearchAnalytics(g.token, siteUrl, base),
    querySearchAnalytics(g.token, siteUrl, {
      ...base,
      dimensions: ["query"],
      rowLimit: limit,
    }),
    querySearchAnalytics(g.token, siteUrl, {
      ...base,
      dimensions: ["page"],
      rowLimit: limit,
    }),
  ]);

  const totals: SearchAnalyticsTotals = totalsRows[0] ?? {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  };

  const shape = (rows: SearchAnalyticsRow[]) =>
    rows.map((r) => ({
      key: r.keys?.[0] ?? "",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));

  return {
    status: "ok",
    siteUrl,
    range,
    totals,
    topQueries: shape(queries),
    topPages: shape(pages),
  };
}

async function runAnalyticsDetail(
  projectId: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const g = await gate(projectId, "google-analytics", "propertyId");
  if (!g.ok) return { status: g.status };

  const days = clampDays(input.days);
  const propertyId = g.conn.propertyId as string;

  const [overview, windowTotals] = await Promise.all([
    gaConnectorData(g.token, propertyId),
    gaTotals(g.token, propertyId, {
      startDate: `${days}daysAgo`,
      endDate: "today",
    }),
  ]);

  return {
    status: "ok",
    windowDays: days,
    totals: windowTotals,
    topPages: overview.topPages,
    topChannels: overview.topChannels,
  };
}

async function runWindsorDetail(projectId: string): Promise<unknown> {
  await connectDB();
  const conn = await Connection.findOne({
    projectId,
    provider: "windsor",
  }).lean<ConnectionLean | null>();
  if (!conn) return { status: "not-connected" };

  const selections = conn.windsorAccounts ?? [];
  if (selections.length === 0) {
    return {
      status: "no-accounts (connected, but no Windsor accounts selected)",
    };
  }

  // Each attached account reports independently; failures don't hide the rest.
  const accounts = await Promise.all(
    selections.map(async (selection) => {
      const def = windsorSourceDef(selection.source);
      const base = {
        source: selection.source,
        sourceLabel: def?.label ?? selection.source,
        account: selection.accountName ?? selection.accountId,
      };
      if (!def) return { ...base, status: "unknown-source" };
      const fields = windsorResolveFields(def, selection.fields);
      try {
        const data = await windsorConnectorData(def, fields, selection.accountId);
        return {
          ...base,
          status: "ok",
          range: data.rangeLabel,
          totals: data.totals,
          breakdownBy: def.dimensionLabel,
          topRows: data.rows,
        };
      } catch {
        return { ...base, status: "error (data temporarily unavailable)" };
      }
    })
  );

  return { status: "ok", accounts };
}

/** Dispatch a tool call by name. Never throws — returns an error payload. */
export async function runTool(
  projectId: string,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  try {
    switch (name) {
      case "get_project_overview":
        return await runProjectOverview(projectId);
      case "get_search_console_detail":
        return await runSearchConsoleDetail(projectId, input);
      case "get_analytics_detail":
        return await runAnalyticsDetail(projectId, input);
      case "get_windsor_detail":
        return await runWindsorDetail(projectId);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return {
      error:
        err instanceof GoogleReconnectError
          ? "reconnect (authorization expired)"
          : "Data temporarily unavailable.",
    };
  }
}
