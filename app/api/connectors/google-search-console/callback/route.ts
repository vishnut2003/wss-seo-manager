import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Connection from "@/models/Connection";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, fetchUserInfo } from "@/lib/google/oauth";
import {
  GSC_PROVIDER,
  STATE_COOKIE,
  buildRedirectUri,
  connectorPath,
  decodeState,
} from "@/lib/google/gsc-flow";

function isManager(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

function redirectTo(request: NextRequest, path: string): NextResponse {
  const res = NextResponse.redirect(new URL(path, request.nextUrl.origin));
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const stateRaw = params.get("state") ?? "";
  const decoded = decodeState(stateRaw);

  // Without a decodable state we can't know which project to return to.
  if (!decoded || !isValidObjectId(decoded.projectId)) {
    return redirectTo(request, "/projects");
  }
  const { projectId, nonce } = decoded;

  const session = await auth();
  if (!session?.user || !isManager(session.user.role)) {
    return redirectTo(request, connectorPath(projectId, "forbidden"));
  }

  // User declined consent at Google.
  if (params.get("error")) {
    return redirectTo(request, connectorPath(projectId, "access_denied"));
  }

  // CSRF: the nonce in state must match the httpOnly cookie.
  const cookieNonce = request.cookies.get(STATE_COOKIE)?.value;
  if (!cookieNonce || cookieNonce !== nonce) {
    return redirectTo(request, connectorPath(projectId, "invalid_state"));
  }

  const code = params.get("code");
  if (!code) {
    return redirectTo(request, connectorPath(projectId, "missing_code"));
  }

  try {
    const redirectUri = buildRedirectUri(request.nextUrl.origin);
    const tokens = await exchangeCode({ code, redirectUri });
    if (!tokens.refresh_token) {
      return redirectTo(request, connectorPath(projectId, "no_refresh_token"));
    }

    const { email } = await fetchUserInfo(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await connectDB();
    await Connection.findOneAndUpdate(
      { projectId, provider: GSC_PROVIDER },
      {
        // siteUrl is intentionally untouched so a reconnect keeps the selection.
        accountEmail: email,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt,
        scope: tokens.scope,
        connectedBy: session.user.email ?? "unknown",
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return redirectTo(request, connectorPath(projectId));
  } catch {
    return redirectTo(request, connectorPath(projectId, "connection_failed"));
  }
}
