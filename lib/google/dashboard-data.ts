import { connectDB } from "@/configs/db";
import Connection, { type IConnection } from "@/models/Connection";
import { GoogleReconnectError, getValidAccessToken } from "@/lib/google/oauth";
import {
  getConnectorData as gscConnectorData,
  getTotals as gscTotals,
  getMonthlyTrend as gscMonthlyTrend,
  getDateRange,
  type SearchAnalyticsTotals,
  type SearchAnalyticsRow,
  type TrendMonth,
} from "@/lib/google/search-console";
import {
  getConnectorData as gaConnectorData,
  getTotals as gaTotals,
  getMonthlyTrend as gaMonthlyTrend,
  type GaTotals,
  type GaRow,
  type GaTrendMonth,
} from "@/lib/google/analytics";

/**
 * Per-project dashboard data. Pulls a 28-day window (with the prior 28 days for
 * MoM trend), a 6-month monthly series, and top dimensions from each connected
 * Google source. Each connector degrades independently so one missing/broken
 * source never blanks the whole dashboard.
 */

type ConnectionLean = IConnection & { _id: unknown };

export type ConnectorStatus =
  | "ok"
  | "reconnect"
  | "error"
  | "not-connected"
  | "no-property";

export interface GscDashboard {
  status: ConnectorStatus;
  siteUrl?: string;
  totals?: SearchAnalyticsTotals;
  prevTotals?: SearchAnalyticsTotals;
  topQueries?: SearchAnalyticsRow[];
  topPages?: SearchAnalyticsRow[];
  monthly?: TrendMonth[];
}

export interface GaDashboard {
  status: ConnectorStatus;
  totals?: GaTotals;
  prevTotals?: GaTotals;
  topPages?: GaRow[];
  topChannels?: GaRow[];
  monthly?: GaTrendMonth[];
}

export interface ProjectDashboard {
  gsc: GscDashboard;
  ga: GaDashboard;
  /** True when at least one connector returned data. */
  hasData: boolean;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function statusFor(err: unknown): ConnectorStatus {
  return err instanceof GoogleReconnectError ? "reconnect" : "error";
}

async function loadGsc(conn: ConnectionLean | null): Promise<GscDashboard> {
  if (!conn) return { status: "not-connected" };
  if (!conn.siteUrl) return { status: "no-property" };
  try {
    const accessToken = await getValidAccessToken(conn);
    const cur = getDateRange(28, 3);
    const curStart = new Date(cur.startDate);
    const prevEnd = new Date(curStart.getTime() - 86_400_000);
    const prevStart = new Date(prevEnd.getTime() - 27 * 86_400_000);
    const prevRange = { startDate: fmt(prevStart), endDate: fmt(prevEnd) };

    const [data, prevTotals, monthly] = await Promise.all([
      gscConnectorData(accessToken, conn.siteUrl),
      gscTotals(accessToken, conn.siteUrl, prevRange),
      gscMonthlyTrend(accessToken, conn.siteUrl),
    ]);

    return {
      status: "ok",
      siteUrl: conn.siteUrl,
      totals: data.totals,
      prevTotals,
      topQueries: data.topQueries,
      topPages: data.topPages,
      monthly,
    };
  } catch (err) {
    return { status: statusFor(err) };
  }
}

async function loadGa(conn: ConnectionLean | null): Promise<GaDashboard> {
  if (!conn) return { status: "not-connected" };
  if (!conn.propertyId) return { status: "no-property" };
  try {
    const accessToken = await getValidAccessToken(conn);
    const [data, prevTotals, monthly] = await Promise.all([
      gaConnectorData(accessToken, conn.propertyId),
      gaTotals(accessToken, conn.propertyId, {
        startDate: "56daysAgo",
        endDate: "29daysAgo",
      }),
      gaMonthlyTrend(accessToken, conn.propertyId),
    ]);

    return {
      status: "ok",
      totals: data.totals,
      prevTotals,
      topPages: data.topPages,
      topChannels: data.topChannels,
      monthly,
    };
  } catch (err) {
    return { status: statusFor(err) };
  }
}

export async function getProjectDashboard(
  projectId: string
): Promise<ProjectDashboard> {
  await connectDB();

  const [gscConn, gaConn] = await Promise.all([
    Connection.findOne({
      projectId,
      provider: "google-search-console",
    }).lean<ConnectionLean | null>(),
    Connection.findOne({
      projectId,
      provider: "google-analytics",
    }).lean<ConnectionLean | null>(),
  ]);

  const [gsc, ga] = await Promise.all([loadGsc(gscConn), loadGa(gaConn)]);

  return { gsc, ga, hasData: gsc.status === "ok" || ga.status === "ok" };
}

/** MoM percent change; null when there's no prior-period baseline. */
export function trendPct(current: number, previous: number): number | null {
  if (!previous) return current ? 100 : null;
  return ((current - previous) / previous) * 100;
}
