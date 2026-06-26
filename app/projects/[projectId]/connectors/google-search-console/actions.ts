"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Connection from "@/models/Connection";
import { GSC_PROVIDER } from "@/lib/google/gsc-flow";

export type ActionResult = { ok: boolean; error?: string };

function isManager(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

function revalidate(projectId: string): void {
  revalidatePath(`/projects/${projectId}/connectors/google-search-console`);
}

export async function selectProperty(
  projectId: string,
  siteUrl: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  if (!isManager(session.user.role)) {
    return { ok: false, error: "You don't have permission to change this" };
  }
  if (!isValidObjectId(projectId)) {
    return { ok: false, error: "Invalid project" };
  }
  if (!siteUrl) return { ok: false, error: "Select a property" };

  try {
    await connectDB();
    const updated = await Connection.findOneAndUpdate(
      { projectId, provider: GSC_PROVIDER },
      { siteUrl }
    );
    if (!updated) return { ok: false, error: "No connection found" };
  } catch {
    return { ok: false, error: "Failed to save property" };
  }

  revalidate(projectId);
  return { ok: true };
}

export async function disconnectGsc(projectId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  if (!isManager(session.user.role)) {
    return { ok: false, error: "You don't have permission to disconnect" };
  }
  if (!isValidObjectId(projectId)) {
    return { ok: false, error: "Invalid project" };
  }

  try {
    await connectDB();
    await Connection.findOneAndDelete({ projectId, provider: GSC_PROVIDER });
  } catch {
    return { ok: false, error: "Failed to disconnect" };
  }

  revalidate(projectId);
  return { ok: true };
}
