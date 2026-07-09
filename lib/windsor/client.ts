/**
 * Windsor.ai REST client. Unlike the Google connectors (per-project OAuth),
 * Windsor uses a single app-wide API key (`WINDSOR_API_KEY`) and pulls unified
 * data from `https://connectors.windsor.ai/{source}`. There is no OAuth token
 * to store or refresh — the app-wide key is read straight from the environment.
 *
 * Server-only — never import into a client component.
 */

const BASE_URL = "https://connectors.windsor.ai";

/** Thrown when `WINDSOR_API_KEY` is not configured. */
export class WindsorConfigError extends Error {
  constructor(message = "Missing WINDSOR_API_KEY environment variable") {
    super(message);
    this.name = "WindsorConfigError";
  }
}

/** Thrown when a Windsor API request fails. */
export class WindsorApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WindsorApiError";
  }
}

/** Whether the app-wide Windsor key is present (used to gate the UI). */
export function isWindsorConfigured(): boolean {
  return Boolean(process.env.WINDSOR_API_KEY);
}

function getApiKey(): string {
  const key = process.env.WINDSOR_API_KEY;
  if (!key) throw new WindsorConfigError();
  return key;
}

// ---------------------------------------------------------------------------
// Source catalog
// ---------------------------------------------------------------------------

export type WindsorFormat = "number" | "currency" | "percent";

export interface WindsorMetricDef {
  id: string;
  label: string;
  format: WindsorFormat;
}

export interface WindsorSourceDef {
  slug: string;
  label: string;
  /** Field used to break the data into a table (a valid field for the source). */
  dimension: string;
  dimensionLabel: string;
  /** Selectable metric fields. */
  metrics: WindsorMetricDef[];
}

const num = (id: string, label: string): WindsorMetricDef => ({
  id,
  label,
  format: "number",
});
const cur = (id: string, label: string): WindsorMetricDef => ({
  id,
  label,
  format: "currency",
});
const pct = (id: string, label: string): WindsorMetricDef => ({
  id,
  label,
  format: "percent",
});

/**
 * Curated set of Windsor sources exposed in the app: the paid-ad channels the
 * native Google connectors don't cover (Meta, Microsoft, LinkedIn, TikTok),
 * Google Ads for a unified cross-channel view, and the organic/SEO sources
 * (Search Console, GA4, Google My Business). Field ids are Windsor's canonical
 * fields, verified against the live field catalog. Extend this list to expose
 * more sources — each entry just needs a valid `dimension` and metric ids.
 */
export const WINDSOR_SOURCES: WindsorSourceDef[] = [
  {
    slug: "facebook",
    label: "Meta Ads (Facebook & Instagram)",
    dimension: "campaign",
    dimensionLabel: "Campaign",
    metrics: [
      num("clicks", "Clicks"),
      num("impressions", "Impressions"),
      cur("spend", "Spend"),
      pct("ctr", "CTR"),
      cur("cpc", "CPC"),
    ],
  },
  {
    slug: "google_ads",
    label: "Google Ads",
    dimension: "campaign",
    dimensionLabel: "Campaign",
    metrics: [
      num("clicks", "Clicks"),
      num("impressions", "Impressions"),
      cur("spend", "Spend"),
      num("conversions", "Conversions"),
      pct("ctr", "CTR"),
    ],
  },
  {
    slug: "bing",
    label: "Microsoft Ads (Bing)",
    dimension: "campaign",
    dimensionLabel: "Campaign",
    metrics: [
      num("clicks", "Clicks"),
      num("impressions", "Impressions"),
      cur("spend", "Spend"),
      num("conversions", "Conversions"),
    ],
  },
  {
    slug: "linkedin",
    label: "LinkedIn Ads",
    dimension: "campaign",
    dimensionLabel: "Campaign",
    metrics: [
      num("clicks", "Clicks"),
      num("impressions", "Impressions"),
      cur("spend", "Spend"),
    ],
  },
  {
    slug: "tiktok",
    label: "TikTok Ads",
    dimension: "campaign",
    dimensionLabel: "Campaign",
    metrics: [
      num("clicks", "Clicks"),
      num("impressions", "Impressions"),
      cur("spend", "Spend"),
      num("conversions", "Conversions"),
    ],
  },
  {
    slug: "searchconsole",
    label: "Google Search Console",
    dimension: "query",
    dimensionLabel: "Query",
    metrics: [
      num("clicks", "Clicks"),
      num("impressions", "Impressions"),
      pct("ctr", "CTR"),
      num("position", "Avg. position"),
    ],
  },
  {
    slug: "googleanalytics4",
    label: "Google Analytics 4",
    dimension: "source",
    dimensionLabel: "Source",
    metrics: [
      num("sessions", "Sessions"),
      num("totalusers", "Total users"),
      num("newusers", "New users"),
      num("conversions", "Key events"),
    ],
  },
  {
    slug: "google_my_business",
    label: "Google Business Profile",
    dimension: "location_title",
    dimensionLabel: "Location",
    metrics: [
      num("impressions", "Impressions"),
      num("clicks", "Clicks"),
      num("call_clicks", "Call clicks"),
      num("website_clicks", "Website clicks"),
      num("direction_requests", "Direction requests"),
    ],
  },
];

