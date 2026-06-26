import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import Connection, { type IConnection } from "@/models/Connection";
import { GSC_PROVIDER } from "@/lib/google/gsc-flow";
import { GoogleReconnectError, getValidAccessToken } from "@/lib/google/oauth";
import {
  getConnectorData,
  listSites,
  type ConnectorData,
  type GscSite,
} from "@/lib/google/search-console";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectCard } from "./_components/connect-card";
import { ConnectionHeader } from "./_components/connection-header";
import { PropertySelector } from "./_components/property-selector";
import { AnalyticsOverview } from "./_components/analytics-overview";
import { SearchAnalyticsTable } from "./_components/search-analytics-table";
import { OAuthErrorToast } from "./_components/oauth-error-toast";

type ConnectionLean = IConnection & { _id: unknown };

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Google Search Console
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect a Google account to sync clicks, impressions, and ranking data
        for this project.
      </p>
    </div>
  );
}

export default async function GscConnectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { projectId } = await params;
  const { error } = await searchParams;
  const errorCode = Array.isArray(error) ? error[0] : error;

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

  const connection = await Connection.findOne({
    projectId,
    provider: GSC_PROVIDER,
  }).lean<ConnectionLean | null>();

  const errorBanner = errorCode ? (
    <OAuthErrorToast error={errorCode} projectId={projectId} />
  ) : null;

  // Not connected yet.
  if (!connection) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        {errorBanner}
        <PageHeader />
        <ConnectCard projectId={projectId} canManage={canManage} />
      </div>
    );
  }

  // Connected: fetch a valid token and pull data. A revoked/expired refresh
  // token surfaces as a reconnect prompt. Data is gathered before any JSX is
  // built so the try/catch only wraps the async work.
  type FetchState =
    | { kind: "ok"; sites: GscSite[]; data: ConnectorData | null }
    | { kind: "reconnect" }
    | { kind: "error" };

  let state: FetchState;
  try {
    const accessToken = await getValidAccessToken(connection);
    const sites = await listSites(accessToken);
    const data = connection.siteUrl
      ? await getConnectorData(accessToken, connection.siteUrl)
      : null;
    state = { kind: "ok", sites, data };
  } catch (err) {
    state = err instanceof GoogleReconnectError
      ? { kind: "reconnect" }
      : { kind: "error" };
  }

  if (state.kind === "reconnect") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        {errorBanner}
        <PageHeader />
        <ConnectCard projectId={projectId} canManage={canManage} reconnect />
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        {errorBanner}
        <PageHeader />
        <ConnectionHeader
          projectId={projectId}
          accountEmail={connection.accountEmail}
          canManage={canManage}
        />
        <Card className="border-destructive/30 shadow-xl shadow-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">
              Couldn&apos;t load Search Console data
            </CardTitle>
            <CardDescription>
              Something went wrong talking to Google. Please refresh, or
              disconnect and reconnect the account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { sites, data } = state;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      {errorBanner}
      <PageHeader />

      <ConnectionHeader
        projectId={projectId}
        accountEmail={connection.accountEmail}
        canManage={canManage}
      />

      <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
        <CardHeader>
          <CardTitle className="text-base">Property</CardTitle>
          <CardDescription>
            Choose which Search Console property maps to this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertySelector
            projectId={projectId}
            sites={sites}
            currentSiteUrl={connection.siteUrl}
            canManage={canManage}
          />
        </CardContent>
      </Card>

      {data && (
        <>
          <AnalyticsOverview totals={data.totals} range={data.range} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SearchAnalyticsTable
              title="Top queries"
              dimensionLabel="Query"
              rows={data.topQueries}
            />
            <SearchAnalyticsTable
              title="Top pages"
              dimensionLabel="Page"
              rows={data.topPages}
            />
          </div>
        </>
      )}
    </div>
  );
}
