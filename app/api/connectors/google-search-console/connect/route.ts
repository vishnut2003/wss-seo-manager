import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { buildAuthUrl } from "@/lib/google/oauth";
import {
  STATE_COOKIE,
  buildRedirectUri,
  encodeState,
} from "@/lib/google/gsc-flow";

function isManager(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

export async function GET(request: NextRequest) {
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
  const redirectUri = buildRedirectUri(request.nextUrl.origin);

  const res = NextResponse.redirect(buildAuthUrl({ state, redirectUri }));
  res.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