export function listSources(): WindsorSourceDef[] {
  return WINDSOR_SOURCES;
}

export function getSourceDef(
  slug: string | undefined | null
): WindsorSourceDef | undefined {
  if (!slug) return undefined;
  return WINDSOR_SOURCES.find((s) => s.slug === slug);
}

/** Valid field ids for a source, intersected with the catalog. */
export function resolveFields(
  def: WindsorSourceDef,
  requested?: string[] | null
): string[] {
  const valid = new Set(def.metrics.map((m) => m.id));
  const picked = (requested ?? []).filter((f) => valid.has(f));
  return picked.length > 0 ? picked : def.metrics.map((m) => m.id);
}

// ---------------------------------------------------------------------------
// Connected accounts
// ---------------------------------------------------------------------------

export interface WindsorAccount {
  id: string;
  name?: string;
}

export interface WindsorSourceAccounts {
  source: string;
  sourceLabel: string;
  accounts: WindsorAccount[];
}

const ACCOUNTS_URL = "https://onboard.windsor.ai/api/common/ds-accounts";

type RawAccountEntry = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * The ds-accounts endpoint prefixes every id and name with `${datasource}__`
 * (e.g. `googleanalytics4__489565843`), but the data endpoint's
 * `select_accounts` expects the bare id (`489565843`). Strip that prefix.
 */
