"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project, { type ProjectStatus } from "@/models/Project";
import { toDomain } from "@/lib/domain";

export type ActionResult = { ok: boolean; error?: string };

const STATUSES: ProjectStatus[] = ["active", "paused", "archived"];

function isManager(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

export async function createProject(
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };

  const name = String(formData.get("name") ?? "").trim();
  const domain = toDomain(String(formData.get("domain") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "active");
  const status: ProjectStatus = STATUSES.includes(statusRaw as ProjectStatus)
    ? (statusRaw as ProjectStatus)
    : "active";

  if (!name) return { ok: false, error: "Project name is required" };
  if (!domain) return { ok: false, error: "Domain is required" };

  try {
    await connectDB();
    await Project.create({
      name,
      domain,
      description: description || undefined,
      status,
      createdBy: session.user.email ?? "unknown",
    });
  } catch {
    return { ok: false, error: "Failed to create project" };
  }

  revalidatePath("/projects");
  return { ok: true };
}

export async function updateProject(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  if (!isManager(session.user.role)) {
    return {
      ok: false,
      error: "You don't have permission to edit this project",
    };
  }

  if (!id || !isValidObjectId(id)) {
    return { ok: false, error: "Invalid project" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const domain = toDomain(String(formData.get("domain") ?? ""));
  const description = String(formData.get("description") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "active");
  const status: ProjectStatus = STATUSES.includes(statusRaw as ProjectStatus)
    ? (statusRaw as ProjectStatus)
    : "active";

  if (!name) return { ok: false, error: "Project name is required" };
  if (!domain) return { ok: false, error: "Domain is required" };

  try {
    await connectDB();
    const updated = await Project.findByIdAndUpdate(id, {
      name,
      domain,
      description: description || undefined,
      status,
    });
    if (!updated) return { ok: false, error: "Project not found" };
  } catch {
    return { ok: false, error: "Failed to update project" };
  }

  revalidatePath(`/projects/${id}`);
  revalidatePath(`/projects/${id}/settings`);
  revalidatePath("/projects");
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };

  if (!isManager(session.user.role)) {
    return { ok: false, error: "You don't have permission to delete projects" };
  }

  if (!id) return { ok: false, error: "Missing project id" };

  try {
    await connectDB();
    await Project.findByIdAndDelete(id);
  } catch {
    return { ok: false, error: "Failed to delete project" };
  }

  revalidatePath("/projects");
  return { ok: true };
}
