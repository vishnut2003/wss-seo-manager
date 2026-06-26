/** Display formatters for Search Console metrics. */

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

export function formatCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}

export function formatPosition(position: number): string {
  return position.toFixed(1);
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
  return OAUTH_ERROR_MESSAGES[code] ?? "Failed to connect Google Search Console.";
}
