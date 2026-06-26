import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Connection from "@/models/Connection";
import { encrypt } from "@/lib/crypto";
import { buildAuthUrl, exchangeCode, fetchUserInfo } from "@/lib/google/oauth";
import {
  CONNECTOR_CONFIG,
  buildRedirectUri,
  connectorPath,
  decodeState,
  encodeState,
  stateCookie,
  type ConnectorProvider,
} from "@/lib/google/connector-flow";

/**
 * Provider-agnostic OAuth route handlers shared by every Google connector.
 * The provider slug selects scope, cookie, paths, and the DB `provider` value.
 */

function isManager(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

/** GET /api/connectors/<provider>/connect?projectId=… */
export function createConnectHandler(provider: ConnectorProvider) {
  return async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(new URL("/", request.nextUrl.origin));
    }
    if (!isManager(session.user.role)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
    if (!isValidObjectId(projectId)) {
      return new NextResponse("Invalid project", { status: 400 });
    }

    const nonce = randomBytes(16).toString("hex");
    const state = encodeState({ projectId, nonce });
    const redirectUri = buildRedirectUri(request.nextUrl.origin, provider);

    const res = NextResponse.redirect(
      buildAuthUrl({ state, redirectUri, scope: CONNECTOR_CONFIG[provider].scope })
    );
    res.cookies.set(stateCookie(provider), nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  };
}

/** GET /api/connectors/<provider>/callback */
export function createCallbackHandler(provider: ConnectorProvider) {
  const cookieName = stateCookie(provider);

  function redirectTo(request: NextRequest, path: string): NextResponse {
    const res = NextResponse.redirect(new URL(path, request.nextUrl.origin));
    res.cookies.delete(cookieName);
    return res;
  }

  return async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const decoded = decodeState(params.get("state") ?? "");

    if (!decoded || !isValidObjectId(decoded.projectId)) {
      return redirectTo(request, "/projects");
    }
    const { projectId, nonce } = decoded;

    const session = await auth();
    if (!session?.user || !isManager(session.user.role)) {
      return redirectTo(request, connectorPath(projectId, provider, "forbidden"));
    }

    if (params.get("error")) {
      return redirectTo(
        request,
        connectorPath(projectId, provider, "access_denied")
      );
    }

    const cookieNonce = request.cookies.get(cookieName)?.value;
    if (!cookieNonce || cookieNonce !== nonce) {
      return redirectTo(
        request,
        connectorPath(projectId, provider, "invalid_state")
      );
    }

    const code = params.get("code");
    if (!code) {
      return redirectTo(
        request,
        connectorPath(projectId, provider, "missing_code")
      );
    }

    try {
      const redirectUri = buildRedirectUri(request.nextUrl.origin, provider);
      const tokens = await exchangeCode({ code, redirectUri });
      if (!tokens.refresh_token) {
        return redirectTo(
          request,
          connectorPath(projectId, provider, "no_refresh_token")
        );
      }

      const { email } = await fetchUserInfo(tokens.access_token);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      await connectDB();
      await Connection.findOneAndUpdate(
        { projectId, provider },
        {
          // siteUrl/propertyId left untouched so a reconnect keeps the selection.
          accountEmail: email,
          accessToken: encrypt(tokens.access_token),
          refreshToken: encrypt(tokens.refresh_token),
          expiresAt,
          scope: tokens.scope,
          connectedBy: session.user.email ?? "unknown",
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      return redirectTo(request, connectorPath(projectId, provider));
    } catch {
      return redirectTo(
        request,
        connectorPath(projectId, provider, "connection_failed")
      );
    }
  };
}
