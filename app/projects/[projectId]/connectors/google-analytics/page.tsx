import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { BarChart3, Activity, Users, Eye, Clock } from "lucide-react";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import Connection, { type IConnection } from "@/models/Connection";
import {
  connectHref,
  connectorPath,
  type ConnectorProvider,
} from "@/lib/google/connector-flow";
import { GoogleReconnectError, getValidAccessToken } from "@/lib/google/oauth";
import {
  getConnectorData,
  listProperties,
  type GaConnectorData,
  type GaProperty,
} from "@/lib/google/analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectCard } from "@/components/ui-elements/connectors/connect-card";
import { ConnectionHeader } from "@/components/ui-elements/connectors/connection-header";
import { PropertySelector } from "@/components/ui-elements/connectors/property-selector";
import { MetricCards } from "@/components/ui-elements/connectors/metric-cards";
import { AnalyticsTable } from "@/components/ui-elements/connectors/analytics-table";
import { OAuthErrorToast } from "@/components/ui-elements/connectors/oauth-error-toast";
import {
  formatDuration,
  formatNumber,
} from "@/components/ui-elements/connectors/format";
import { disconnectGa, selectProperty } from "./actions";

const PROVIDER: ConnectorProvider = "google-analytics";
const LABEL = "Google Analytics";
type ConnectionLean = IConnection & { _id: unknown };

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {LABEL}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect a Google account to sync sessions, users, and traffic data for
        this project.
      </p>
    </div>
  );
}

export default async function GaConnectorPage({
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
    provider: PROVIDER,
  }).lean<ConnectionLean | null>();

  const errorBanner = errorCode ? (
    <OAuthErrorToast
      error={errorCode}
      basePath={connectorPath(projectId, PROVIDER)}
    />
  ) : null;

  if (!connection) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        {errorBanner}
        <PageHeader />
        <ConnectCard
          connectHref={connectHref(projectId, PROVIDER)}
          label={LABEL}
          description="Authorize a Google account to pull sessions, users, and traffic data for this project."
          icon={BarChart3}
          canManage={canManage}
        />
      </div>
    );
  }

  type FetchState =
    | { kind: "ok"; properties: GaProperty[]; data: GaConnectorData | null }
    | { kind: "reconnect" }
    | { kind: "error" };

  let state: FetchState;
  try {
    const accessToken = await getValidAccessToken(connection);
    const properties = await listProperties(accessToken);
    const data = connection.propertyId
      ? await getConnectorData(accessToken, connection.propertyId)
      : null;
    state = { kind: "ok", properties, data };
  } catch (err) {
    state =
      err instanceof GoogleReconnectError
        ? { kind: "reconnect" }
        : { kind: "error" };
  }

  if (state.kind === "reconnect") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        {errorBanner}
        <PageHeader />
        <ConnectCard
          connectHref={connectHref(projectId, PROVIDER)}
          label={LABEL}
          description=""
          icon={BarChart3}
          canManage={canManage}
          reconnect
        />
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
          providerLabel={LABEL}
          canManage={canManage}
          onDisconnect={disconnectGa}
        />
        <Card className="border-destructive/30 shadow-xl shadow-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">
              Couldn&apos;t load Analytics data
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

  const { properties, data } = state;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      {errorBanner}
      <PageHeader />

      <ConnectionHeader
        projectId={projectId}
        accountEmail={connection.accountEmail}
        providerLabel={LABEL}
        canManage={canManage}
        onDisconnect={disconnectGa}
      />

      <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
        <CardHeader>
          <CardTitle className="text-base">Property</CardTitle>
          <CardDescription>
            Choose which GA4 property maps to this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertySelector
            projectId={projectId}
            items={properties.map((p) => ({
              value: p.propertyId,
              label: `${p.displayName} (${p.propertyId.replace("properties/", "")})`,
            }))}
            currentValue={connection.propertyId}
            canManage={canManage}
            onSelect={selectProperty}
            label="Property"
            placeholder="Select a GA4 property"
            emptyPlaceholder="No properties available for this account"
          />
        </CardContent>
      </Card>

      {data && (
        <>
          <MetricCards
            rangeLabel={data.rangeLabel}
            metrics={[
              {
                icon: Activity,
                label: "Sessions",
                value: formatNumber(data.totals.sessions),
              },
              {
                icon: Users,
                label: "Total users",
                value: formatNumber(data.totals.totalUsers),
              },
              {
                icon: Eye,
                label: "Page views",
                value: formatNumber(data.totals.screenPageViews),
              },
              {
                icon: Clock,
                label: "Avg. session",
                value: formatDuration(data.totals.averageSessionDuration),
              },
            ]}
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AnalyticsTable
              title="Top pages"
              dimensionLabel="Page"
              columns={["Views"]}
              rows={data.topPages.map((r) => ({
                dimension: r.dimension,
                cells: [formatNumber(r.metric)],
              }))}
            />
            <AnalyticsTable
              title="Top channels"
              dimensionLabel="Channel"
              columns={["Sessions"]}
              rows={data.topChannels.map((r) => ({
                dimension: r.dimension,
                cells: [formatNumber(r.metric)],
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
