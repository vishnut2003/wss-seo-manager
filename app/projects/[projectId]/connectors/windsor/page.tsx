import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import {
  MousePointerClick,
  Eye,
  DollarSign,
  Percent,
  Target,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import Connection, {
  type IConnection,
  type WindsorAccountSelection,
} from "@/models/Connection";
import {
  getConnectorData,
  getSourceDef,
  isWindsorConfigured,
  listConnectedAccounts,
  resolveFields,
  stripSourcePrefix,
  formatWindsorValue,
  type WindsorConnectorData,
  type WindsorSourceAccounts,
  type WindsorSourceDef,
} from "@/lib/windsor/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectionHeader } from "@/components/ui-elements/connectors/connection-header";
import { MetricCards } from "@/components/ui-elements/connectors/metric-cards";
import { AnalyticsTable } from "@/components/ui-elements/connectors/analytics-table";
import { WindsorConnectCard } from "@/components/ui-elements/connectors/windsor-connect-card";
import { WindsorAccountPicker } from "@/components/ui-elements/connectors/windsor-account-picker";
import { WindsorFieldToggles } from "@/components/ui-elements/connectors/windsor-field-toggles";
import {
  connectWindsor,
  disconnectWindsor,
  setWindsorAccounts,
  setWindsorAccountFields,
} from "./actions";

const LABEL = "Windsor.ai";
type ConnectionLean = IConnection & { _id: unknown };

const METRIC_ICONS: Record<string, LucideIcon> = {
  clicks: MousePointerClick,
  impressions: Eye,
  spend: DollarSign,
  cpc: DollarSign,
  ctr: Percent,
  conversions: Target,
};

function iconFor(fieldId: string): LucideIcon {
  return METRIC_ICONS[fieldId] ?? Activity;
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {LABEL}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pull unified cross-channel marketing data from your Windsor.ai account
        into this project.
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      {children}
    </div>
  );
}

function accountLabel(selection: WindsorAccountSelection): string {
  return selection.accountName ?? selection.accountId;
}

async function AccountBlock({
  projectId,
  def,
  selection,
  canManage,
}: {
  projectId: string;
  def: WindsorSourceDef;
  selection: WindsorAccountSelection;
  canManage: boolean;
}) {
  const fieldIds = resolveFields(def, selection.fields);
  const metricById = new Map(def.metrics.map((m) => [m.id, m]));

  let data: WindsorConnectorData | null = null;
  try {
    data = await getConnectorData(def, fieldIds, selection.accountId);
  } catch {
    return (
      <Card className="border-destructive/30 shadow-xl shadow-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">
            {def.label} · {accountLabel(selection)}
          </CardTitle>
          <CardDescription>
            Couldn&apos;t load data for this account from Windsor.ai. Please
            refresh, or verify the account is still connected in your
            Windsor.ai workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MetricCards
        rangeLabel={`${def.label} · ${accountLabel(selection)} · ${data.rangeLabel}`}
        metrics={fieldIds.map((id) => {
          const m = metricById.get(id);
          return {
            icon: iconFor(id),
            label: m?.label ?? id,
            value: formatWindsorValue(data.totals[id], m?.format ?? "number"),
          };
        })}
      />
      <AnalyticsTable
        title={`Top ${def.dimensionLabel.toLowerCase()}s · ${accountLabel(selection)}`}
        dimensionLabel={def.dimensionLabel}
        columns={fieldIds.map((id) => metricById.get(id)?.label ?? id)}
        rows={data.rows.map((row) => ({
          dimension: String(row[def.dimension] ?? ""),
          cells: fieldIds.map((id) =>
            formatWindsorValue(row[id], metricById.get(id)?.format ?? "number")
          ),
        }))}
      />
      <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
        <CardContent className="pt-6">
          <WindsorFieldToggles
            projectId={projectId}
            source={selection.source}
            accountId={selection.accountId}
            options={def.metrics.map((m) => ({ id: m.id, label: m.label }))}
            selected={fieldIds}
            canManage={canManage}
            onSave={setWindsorAccountFields}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function WindsorConnectorPage({
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

  // App-wide key missing → nothing to connect to.
  if (!isWindsorConfigured()) {
    return (
      <Shell>
        <PageHeader />
        <Card className="border-amber-200 shadow-xl shadow-amber-900/5">
          <CardHeader>
            <CardTitle className="text-base">Windsor.ai not configured</CardTitle>
            <CardDescription>
              A <code>WINDSOR_API_KEY</code> hasn&apos;t been set on the server.
              Ask a super-admin to add it to the environment before connecting
              this source.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  const connection = await Connection.findOne({
    projectId,
    provider: "windsor",
  }).lean<ConnectionLean | null>();

  if (!connection) {
    return (
      <Shell>
        <PageHeader />
        <WindsorConnectCard
          projectId={projectId}
          canManage={canManage}
          onConnect={connectWindsor}
        />
      </Shell>
    );
  }

  const header = (
    <ConnectionHeader
      projectId={projectId}
      accountEmail={connection.accountEmail}
      providerLabel={LABEL}
      canManage={canManage}
      onDisconnect={disconnectWindsor}
    />
  );

  // Workspace accounts, grouped by source — the pool the project picks from.
  let groups: WindsorSourceAccounts[] | null = null;
  try {
    groups = await listConnectedAccounts();
  } catch {
    groups = null;
  }

  // Existing rows may hold ids/names saved with the ds-accounts `${source}__`
  // prefix; strip it so pre-checks match and labels read cleanly.
  const selections: WindsorAccountSelection[] = (
    connection.windsorAccounts ?? []
  ).map((s) => ({
    ...s,
    accountId: stripSourcePrefix(s.source, s.accountId),
    accountName: s.accountName
      ? stripSourcePrefix(s.source, s.accountName)
      : undefined,
  }));

  const accountsCard = (
    <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
      <CardHeader>
        <CardTitle className="text-base">Accounts</CardTitle>
        <CardDescription>
          Choose which Windsor.ai accounts belong to this project. Data is
          pulled only for the selected accounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups === null ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t load the account list from Windsor.ai. Refresh to try
            again.
          </p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No accounts are connected in your Windsor.ai workspace yet. Connect
            data sources at windsor.ai first.
          </p>
        ) : (
          <WindsorAccountPicker
            projectId={projectId}
            groups={groups.map((g) => ({
              source: g.source,
              sourceLabel: g.sourceLabel,
              accounts: g.accounts,
            }))}
            selected={selections.map((s) => ({
              source: s.source,
              accountId: s.accountId,
              accountName: s.accountName,
            }))}
            canManage={canManage}
            onSave={setWindsorAccounts}
          />
        )}
      </CardContent>
    </Card>
  );

  const blocks = selections.flatMap((selection) => {
    const def = getSourceDef(selection.source);
    if (!def) return [];
    return [
      <AccountBlock
        key={`${selection.source}-${selection.accountId}`}
        projectId={projectId}
        def={def}
        selection={selection}
        canManage={canManage}
      />,
    ];
  });

  return (
    <Shell>
      <PageHeader />
      {header}
      {accountsCard}
      {blocks.length === 0 ? (
        <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
          <CardHeader>
            <CardTitle className="text-base">No accounts selected</CardTitle>
            <CardDescription>
              Select one or more accounts above to pull their data into this
              project.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        blocks
      )}
    </Shell>
  );
}
