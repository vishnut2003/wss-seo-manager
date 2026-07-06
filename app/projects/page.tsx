import { FolderKanban, CircleCheck, Activity, KeyRound, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project, { type IProject } from "@/models/Project";
import { ProjectsTopBar } from "@/components/ui-elements/projects/projects-top-bar";
import { ProjectsGrid } from "@/components/ui-elements/projects/projects-grid";
import { ProjectsEmptyState } from "@/components/ui-elements/projects/projects-empty-state";
import { NewProjectDialog } from "@/components/ui-elements/projects/new-project-dialog";
import {
  StatCard,
  StatCardGrid,
} from "@/components/ui-elements/dashboard/stat-card";
import {
  TrendAreaChart,
  StatusDonutChart,
  type DonutSlice,
} from "@/components/ui-elements/dashboard/dashboard-charts";
import { trendPct } from "@/lib/google/dashboard-data";
import type { ProjectView } from "@/components/ui-elements/projects/types";

type ProjectLean = IProject & { _id: { toString(): string } };

async function getProjects(): Promise<ProjectView[]> {
  await connectDB();
  const docs = await Project.find()
    .sort({ updatedAt: -1 })
    .lean<ProjectLean[]>();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    domain: doc.domain,
    description: doc.description,
    status: doc.status,
    metrics: {
      healthScore: doc.metrics?.healthScore ?? 0,
      keywords: doc.metrics?.keywords ?? 0,
      organicTraffic: doc.metrics?.organicTraffic ?? 0,
      backlinks: doc.metrics?.backlinks ?? 0,
    },
    updatedAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  }));
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** New projects per month for the last 6 months (by createdAt). */
function monthlySeries(projects: ProjectView[]) {
  const now = new Date();
  const series: { label: string; created: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const created = projects.filter((p) => {
      const c = new Date(p.createdAt);
      return c.getFullYear() === y && c.getMonth() === m;
    }).length;
    series.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      created,
    });
  }
  return series;
}

export default async function ProjectsPage() {
  const session = await auth();
  const projects = await getProjects();

  const role = session?.user?.role;
  const canDelete = role === "super_admin" || role === "admin";
  const firstName = session?.user?.name?.split(" ")[0];

  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const totalKeywords = projects.reduce((sum, p) => sum + p.metrics.keywords, 0);
  const avgHealth = total
    ? Math.round(
        projects.reduce((sum, p) => sum + p.metrics.healthScore, 0) / total
      )
    : 0;

  // New-projects MoM trend (this month vs last).
  const now = new Date();
  const inMonth = (p: ProjectView, offset: number) => {
    const c = new Date(p.createdAt);
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
  };
  const newThisMonth = projects.filter((p) => inMonth(p, 0)).length;
  const newLastMonth = projects.filter((p) => inMonth(p, 1)).length;

  const statusSlices: DonutSlice[] = [
    {
      name: "Active",
      value: projects.filter((p) => p.status === "active").length,
      color: "#10b981",
    },
    {
      name: "Paused",
      value: projects.filter((p) => p.status === "paused").length,
      color: "#f59e0b",
    },
    {
      name: "Archived",
      value: projects.filter((p) => p.status === "archived").length,
      color: "#94a3b8",
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-background">
      <ProjectsTopBar
        email={session?.user?.email}
        isSuperAdmin={role === "super_admin"}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary via-purple-800 to-purple-900 p-8 text-white shadow-xl shadow-purple-900/20 sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  {greeting()}
                </span>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Welcome back
                  {firstName ? (
                    <span className="text-purple-200">, {firstName}</span>
                  ) : (
                    ""
                  )}
                  .
                </h1>
                <p className="max-w-md text-sm text-white/80">
                  Track keywords, traffic, and site health across all your SEO
                  projects.
                </p>
              </div>
              <NewProjectDialog variant="light" />
            </div>
          </section>

          {/* Stats */}
          <StatCardGrid>
            <StatCard
              icon={FolderKanban}
              label="Total projects"
              value={total.toLocaleString()}
              trend={trendPct(newThisMonth, newLastMonth)}
              hint="new vs last month"
            />
            <StatCard
              icon={CircleCheck}
              label="Active projects"
              value={active.toLocaleString()}
            />
            <StatCard
              icon={Activity}
              label="Avg. health score"
              value={total ? `${avgHealth}` : "—"}
            />
            <StatCard
              icon={KeyRound}
              label="Keywords tracked"
              value={totalKeywords.toLocaleString()}
            />
          </StatCardGrid>

          {/* Charts */}
          {total > 0 && (
            <div className="grid gap-5 lg:grid-cols-3">
              <section className="rounded-3xl border border-purple-100 bg-white p-6 shadow-xl shadow-purple-900/5 lg:col-span-2">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    Projects Trend
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    New projects · last 6 months
                  </p>
                </div>
                <div className="mt-4">
                  <TrendAreaChart
                    data={monthlySeries(projects)}
                    series={[
                      { key: "created", name: "New projects", color: "#8C00FF" },
                    ]}
                    emptyMessage="No new projects in the last 6 months."
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-purple-100 bg-white p-6 shadow-xl shadow-purple-900/5">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    Project Mix
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Distribution by status
                  </p>
                </div>
                <div className="mt-4">
                  <StatusDonutChart data={statusSlices} totalLabel="Projects" />
                </div>
              </section>
            </div>
          )}

          {/* Projects */}
          {projects.length === 0 ? (
            <ProjectsEmptyState />
          ) : (
            <ProjectsGrid projects={projects} canDelete={canDelete} />
          )}
        </div>
      </div>
    </div>
  );
}
