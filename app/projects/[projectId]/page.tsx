import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/configs/db";
import Project, { type IProject } from "@/models/Project";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  if (!isValidObjectId(projectId)) {
    notFound();
  }

  await connectDB();
  const project = await Project.findById(projectId).lean<IProject | null>();

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {project.name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{project.domain}</p>
    </div>
  );
}
