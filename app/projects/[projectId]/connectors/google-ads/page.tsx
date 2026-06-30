import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { Megaphone, DollarSign, Eye, MousePointerClick, Gauge } from "lucide-react";
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
  listAccessibleCustomers,
  GoogleAdsConfigError,
  type AdsAccount,
  type AdsConnectorData,
} from "@/lib/google/ads";
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
  formatCurrency,
  formatNumber,
} from "@/components/ui-elements/connectors/format";
import { disconnectAds, selectAccount } from "./actions";

const PROVIDER: ConnectorProvider = "google-ads";
const LABEL = "Google Ads";
type ConnectionLean = IConnection & { _id: unknown };

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {LABEL}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect a Google account to sync campaign spend, clicks, and performance
        data for this project.
      </p>
    </div>
  );
}

export default async function AdsConnectorPage({
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
          description="Authorize a Google account to pull campaign spend, clicks, and performance data for this project."
          icon={Megaphone}
          canManage={canManage}
        />
      </div>
    );
  }

  type FetchState =
    | { kind: "ok"; accounts: AdsAccount[]; data: AdsConnectorData | null }
    | { kind: "reconnect" }
    | { kind: "config" }
    | { kind: "error" };

  let state: FetchState;
  try {
    const accessToken = await getValidAccessToken(connection);
    const accounts = await listAccessibleCustomers(accessToken);
    const data = connection.customerId
      ? await getConnectorData(
          accessToken,
          connection.customerId,
          connection.loginCustomerId
        )
      : null;
    state = { kind: "ok", accounts, data };
  } catch (err) {
    if (err instanceof GoogleReconnectError) {
      state = { kind: "reconnect" };
    } else if (err instanceof GoogleAdsConfigError) {
      state = { kind: "config" };
    } else {
      state = { kind: "error" };
    }
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
          icon={Megaphone}
          canManage={canManage}
          reconnect
        />
      </div>
    );
  }

  if (state.kind === "config") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        {errorBanner}
        <PageHeader />
        <ConnectionHeader
          projectId={projectId}
          accountEmail={connection.accountEmail}
          providerLabel={LABEL}
          canManage={canManage}
          onDisconnect={disconnectAds}
        />
        <Card className="border-amber-200 shadow-xl shadow-amber-900/5">
          <CardHeader>
            <CardTitle className="text-base">
              Google Ads API access not configured
            </CardTitle>
            <CardDescription>
              The account is connected, but a Google Ads developer token is
              required to read campaign data. An administrator needs to set
              <span className="font-mono"> GOOGLE_ADS_DEVELOPER_TOKEN </span>
              and have it approved for Basic Access. Account selection and
              metrics will appear here automatically once that&apos;s in place.
            </CardDescription>
          </CardHeader>
        </Card>
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
          onDisconnect={disconnectAds}
        />
        <Card className="border-destructive/30 shadow-xl shadow-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">
              Couldn&apos;t load Google Ads data
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

  const { accounts, data } = state;
  const currencyCode = data?.currencyCode ?? connection.currencyCode;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      {errorBanner}
      <PageHeader />

      <ConnectionHeader
        projectId={projectId}
        accountEmail={connection.accountEmail}
        providerLabel={LABEL}
        canManage={canManage}
        onDisconnect={disconnectAds}
      />

      <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            Choose which Google Ads account maps to this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertySelector
            projectId={projectId}
            items={accounts.map((a) => ({
              value: a.customerId,
              label: a.displayName,
            }))}
            currentValue={connection.customerId}
            canManage={canManage}
            onSelect={selectAccount}
            label="Account"
            placeholder="Select a Google Ads account"
            emptyPlaceholder="No accounts available for this user"
          />
        </CardContent>
      </Card>

      {data && (
        <>
          <MetricCards
            rangeLabel={data.rangeLabel}
            metrics={[
              {
                icon: DollarSign,
                label: "Spend",
                value: formatCurrency(data.totals.spend, currencyCode),
              },
              {
                icon: Eye,
                label: "Impressions",
                value: formatNumber(data.totals.impressions),
              },
              {
                icon: MousePointerClick,
                label: "Clicks",
                value: formatNumber(data.totals.clicks),
              },
              {
                icon: Gauge,
                label: "Avg. CPC",
                value: formatCurrency(data.totals.avgCpc, currencyCode),
              },
            ]}
          />
          <AnalyticsTable
            title="Top campaigns"
            dimensionLabel="Campaign"
            columns={["Spend", "Impressions", "Clicks"]}
            rows={data.topCampaigns.map((r) => ({
              dimension: r.campaignName,
              cells: [
                formatCurrency(r.spend, currencyCode),
                formatNumber(r.impressions),
                formatNumber(r.clicks),
              ],
            }))}
          />
        </>
      )}
    </div>
  );
}
