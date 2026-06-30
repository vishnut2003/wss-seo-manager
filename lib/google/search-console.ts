import { GoogleReconnectError } from "@/lib/google/oauth";

/**
 * Thin wrapper over the Google Search Console (Webmasters v3) REST API.
 * All calls take an already-valid access token (see `getValidAccessToken`).
 * Server-only.
 */

const SITES_ENDPOINT = "https://www.googleapis.com/webmasters/v3/sites";
const API_BASE = "https://www.googleapis.com/webmasters/v3/sites";

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface SearchAnalyticsRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

async function gscFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    throw new GoogleReconnectError("Google authorization has expired");
  }
  if (!res.ok) {
    throw new Error(`Search Console API error (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listSites(accessToken: string): Promise<GscSite[]> {
  const data = await gscFetch<{ siteEntry?: GscSite[] }>(
    SITES_ENDPOINT,
    accessToken
  );
  return data.siteEntry ?? [];
}

export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>
): Promise<SearchAnalyticsRow[]> {
  const url = `${API_BASE}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const data = await gscFetch<{ rows?: SearchAnalyticsRow[] }>(
    url,
    accessToken,
    { method: "POST", body: JSON.stringify(body) }
  );
  return data.rows ?? [];
}

/**
 * Default reporting window. GSC data lags ~2-3 days, so we end the range a few
 * days back to avoid empty/partial tail data.
 */
export function getDateRange(days = 28, lagDays = 3): DateRange {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(Date.now() - lagDays * 86_400_000);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export interface ConnectorData {
  range: DateRange;
  totals: SearchAnalyticsTotals;
  topQueries: SearchAnalyticsRow[];
  topPages: SearchAnalyticsRow[];
}

/** Fetches overview totals + top queries + top pages for the dashboard. */
export async function getConnectorData(
  accessToken: string,
  siteUrl: string
): Promise<ConnectorData> {
  const range = getDateRange();
  const base = { startDate: range.startDate, endDate: range.endDate };

  const [totalsRows, topQueries, topPages] = await Promise.all([
    querySearchAnalytics(accessToken, siteUrl, base),
    querySearchAnalytics(accessToken, siteUrl, {
      ...base,
      dimensions: ["query"],
      rowLimit: 10,
    }),
    querySearchAnalytics(accessToken, siteUrl, {
      ...base,
      dimensions: ["page"],
      rowLimit: 10,
    }),
  ]);

  const totals: SearchAnalyticsTotals = totalsRows[0]
    ? {
        clicks: totalsRows[0].clicks,
        impressions: totalsRows[0].impressions,
        ctr: totalsRows[0].ctr,
        position: totalsRows[0].position,
      }
    : { clicks: 0, impressions: 0, ctr: 0, position: 0 };

  return { range, totals, topQueries, topPages };
}

export interface DailySnapshot {
  /** The actual day summarized (YYYY-MM-DD), or null if no recent data. */
  date: string | null;
  totals: SearchAnalyticsTotals;
  topQueries: SearchAnalyticsRow[];
}

/**
 * Latest complete day of GSC data. Because GSC lags ~2-3 days, we look back a
 * few days grouped by date, pick the most recent day that has data, and return
 * that day's totals + top queries.
 */
export async function getDailySnapshot(
  accessToken: string,
  siteUrl: string
): Promise<DailySnapshot> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(Date.now() - 86_400_000);
  const start = new Date(Date.now() - 6 * 86_400_000);

  const byDate = await querySearchAnalytics(accessToken, siteUrl, {
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: ["date"],
    rowLimit: 10,
  });

  if (byDate.length === 0) {
    return {
      date: null,
      totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      topQueries: [],
    };
  }

  const latest = byDate.reduce((a, b) =>
    (a.keys?.[0] ?? "") > (b.keys?.[0] ?? "") ? a : b
  );
  const date = latest.keys?.[0] ?? null;

  const totals: SearchAnalyticsTotals = {
    clicks: latest.clicks,
    impressions: latest.impressions,
    ctr: latest.ctr,
    position: latest.position,
  };

  const topQueries = date
    ? await querySearchAnalytics(accessToken, siteUrl, {
        startDate: date,
        endDate: date,
        dimensions: ["query"],
        rowLimit: 5,
      })
    : [];

  return { date, totals, topQueries };
}

export interface MonthlySnapshot {
  /** Totals for the reporting month. */
  totals: SearchAnalyticsTotals;
  /** Totals for the prior month, for month-over-month comparison. */
  prevTotals: SearchAnalyticsTotals;
  topQueries: SearchAnalyticsRow[];
  range: DateRange;
}

const EMPTY_TOTALS: SearchAnalyticsTotals = {
  clicks: 0,
  impressions: 0,
  ctr: 0,
  position: 0,
};

function toTotals(row?: SearchAnalyticsRow): SearchAnalyticsTotals {
  return row
    ? {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }
    : EMPTY_TOTALS;
}

/**
 * GSC totals + top queries for a full calendar month, plus the prior month's
 * totals for month-over-month comparison. Both ranges are passed in explicitly
 * so GSC and GA4 cover the same period.
 */
export async function getMonthlySnapshot(
  accessToken: string,
  siteUrl: string,
  range: DateRange,
  prevRange: DateRange
): Promise<MonthlySnapshot> {
  const [totalsRows, prevTotalsRows, topQueries] = await Promise.all([
    querySearchAnalytics(accessToken, siteUrl, {
      startDate: range.startDate,
      endDate: range.endDate,
    }),
    querySearchAnalytics(accessToken, siteUrl, {
      startDate: prevRange.startDate,
      endDate: prevRange.endDate,
    }),
    querySearchAnalytics(accessToken, siteUrl, {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: ["query"],
      rowLimit: 5,
    }),
  ]);

  return {
    totals: toTotals(totalsRows[0]),
    prevTotals: toTotals(prevTotalsRows[0]),
    topQueries,
    range,
  };
}
