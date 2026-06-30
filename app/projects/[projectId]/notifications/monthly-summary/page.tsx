import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { CalendarRange } from "lucide-react";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import Connection, { type IConnection } from "@/models/Connection";
import NotificationSetting, {
  type INotificationSetting,
} from "@/models/NotificationSetting";
import { connectorPath } from "@/lib/google/connector-flow";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MonthlySummaryForm } from "./_components/monthly-summary-form";

const TYPE = "monthly-summary" as const;

const SUPPORTED = [
  { provider: "google-search-console", label: "Google Search Console" },
  { provider: "google-analytics", label: "Google Analytics" },
] as const;

export default async function MonthlySummaryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  if (!isValidObjectId(projectId)) {
    notFound();
  }

  await connectDB();
  const project = await Project.findById(projectId)
    .select("name")
    .lean<{ name: string } | null>();
  if (!project) {
    notFound();
  }

  const session = await auth();
  const role = session?.user?.role;
  const canManage = role === "super_admin" || role === "admin";

  const [setting, connections] = await Promise.all([
    NotificationSetting.findOne({
      projectId,
      type: TYPE,
    }).lean<INotificationSetting | null>(),
    Connection.find({ projectId }).lean<IConnection[]>(),
  ]);

  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  const connectors = SUPPORTED.map(({ provider, label }) => {
    const conn = byProvider.get(provider);
    const configured =
      provider === "google-search-console"
        ? Boolean(conn?.siteUrl)
        : Boolean(conn?.propertyId);
    return {
      provider,
      label,
      configured,
      enabled: setting?.enabledConnectors?.includes(provider) ?? false,
      manageHref: connectorPath(projectId, provider),
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Monthly Summary
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A monthly email digest of this project&apos;s search and traffic
          performance, with month-over-month trends.
        </p>
      </div>

      <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
          <CardDescription>What happens when this is enabled.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <CalendarRange className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              On the 3rd of each month (around 6:00 AM), we pull the previous
              full calendar month of data from each connector you enable below,
              compare it against the month before, ask Claude to write a short,
              readable digest, and email it to your recipients via Resend.
            </p>
          </div>
          <p>
            We run a few days into the month so Google Search Console data
            (which lags ~2–3 days) has settled for the final days of the period.
          </p>
        </CardContent>
      </Card>

      <MonthlySummaryForm
        projectId={projectId}
        canManage={canManage}
        enabled={setting?.enabled ?? false}
        recipients={(setting?.recipients ?? []).join(", ")}
        connectors={connectors}
      />
    </div>
  );
}
