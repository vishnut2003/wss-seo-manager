import {
  ANALYTICS_SCOPES,
  GOOGLE_ADS_SCOPES,
  SEARCH_CONSOLE_SCOPES,
} from "@/lib/google/oauth";

/**
 * Shared, provider-parameterized helpers for the Google OAuth connector flows.
 * The provider slug doubles as the URL path segment (`/connectors/<slug>` and
 * `/api/connectors/<slug>`) and the DB `provider` value.
 */

export type ConnectorProvider =
  | "google-search-console"
  | "google-analytics"
  | "google-ads";

export const CONNECTOR_CONFIG: Record<ConnectorProvider, { scope: string }> = {
  "google-search-console": { scope: SEARCH_CONSOLE_SCOPES },
  "google-analytics": { scope: ANALYTICS_SCOPES },
  "google-ads": { scope: GOOGLE_ADS_SCOPES },
};

/** Per-provider httpOnly CSRF cookie so concurrent flows don't collide. */
export function stateCookie(provider: ConnectorProvider): string {
  return `${provider}-oauth-state`;
}

/** Exact redirect URI registered in the Google Cloud OAuth client. */
export function buildRedirectUri(
  origin: string,
  provider: ConnectorProvider
): string {
  return `${origin}/api/connectors/${provider}/callback`;
}

/** The connector page a flow returns to (optionally with an error flag). */
export function connectorPath(
  projectId: string,
  provider: ConnectorProvider,
  error?: string
): string {
  const base = `/projects/${projectId}/connectors/${provider}`;
  return error ? `${base}?error=${encodeURIComponent(error)}` : base;
}

/** URL the Connect button points to (full navigation → connect route). */
export function connectHref(
  projectId: string,
  provider: ConnectorProvider
): string {
  return `/api/connectors/${provider}/connect?projectId=${projectId}`;
}

export interface OAuthState {
  projectId: string;
  nonce: string;
}

export function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeState(raw: string): OAuthState | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as Partial<OAuthState>;
    if (
      typeof parsed.projectId === "string" &&
      typeof parsed.nonce === "string"
    ) {
      return { projectId: parsed.projectId, nonce: parsed.nonce };
    }
    return null;
  } catch {
    return null;
  }
}
