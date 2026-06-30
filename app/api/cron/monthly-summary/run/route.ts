import { after, NextResponse, type NextRequest } from "next/server";
import { runMonthlySummary } from "@/lib/notifications/monthly-summary";

/**
 * Per-project worker. Runs the summary after responding so the dispatcher
 * never blocks; each invocation gets its own ≤60s budget.
 */
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { projectId } = (await request.json().catch(() => ({}))) as {
    projectId?: string;
  };
  if (!projectId) {
    return new NextResponse("Missing projectId", { status: 400 });
  }

  after(async () => {
    try {
      await runMonthlySummary(projectId);
    } catch {
      // Errors are recorded as lastStatus inside runMonthlySummary.
    }
  });

  return new NextResponse(null, { status: 202 });
}