export function stripSourcePrefix(source: string, value: string): string {
  const prefix = `${source}__`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

/** Tolerant per-entry normalizer — Windsor's ds-accounts shape is not
 * strictly documented, so accept the common id/name key variants, and strip
 * the `${source}__` prefix ds-accounts adds to both id and name. */
function normalizeAccount(
  raw: RawAccountEntry,
  source: string
): WindsorAccount | null {
  const rawId = str(raw.id) ?? str(raw.account_id) ?? str(raw.accountId);
  if (!rawId) return null;
  const id = stripSourcePrefix(source, rawId);
  const rawName =
    str(raw.name) ?? str(raw.account_name) ?? str(raw.accountName);
  const name = rawName ? stripSourcePrefix(source, rawName) : undefined;
  return name && name !== id ? { id, name } : { id };
}

/**
 * All accounts connected to the Windsor workspace, grouped by source and
 * filtered to the curated catalog. Sources with no connected accounts are
 * omitted.
 */
export async function listConnectedAccounts(): Promise<WindsorSourceAccounts[]> {
  const params = new URLSearchParams({
    datasource: "all",
    api_key: getApiKey(),
  });
  const res = await fetch(`${ACCOUNTS_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WindsorApiError(
      `Windsor accounts request failed (${res.status}): ${body.slice(0, 200)}`
    );
  }
  const json = (await res.json()) as unknown;

  // Accept either grouped ({datasource, accounts:[…]}[]) or flat
  // ({datasource, id/name}[]) payloads, optionally wrapped in {data:…}.
  const list = Array.isArray(json)
    ? json
    : Array.isArray((json as { data?: unknown[] })?.data)
      ? (json as { data: unknown[] }).data
      : [];

  const bySource = new Map<string, WindsorAccount[]>();
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw = entry as RawAccountEntry;
    const source =
      str(raw.datasource) ?? str(raw.source) ?? str(raw.connector);
    if (!source) continue;
    const bucket = bySource.get(source) ?? [];
    if (Array.isArray(raw.accounts)) {
      for (const a of raw.accounts) {
        if (typeof a !== "object" || a === null) continue;
        const acc = normalizeAccount(a as RawAccountEntry, source);
        if (acc) bucket.push(acc);
      }
    } else {
      const acc = normalizeAccount(raw, source);
      if (acc) bucket.push(acc);
    }
    if (bucket.length > 0) bySource.set(source, bucket);
  }

  return WINDSOR_SOURCES.flatMap((def) => {
    const accounts = bySource.get(def.slug);
    if (!accounts || accounts.length === 0) return [];
    const seen = new Set<string>();
    const deduped = accounts.filter((a) =>
      seen.has(a.id) ? false : (seen.add(a.id), true)
    );
    return [{ source: def.slug, sourceLabel: def.label, accounts: deduped }];
  });
}

// ---------------------------------------------------------------------------
// REST access
// ---------------------------------------------------------------------------

export interface WindsorRow {
  [field: string]: string | number | null;
}

async function windsorFetch(
  source: string,
  params: URLSearchParams
): Promise<WindsorRow[]> {
  params.set("api_key", getApiKey());
  params.set("_renderer", "json");
  const url = `${BASE_URL}/${encodeURIComponent(source)}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WindsorApiError(
      `Windsor request failed (${res.status}): ${body.slice(0, 200)}`
    );
  }
  const json = (await res.json()) as { data?: WindsorRow[] };
  return Array.isArray(json.data) ? json.data : [];
}

export interface WindsorQuery {
  source: string;
  fields: string[];
  /** Restrict to specific Windsor account ids (`select_accounts`). */
  accounts?: string[];
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Raw data pull. Returns [] on an empty result (e.g. source not connected). */
export async function fetchData(query: WindsorQuery): Promise<WindsorRow[]> {
  if (query.fields.length === 0) return [];
  const params = new URLSearchParams();
  params.set("fields", query.fields.join(","));
  if (query.accounts && query.accounts.length > 0) {
    // Tolerate ids saved with the ds-accounts `${source}__` prefix.
    const cleaned = query.accounts.map((a) =>
      stripSourcePrefix(query.source, a)
    );
    params.set("select_accounts", cleaned.join(","));
  }
  if (query.datePreset) params.set("date_preset", query.datePreset);
  if (query.dateFrom) params.set("date_from", query.dateFrom);
  if (query.dateTo) params.set("date_to", query.dateTo);
  return windsorFetch(query.source, params);
}

export function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Format a raw Windsor value for display per its catalog format. */
export function formatWindsorValue(value: unknown, format: WindsorFormat): string {
  const n = toNumber(value);
  if (format === "currency")
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (format === "percent") return `${n.toFixed(2)}%`;
  return Math.round(n).toLocaleString();
}

// ---------------------------------------------------------------------------
// Higher-level helpers used by the connector page, dashboard, and summaries
// ---------------------------------------------------------------------------

export interface WindsorConnectorData {
  rangeLabel: string;
  /** Aggregated totals over the window, keyed by field id. */
  totals: WindsorRow;
  /** Top breakdown rows by the source's dimension (sorted by the first field). */
  rows: WindsorRow[];
}

/**
 * Last-30-day totals plus a top-10 breakdown by the source's dimension, for
 * one selected Windsor account.
 */
export async function getConnectorData(
  def: WindsorSourceDef,
  fieldIds: string[],
  accountId: string
): Promise<WindsorConnectorData> {
  const accounts = [accountId];
  const [totalsRows, breakdown] = await Promise.all([
    fetchData({
      source: def.slug,
      fields: fieldIds,
      accounts,
      datePreset: "last_30d",
    }),
    fetchData({
      source: def.slug,
      fields: [def.dimension, ...fieldIds],
      accounts,
      datePreset: "last_30d",
    }),
  ]);
  const sortKey = fieldIds[0];
  const rows = breakdown
    .slice()
    .sort((a, b) => toNumber(b[sortKey]) - toNumber(a[sortKey]))
    .slice(0, 10);
  return { rangeLabel: "Last 30 days", totals: totalsRows[0] ?? {}, rows };
}

export interface WindsorSnapshot {
  totals: WindsorRow;
  prevTotals: WindsorRow;
}

/**
 * Current vs previous window totals for one selected Windsor account (for
 * month-over-month digests).
 */
export async function getSnapshot(
  source: string,
  fieldIds: string[],
  accountId: string,
  current: { startDate: string; endDate: string },
  previous: { startDate: string; endDate: string }
): Promise<WindsorSnapshot> {
  const accounts = [accountId];
  const [curRows, prevRows] = await Promise.all([
    fetchData({
      source,
      fields: fieldIds,
      accounts,
      dateFrom: current.startDate,
      dateTo: current.endDate,
    }),
    fetchData({
      source,
      fields: fieldIds,
      accounts,
      dateFrom: previous.startDate,
      dateTo: previous.endDate,
    }),
  ]);
  return { totals: curRows[0] ?? {}, prevTotals: prevRows[0] ?? {} };
}
