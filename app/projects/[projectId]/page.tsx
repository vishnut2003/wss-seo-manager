import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary transition hover:text-purple-700"
      >
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>

      <div className="rounded-3xl border border-purple-100 bg-white p-10 shadow-xl shadow-purple-900/5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Project detail
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Detail view for project{" "}
          <span className="font-mono text-purple-700">{projectId}</span> is
          coming soon.
        </p>
      </div>
    </main>
  );
}
