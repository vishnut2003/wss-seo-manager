/** Display formatters shared across the data-source connectors. */

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

export function formatCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}

export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export function formatPosition(position: number): string {
  return position.toFixed(1);
}

/** Seconds → m:ss (e.g. 95 → "1:35"). */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Connection cancelled — you didn't approve access.",
  invalid_state: "The connection request expired. Please try again.",
  missing_code: "Google didn't return an authorization code. Please retry.",
  no_refresh_token:
    "Google didn't return a refresh token. Remove app access in your Google account, then reconnect.",
  forbidden: "You don't have permission to connect this project.",
  connection_failed: "Something went wrong connecting to Google. Please retry.",
};

export function oauthErrorMessage(code: string): string {
  return OAUTH_ERROR_MESSAGES[code] ?? "Failed to connect this data source.";
}
