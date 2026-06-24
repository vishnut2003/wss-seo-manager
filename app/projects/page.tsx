import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project, { type IProject } from "@/models/Project";
import { ProjectsTopBar } from "@/components/ui-elements/projects/projects-top-bar";
import {
  ProjectStats,
  type ProjectsSummary,
} from "@/components/ui-elements/projects/project-stats";
import { ProjectsGrid } from "@/components/ui-elements/projects/projects-grid";
import { ProjectsEmptyState } from "@/components/ui-elements/projects/projects-empty-state";
import { NewProjectDialog } from "@/components/ui-elements/projects/new-project-dialog";
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
  }));
}

function summarize(projects: ProjectView[]): ProjectsSummary {
  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const totalKeywords = projects.reduce(
    (sum, p) => sum + p.metrics.keywords,
    0
  );
  const avgHealth = total
    ? Math.round(
        projects.reduce((sum, p) => sum + p.metrics.healthScore, 0) / total
      )
    : 0;

  return { total, active, avgHealth, totalKeywords };
}

export default async function ProjectsPage() {
  const session = await auth();
  const projects = await getProjects();
  const summary = summarize(projects);

  const role = session?.user?.role;
  const canDelete = role === "super_admin" || role === "admin";

  return (
    <div className="flex min-h-full flex-col bg-background">
      <ProjectsTopBar email={session?.user?.email} />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {/* Branded hero */}
        <section className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-primary via-purple-800 to-purple-900 p-8 text-white shadow-xl shadow-purple-900/20 sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
              <p className="mt-2 max-w-md text-sm text-white/80">
                Track keywords, traffic, and site health across all your SEO
                projects.
              </p>
            </div>
            <NewProjectDialog variant="light" />
          </div>
        </section>

        {/* Stats */}
        <div className="mb-8">
          <ProjectStats summary={summary} />
        </div>

        {/* Projects */}
        {projects.length === 0 ? (
          <ProjectsEmptyState />
        ) : (
          <ProjectsGrid projects={projects} canDelete={canDelete} />
        )}
      </div>
    </div>
  );
}
