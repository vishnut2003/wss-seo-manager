import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project, { type IProject } from "@/models/Project";
import { GeneralSettingsForm } from "./_components/general-settings-form";
import { DangerZone } from "./_components/danger-zone";

export default async function ProjectSettingsPage({
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

  const session = await auth();
  const role = session?.user?.role;
  const canManage = role === "super_admin" || role === "admin";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your project&apos;s details and configuration.
        </p>
      </div>

      <GeneralSettingsForm
        projectId={projectId}
        canManage={canManage}
        project={{
          name: project.name,
          domain: project.domain,
          description: project.description,
          status: project.status,
        }}
      />

      {canManage && (
        <DangerZone projectId={projectId} projectName={project.name} />
      )}
    </div>
  );
}
