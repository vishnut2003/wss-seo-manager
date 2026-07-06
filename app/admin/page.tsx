import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import User, { type IUser } from "@/models/User";
import { ProjectsTopBar } from "@/components/ui-elements/projects/projects-top-bar";
import { NewUserDialog } from "./_components/new-user-dialog";
import { UsersTable } from "./_components/users-table";
import type { UserView } from "./_components/types";

type UserLean = IUser & { _id: { toString(): string } };

async function getUsers(): Promise<UserView[]> {
  await connectDB();
  const docs = await User.find().sort({ createdAt: -1 }).lean<UserLean[]>();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    createdAt: doc.createdAt.toISOString(),
  }));
}

export default async function AdminPage() {
  const session = await auth();
  // The proxy already gates this route; this is defense in depth.
  if (session?.user?.role !== "super_admin") notFound();

  const users = await getUsers();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <ProjectsTopBar email={session.user.email} isSuperAdmin />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-purple-900">
                User Management
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create, edit, and remove dashboard accounts.
              </p>
            </div>
            <NewUserDialog />
          </div>

          <UsersTable users={users} />
        </div>
      </div>
    </div>
  );
}
