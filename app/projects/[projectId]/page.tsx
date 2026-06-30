import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  MousePointerClick,
  Eye,
  Percent,
  TrendingUp,
  Users,
  UserPlus,
  FileText,
  Timer,
  Search,
  BarChart3,
  Megaphone,
  CalendarDays,
  CalendarRange,
  Trophy,
  FileBarChart,
  Network,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import { connectorPath } from "@/lib/google/connector-flow";
import {
  getProjectDashboard,
  trendPct,
} from "@/lib/google/dashboard-data";
import {
  formatCtr,
  formatDuration,
  formatNumber,
  formatPosition,
} from "@/components/ui-elements/connectors/format";
import {
  StatCard,
  StatCardGrid,
  type StatCardProps,
} from "@/components/ui-elements/dashboard/stat-card";
import {
  TrendAreaChart,
  StatusDonutChart,
  type TrendSeries,
  type DonutSlice,
} from "@/components/ui-elements/dashboard/dashboard-charts";

const SLICE_PALETTE = [
  "#8C00FF",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#6366f1",
  "#94a3b8",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface QuickLink {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export default async function ProjectDashboardPage({
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
    .select("name domain")
    .lean<{ name: string; domain: string } | null>();
  if (!project) {
    notFound();
  }

  const session = await auth();
  const role = session?.user?.role;
  const canManage = role === "super_admin" || role === "admin";
  const firstName = session?.user?.name?.split(" ")[0];

  const { gsc, ga, hasData } = await getProjectDashboard(projectId);

  // KPI cards — prefer GSC, fall back to GA.
  let kpis: StatCardProps[] = [];
  if (gsc.status === "ok" && gsc.totals) {
    const t = gsc.totals;
    const p = gsc.prevTotals;
    kpis = [
      {
        icon: MousePointerClick,
        label: "Clicks",
        value: formatNumber(t.clicks),
        trend: trendPct(t.clicks, p?.clicks ?? 0),
        hint: "vs prev 28 days",
      },
      {
        icon: Eye,
        label: "Impressions",
        value: formatNumber(t.impressions),
        trend: trendPct(t.impressions, p?.impressions ?? 0),
        hint: "vs prev 28 days",
      },
      {
        icon: Percent,
        label: "Avg. CTR",
        value: formatCtr(t.ctr),
        trend: trendPct(t.ctr, p?.ctr ?? 0),
        hint: "vs prev 28 days",
      },
      {
        icon: TrendingUp,
        label: "Avg. position",
        value: formatPosition(t.position),
        // Lower position is better → invert so an improvement reads positive.
        trend: p?.position ? ((p.position - t.position) / p.position) * 100 : null,
        hint: "vs prev 28 days",
      },
    ];
  } else if (ga.status === "ok" && ga.totals) {
    const t = ga.totals;
    const p = ga.prevTotals;
    kpis = [
      {
        icon: Users,
        label: "Sessions",
        value: formatNumber(t.sessions),
        trend: trendPct(t.sessions, p?.sessions ?? 0),
        hint: "vs prev 28 days",
      },
      {
        icon: UserPlus,
        label: "Total users",
        value: formatNumber(t.totalUsers),
        trend: trendPct(t.totalUsers, p?.totalUsers ?? 0),
        hint: "vs prev 28 days",
      },
      {
        icon: FileText,
        label: "Page views",
        value: formatNumber(t.screenPageViews),
        trend: trendPct(t.screenPageViews, p?.screenPageViews ?? 0),
        hint: "vs prev 28 days",
      },
      {
        icon: Timer,
        label: "Avg. session",
        value: formatDuration(t.averageSessionDuration),
        trend: trendPct(
          t.averageSessionDuration,
          p?.averageSessionDuration ?? 0
        ),
        hint: "vs prev 28 days",
      },
    ];
  }

  // Trend chart — clicks (GSC) + sessions (GA), aligned by month.
  const labels = gsc.monthly?.map((m) => m.label) ??
    ga.monthly?.map((m) => m.label) ?? [];
  const trendData = labels.map((label, i) => ({
    label,
    clicks: gsc.monthly?.[i]?.clicks ?? 0,
    sessions: ga.monthly?.[i]?.sessions ?? 0,
  }));
  const trendSeries: TrendSeries[] = [
    ...(gsc.status === "ok"
      ? [{ key: "clicks", name: "Search clicks", color: "#8C00FF" }]
      : []),
    ...(ga.status === "ok"
      ? [{ key: "sessions", name: "Sessions", color: "#0ea5e9" }]
      : []),
  ];

  // Mix donut — GA channels, else GSC top queries by clicks.
  const channelSlices: DonutSlice[] = (ga.topChannels ?? [])
    .slice(0, 6)
    .map((c, i) => ({
      name: c.dimension || "(other)",
      value: c.metric,
      color: SLICE_PALETTE[i % SLICE_PALETTE.length],
    }));
  const querySlices: DonutSlice[] = (gsc.topQueries ?? [])
    .slice(0, 6)
    .map((q, i) => ({
      name: q.keys?.[0] ?? "",
      value: q.clicks,
      color: SLICE_PALETTE[i % SLICE_PALETTE.length],
    }));
  const donutSlices = channelSlices.length ? channelSlices : querySlices;
  const donutTitle = channelSlices.length ? "Traffic channels" : "Top queries";
  const donutSubtitle = channelSlices.length
    ? "Sessions by channel"
    : "Clicks by query";

  // Ranked top queries (bars).
  const topQueries = (gsc.topQueries ?? []).slice(0, 5);
  const topQueryMax = topQueries[0]?.clicks ?? 0;

  const quickLinks: QuickLink[] = [
    {
      label: "Search Console",
      description: "Clicks & rankings",
      href: connectorPath(projectId, "google-search-console"),
      icon: Search,
    },
    {
      label: "Analytics",
      description: "Traffic & sessions",
      href: connectorPath(projectId, "google-analytics"),
      icon: BarChart3,
    },
    {
      label: "Google Ads",
      description: "Campaign spend",
      href: connectorPath(projectId, "google-ads"),
      icon: Megaphone,
    },
    {
      label: "Daily Summary",
      description: "Daily digest email",
      href: `/projects/${projectId}/notifications/daily-summary`,
      icon: CalendarDays,
    },
    {
      label: "Monthly Summary",
      description: "Monthly digest email",
      href: `/projects/${projectId}/notifications/monthly-summary`,
      icon: CalendarRange,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary via-purple-800 to-purple-900 p-6 text-white shadow-xl shadow-purple-900/20 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                {greeting()}
              </span>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back
                {firstName ? <span className="text-purple-200">, {firstName}</span> : ""}.
              </h1>
              <p className="max-w-xl text-sm text-white/80">
                Here&apos;s how <strong>{project.name}</strong> ({project.domain})
                is performing across your connected search and traffic sources.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={connectorPath(projectId, "google-search-console")}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-lg transition hover:bg-purple-50"
              >
                <Search className="h-4 w-4" />
                Connectors
              </Link>
              <Link
                href={`/projects/${projectId}/notifications/monthly-summary`}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Monthly summary
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {!hasData ? (
          <section className="relative overflow-hidden rounded-3xl border border-purple-100 bg-white p-10 text-center shadow-xl shadow-purple-900/5">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-900 text-white shadow-lg shadow-primary/30">
                <Network className="size-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Connect a data source to see metrics
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {gsc.status === "reconnect" || ga.status === "reconnect"
                    ? "A Google connection expired — reconnect it to resume syncing."
                    : "Link Google Search Console or Analytics to populate this dashboard."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href={connectorPath(projectId, "google-search-console")}
                  className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-primary to-purple-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  <Search className="size-4" />
                  Search Console
                </Link>
                <Link
                  href={connectorPath(projectId, "google-analytics")}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-purple-50"
                >
                  <BarChart3 className="size-4" />
                  Analytics
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* KPI cards */}
            {kpis.length > 0 && (
              <StatCardGrid>
                {kpis.map((kpi) => (
                  <StatCard key={kpi.label} {...kpi} />
                ))}
              </StatCardGrid>
            )}

            {/* Charts */}
            <div className="grid gap-5 lg:grid-cols-3">
              <section className="rounded-3xl border border-purple-100 bg-white p-6 shadow-xl shadow-purple-900/5 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Traffic Trend
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last 6 months · search clicks vs sessions
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <TrendAreaChart
                    data={trendData}
                    series={trendSeries}
                    emptyMessage="No search or traffic activity in the last 6 months."
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-purple-100 bg-white p-6 shadow-xl shadow-purple-900/5">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    {donutTitle}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {donutSubtitle}
                  </p>
                </div>
                <div className="mt-4">
                  <StatusDonutChart
                    data={donutSlices}
                    totalLabel={channelSlices.length ? "Sessions" : "Clicks"}
                    emptyMessage="No breakdown available yet."
                  />
                </div>
              </section>
            </div>

            {/* Top queries ranked list */}
            <section className="rounded-3xl border border-purple-100 bg-linear-to-br from-white to-purple-50/40 p-6 shadow-xl shadow-purple-900/5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-900 text-white shadow-sm">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    Top Queries
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Most clicks in the last 28 days
                  </p>
                </div>
              </div>

              {topQueries.length === 0 ? (
                <p className="mt-5 rounded-xl border border-dashed border-purple-200 bg-purple-50/40 px-4 py-8 text-center text-sm text-muted-foreground">
                  No query data yet — connect Google Search Console and select a
                  property.
                </p>
              ) : (
                <ol className="mt-5 space-y-2">
                  {topQueries.map((q, idx) => {
                    const pct = topQueryMax
                      ? Math.max(8, (q.clicks / topQueryMax) * 100)
                      : 0;
                    return (
                      <li
                        key={q.keys?.[0] ?? idx}
                        className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-purple-100"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-primary">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {q.keys?.[0] ?? "—"}
                            </p>
                            <span className="shrink-0 text-xs font-semibold text-foreground">
                              {formatNumber(q.clicks)}
                              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                                clicks
                              </span>
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-purple-100">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-primary to-purple-900"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* Top pages / channels */}
            <div className="grid gap-5 lg:grid-cols-2">
              <TopList
                title="Top Pages"
                subtitle="Search Console · by clicks"
                icon={FileBarChart}
                rows={(gsc.topPages ?? []).slice(0, 5).map((p) => ({
                  label: p.keys?.[0] ?? "",
                  value: `${formatNumber(p.clicks)} clicks`,
                }))}
                empty="No page data yet."
              />
              <TopList
                title="Traffic Channels"
                subtitle="Analytics · by sessions"
                icon={Network}
                rows={(ga.topChannels ?? []).slice(0, 5).map((c) => ({
                  label: c.dimension || "(other)",
                  value: `${formatNumber(c.metric)} sessions`,
                }))}
                empty="No channel data yet."
              />
            </div>

            {/* Quick links */}
            <section className="rounded-3xl border border-purple-100 bg-white p-6 shadow-xl shadow-purple-900/5">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  Quick Links
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Jump to connectors and reports
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="group relative overflow-hidden rounded-2xl border border-purple-100 bg-purple-50/40 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                          <Icon className="h-5 w-5" />
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-primary/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-foreground">
                        {link.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {link.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>

            {!canManage && (
              <p className="text-center text-xs text-muted-foreground">
                Read-only view. Ask an admin to manage connectors.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TopList({
  title,
  subtitle,
  icon: Icon,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  rows: { label: string; value: string }[];
  empty: string;
}) {
  return (
    <section className="rounded-3xl border border-purple-100 bg-white p-6 shadow-xl shadow-purple-900/5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-purple-200 bg-purple-50/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {rows.map((row, i) => (
            <li
              key={`${row.label}-${i}`}
              className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-purple-50/60"
            >
              <span className="truncate text-sm font-medium text-foreground">
                {row.label || "—"}
              </span>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
