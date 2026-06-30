import { GoogleReconnectError } from "@/lib/google/oauth";

/**
 * Thin wrapper over the Google Ads REST API. All calls take an already-valid
 * access token (see `getValidAccessToken`) plus an app-wide developer token
 * (`GOOGLE_ADS_DEVELOPER_TOKEN`). Money is returned in "micros" (millionths of
 * a currency unit) and converted to whole units here. Server-only.
 */

const API_BASE = "https://googleads.googleapis.com";
export const GOOGLE_ADS_API_VERSION = "v18";

/** Reporting window. Google Ads accepts named date ranges in GAQL. */
export const RANGE_LABEL = "Last 30 days";

/**
 * Thrown when the developer token is missing or not approved for the API.
 * Distinct from `GoogleReconnectError` so the page can show a config notice
 * rather than prompting a reconnect.
 */
export class GoogleAdsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAdsConfigError";
  }
}

function getDeveloperToken(): string {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!token) {
    throw new GoogleAdsConfigError(
      "Missing GOOGLE_ADS_DEVELOPER_TOKEN environment variable"
    );
  }
  return token;
}

async function adsFetch<T>(
  path: string,
  accessToken: string,
  opts: { loginCustomerId?: string; body?: unknown } = {}
): Promise<T> {
  const developerToken = getDeveloperToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (opts.loginCustomerId) {
    headers["login-customer-id"] = opts.loginCustomerId;
  }

  const res = await fetch(`${API_BASE}/${GOOGLE_ADS_API_VERSION}/${path}`, {
    method: opts.body ? "POST" : "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    throw new GoogleReconnectError("Google authorization has expired");
  }
  if (res.status === 400 || res.status === 403) {
    // Distinguish developer-token problems from ordinary request errors.
    const text = await res.text();
    if (/developer.?token|NOT_APPROVED|not been approved/i.test(text)) {
      throw new GoogleAdsConfigError(
        "Google Ads developer token is missing or not approved"
      );
    }
    throw new Error(`Google Ads API error (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`Google Ads API error (${res.status})`);
  }
  return (await res.json()) as T;
}

interface SearchRow {
  customer?: {
    id?: string;
    descriptiveName?: string;
    currencyCode?: string;
  };
  campaign?: { name?: string };
  metrics?: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    averageCpc?: string;
  };
}

/** Runs a GAQL query against a single customer account. */
async function search(
  accessToken: string,
  customerId: string,
  loginCustomerId: string,
  query: string
): Promise<SearchRow[]> {
  const data = await adsFetch<{ results?: SearchRow[] }>(
    `customers/${customerId}/googleAds:search`,
    accessToken,
    { loginCustomerId, body: { query } }
  );
  return data.results ?? [];
}

function num(value?: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Converts a micros string (millionths of a unit) to whole currency units. */
function micros(value?: string): number {
  return num(value) / 1_000_000;
}

export interface AdsAccount {
  /** Digits only, e.g. `1234567890`. */
  customerId: string;
  displayName: string;
  currencyCode?: string;
}

/** Resolves a single accessible customer's name + currency (best-effort). */
async function resolveAccount(
  accessToken: string,
  customerId: string
): Promise<AdsAccount> {
  try {
    const rows = await search(
      accessToken,
      customerId,
      customerId,
      "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1"
    );
    const c = rows[0]?.customer;
    return {
      customerId,
      displayName: c?.descriptiveName
        ? `${c.descriptiveName} (${customerId})`
        : customerId,
      currencyCode: c?.currencyCode,
    };
  } catch (err) {
    // Re-throw the signals the page knows how to render.
    if (err instanceof GoogleReconnectError || err instanceof GoogleAdsConfigError) {
      throw err;
    }
    // A single unreadable account (e.g. a manager record) shouldn't break the list.
    return { customerId, displayName: customerId };
  }
}

/**
 * Lists the Google Ads accounts the authorized user can access directly,
 * resolved to friendly names. `listAccessibleCustomers` returns IDs only, so
 * each is enriched with a follow-up `customer` query.
 */
export async function listAccessibleCustomers(
  accessToken: string
): Promise<AdsAccount[]> {
  const data = await adsFetch<{ resourceNames?: string[] }>(
    "customers:listAccessibleCustomers",
    accessToken
  );
  const ids = (data.resourceNames ?? []).map((r) =>
    r.replace("customers/", "")
  );
  return Promise.all(ids.map((id) => resolveAccount(accessToken, id)));
}

export interface AdsTotals {
  spend: number;
  impressions: number;
  clicks: number;
  avgCpc: number;
}

export interface AdsCampaignRow {
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface AdsConnectorData {
  rangeLabel: string;
  currencyCode?: string;
  totals: AdsTotals;
  topCampaigns: AdsCampaignRow[];
}

/** Last-30-days account totals + top campaigns for the dashboard. */
export async function getConnectorData(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string
): Promise<AdsConnectorData> {
  const login = loginCustomerId || customerId;

  const [totalsRows, campaignRows] = await Promise.all([
    search(
      accessToken,
      customerId,
      login,
      "SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.average_cpc, customer.currency_code FROM customer WHERE segments.date DURING LAST_30_DAYS"
    ),
    search(
      accessToken,
      customerId,
      login,
      "SELECT campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date DURING LAST_30_DAYS ORDER BY metrics.cost_micros DESC LIMIT 10"
    ),
  ]);

  const t = totalsRows[0];
  const totals: AdsTotals = {
    spend: micros(t?.metrics?.costMicros),
    impressions: num(t?.metrics?.impressions),
    clicks: num(t?.metrics?.clicks),
    avgCpc: micros(t?.metrics?.averageCpc),
  };

  const topCampaigns: AdsCampaignRow[] = campaignRows.map((r) => ({
    campaignName: r.campaign?.name ?? "",
    spend: micros(r.metrics?.costMicros),
    impressions: num(r.metrics?.impressions),
    clicks: num(r.metrics?.clicks),
  }));

  return {
    rangeLabel: RANGE_LABEL,
    currencyCode: t?.customer?.currencyCode,
    totals,
    topCampaigns,
  };
}
