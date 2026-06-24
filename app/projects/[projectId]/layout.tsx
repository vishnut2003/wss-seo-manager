import { cookies } from "next/headers";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import ProjectsDashboardLayout from "@/layouts/projects-dashboard";

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  let projectName: string | undefined;
  if (isValidObjectId(projectId)) {
    await connectDB();
    const project = await Project.findById(projectId)
      .select("name")
      .lean<{ name: string } | null>();
    projectName = project?.name;
  }

  return (
    <ProjectsDashboardLayout
      user={{
        name: session?.user?.name,
        email: session?.user?.email,
        role: session?.user?.role,
      }}
      projectId={projectId}
      defaultOpen={defaultOpen}
      currentLabel={projectName}
    >
      {children}
    </ProjectsDashboardLayout>
  );
}
