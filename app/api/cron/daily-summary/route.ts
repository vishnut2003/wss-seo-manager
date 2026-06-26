import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/configs/db";
import NotificationSetting from "@/models/NotificationSetting";

/**
 * Cron dispatcher (Vercel cron → GET). Finds every project with the daily
 * summary enabled and fans out to the per-project worker so each runs in its
 * own ≤60s invocation. Returns quickly without awaiting the heavy work.
 */
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  await connectDB();
  const settings = await NotificationSetting.find({
    type: "daily-summary",
    enabled: true,
  })
    .select("projectId")
    .lean<{ projectId: string }[]>();

  const origin = request.nextUrl.origin;
  const secret = process.env.CRON_SECRET as string;

  await Promise.allSettled(
    settings.map((s) =>
      fetch(`${origin}/api/cron/daily-summary/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId: s.projectId }),
      })
    )
  );

  return NextResponse.json({ dispatched: settings.length });
}
