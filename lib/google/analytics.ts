import { GoogleReconnectError } from "@/lib/google/oauth";

/**
 * Thin wrapper over the Google Analytics (GA4) Admin + Data REST APIs.
 * All calls take an already-valid access token (see `getValidAccessToken`).
 * Server-only.
 */

const ADMIN_ENDPOINT =
  "https://analyticsadmin.googleapis.com/v1beta/accountSummaries";
const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

/** Default reporting window. GA4 accepts relative date strings. */
const START_DATE = "28daysAgo";
const END_DATE = "today";
export const RANGE_LABEL = "Last 28 days";

export interface GaProperty {
  /** GA4 resource name, e.g. `properties/123456789`. */
  propertyId: string;
  displayName: string;
}

export interface GaTotals {
  sessions: number;
  totalUsers: number;
  screenPageViews: number;
  averageSessionDuration: number;
}

export interface GaRow {
  dimension: string;
  metric: number;
}

async function gaFetch<T>(
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
    throw new Error(`Analytics API error (${res.status})`);
  }
  return (await res.json()) as T;
}

interface AccountSummary {
  propertySummaries?: { property: string; displayName: string }[];
}

export async function listProperties(
  accessToken: string
): Promise<GaProperty[]> {
  const data = await gaFetch<{ accountSummaries?: AccountSummary[] }>(
    ADMIN_ENDPOINT,
    accessToken
  );
  return (data.accountSummaries ?? []).flatMap((account) =>
    (account.propertySummaries ?? []).map((p) => ({
      propertyId: p.property,
      displayName: p.displayName,
    }))
  );
}

interface ReportRow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}

async function runReport(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<ReportRow[]> {
  const url = `${DATA_BASE}/${propertyId}:runReport`;
  const data = await gaFetch<{ rows?: ReportRow[] }>(url, accessToken, {
    method: "POST",
    body: JSON.stringify({
      dateRanges: [{ startDate: START_DATE, endDate: END_DATE }],
      ...body,
    }),
  });
  return data.rows ?? [];
}

function num(value?: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Maps a single-dimension / single-metric report into sorted rows. */
function toRows(rows: ReportRow[]): GaRow[] {
  return rows.map((r) => ({
    dimension: r.dimensionValues?.[0]?.value ?? "",
    metric: num(r.metricValues?.[0]?.value),
  }));
}

export interface GaConnectorData {
  rangeLabel: string;
  totals: GaTotals;
  topPages: GaRow[];
  topChannels: GaRow[];
}

export async function getConnectorData(
  accessToken: string,
  propertyId: string
): Promise<GaConnectorData> {
  const [totalsRows, topPages, topChannels] = await Promise.all([
    runReport(accessToken, propertyId, {
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
      ],
    }),
    runReport(accessToken, propertyId, {
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
    runReport(accessToken, propertyId, {
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
  ]);

  const m = totalsRows[0]?.metricValues ?? [];
  const totals: GaTotals = {
    sessions: num(m[0]?.value),
    totalUsers: num(m[1]?.value),
    screenPageViews: num(m[2]?.value),
    averageSessionDuration: num(m[3]?.value),
  };

  return {
    rangeLabel: RANGE_LABEL,
    totals,
    topPages: toRows(topPages),
    topChannels: toRows(topChannels),
  };
}

export interface GaDailySnapshot {
  date: string;
  totals: GaTotals;
  topPages: GaRow[];
  topChannels: GaRow[];
}

/** Yesterday's GA4 data (GA4 has no reporting lag). */
export async function getDailySnapshot(
  accessToken: string,
  propertyId: string
): Promise<GaDailySnapshot> {
  const dateRanges = [{ startDate: "yesterday", endDate: "yesterday" }];

  const [totalsRows, topPages, topChannels] = await Promise.all([
    runReport(accessToken, propertyId, {
      dateRanges,
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
      ],
    }),
    runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 5,
    }),
    runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 5,
    }),
  ]);

  const m = totalsRows[0]?.metricValues ?? [];
  const totals: GaTotals = {
    sessions: num(m[0]?.value),
    totalUsers: num(m[1]?.value),
    screenPageViews: num(m[2]?.value),
    averageSessionDuration: num(m[3]?.value),
  };

  return {
    date: "yesterday",
    totals,
    topPages: toRows(topPages),
    topChannels: toRows(topChannels),
  };
}

export interface GaDateRange {
  startDate: string;
  endDate: string;
}

export interface GaMonthlySnapshot {
  totals: GaTotals;
  /** Prior month's totals, for month-over-month comparison. */
  prevTotals: GaTotals;
  topPages: GaRow[];
  topChannels: GaRow[];
  range: GaDateRange;
}

function rowToTotals(row?: ReportRow): GaTotals {
  const m = row?.metricValues ?? [];
  return {
    sessions: num(m[0]?.value),
    totalUsers: num(m[1]?.value),
    screenPageViews: num(m[2]?.value),
    averageSessionDuration: num(m[3]?.value),
  };
}

/**
 * GA4 totals + top pages/channels for a full calendar month, plus the prior
 * month's totals for month-over-month comparison. The totals report passes both
 * ranges so GA4 returns one row per range (current first, previous second).
 */
export async function getMonthlySnapshot(
  accessToken: string,
  propertyId: string,
  range: GaDateRange,
  prevRange: GaDateRange
): Promise<GaMonthlySnapshot> {
  const dateRanges = [range];

  const [totalsRows, topPages, topChannels] = await Promise.all([
    runReport(accessToken, propertyId, {
      dateRanges: [range, prevRange],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
      ],
    }),
    runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 5,
    }),
    runReport(accessToken, propertyId, {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 5,
    }),
  ]);

  return {
    totals: rowToTotals(totalsRows[0]),
    prevTotals: rowToTotals(totalsRows[1]),
    topPages: toRows(topPages),
    topChannels: toRows(topChannels),
    range,
  };
}
