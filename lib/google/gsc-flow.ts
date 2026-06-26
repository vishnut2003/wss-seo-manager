/** Shared constants/helpers for the Google Search Console OAuth flow. */

export const GSC_PROVIDER = "google-search-console" as const;

/** Short-lived httpOnly cookie holding the CSRF nonce during the handshake. */
export const STATE_COOKIE = "gsc_oauth_state";

const CALLBACK_PATH = "/api/connectors/google-search-console/callback";

/** Exact redirect URI registered in the Google Cloud OAuth client. */
export function buildRedirectUri(origin: string): string {
  return `${origin}${CALLBACK_PATH}`;
}

/** The connector page a flow returns to (optionally with an error flag). */
export function connectorPath(projectId: string, error?: string): string {
  const base = `/projects/${projectId}/connectors/google-search-console`;
  return error ? `${base}?error=${encodeURIComponent(error)}` : base;
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
    if (typeof parsed.projectId === "string" && typeof parsed.nonce === "string") {
      return { projectId: parsed.projectId, nonce: parsed.nonce };
    }
    return null;
  } catch {
    return null;
  }
}
