import Connection from "@/models/Connection";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * Standalone Google OAuth 2.0 client for connecting a Google account to a
 * project (authorization, not app login). Uses native fetch — no googleapis
 * dependency. Server-only.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

/** Read-only Search Console access plus identity to record the account email. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "openid",
  "email",
].join(" ");

/** Refresh tokens slightly before expiry to avoid edge-of-window failures. */
const EXPIRY_BUFFER_MS = 60_000;

/** Thrown when Google rejects our credentials and the user must reconnect. */
export class GoogleReconnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleReconnectError";
  }
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables"
    );
  }
  return { clientId, clientSecret };
}

export function buildAuthUrl({
  state,
  redirectUri,
}: {
  state: string;
  redirectUri: string;
}): string {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status})`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (res.status === 400 || res.status === 401) {
    // invalid_grant — token revoked or expired; the user must reconnect.
    throw new GoogleReconnectError("Google authorization has expired");
  }
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status})`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function fetchUserInfo(
  accessToken: string
): Promise<{ email: string }> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google account info (${res.status})`);
  }
  const data = (await res.json()) as { email?: string };
  if (!data.email) {
    throw new Error("Google account did not return an email address");
  }
  return { email: data.email };
}

interface StoredConnection {
  _id: unknown;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Returns a usable (decrypted) access token, transparently refreshing and
 * persisting a new one when the stored token is expired. Throws
 * GoogleReconnectError if the refresh token is no longer valid.
 */
export async function getValidAccessToken(
  connection: StoredConnection
): Promise<string> {
  const notExpired =
    connection.expiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now();
  if (notExpired) {
    return decrypt(connection.accessToken);
  }

  const refreshToken = decrypt(connection.refreshToken);
  const refreshed = await refreshAccessToken(refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await Connection.findByIdAndUpdate(connection._id, {
    accessToken: encrypt(refreshed.access_token),
    expiresAt,
  });

  return refreshed.access_token;
}
