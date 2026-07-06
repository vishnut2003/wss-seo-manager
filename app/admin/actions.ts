"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import User, { type UserRole } from "@/models/User";
import { ASSIGNABLE_ROLES } from "./_components/types";

export type ActionResult = { ok: boolean; error?: string };

const MIN_PASSWORD = 8;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

async function requireSuperAdmin(): Promise<ActionResult | null> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  if (session.user.role !== "super_admin") {
    return { ok: false, error: "Only the super admin can manage users" };
  }
  return null;
}

/** The env-based super admin email must never exist as a DB user — the env
 *  branch in `auth.ts` would shadow it and the DB user could never log in. */
function isReservedEmail(email: string): boolean {
  const reserved = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  return !!reserved && email === reserved;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

function parseRole(raw: string): UserRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(raw)
    ? (raw as UserRole)
    : "user";
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(String(formData.get("role") ?? "user"));

  if (!name) return { ok: false, error: "Name is required" };
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "A valid email is required" };
  }
  if (isReservedEmail(email)) {
    return { ok: false, error: "This email is reserved for the super admin" };
  }
  if (password.length < MIN_PASSWORD) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD} characters`,
    };
  }

  try {
    await connectDB();
    await User.create({ name, email, password, role });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "A user with this email already exists" };
    }
    return { ok: false, error: "Failed to create user" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUser(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  if (!id || !isValidObjectId(id)) return { ok: false, error: "Invalid user" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(String(formData.get("role") ?? "user"));

  if (!name) return { ok: false, error: "Name is required" };
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "A valid email is required" };
  }
  if (isReservedEmail(email)) {
    return { ok: false, error: "This email is reserved for the super admin" };
  }
  if (password && password.length < MIN_PASSWORD) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD} characters`,
    };
  }

  try {
    await connectDB();
    // Load + save (not findByIdAndUpdate) so the pre("save") hook hashes a
    // changed password. +password so the required field survives validation.
    const user = await User.findById(id).select("+password");
    if (!user) return { ok: false, error: "User not found" };
    if (user.role === "super_admin") {
      return { ok: false, error: "This user cannot be modified" };
    }

    user.name = name;
    user.email = email;
    user.role = role;
    if (password) user.password = password; // blank = keep current password
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { ok: false, error: "A user with this email already exists" };
    }
    return { ok: false, error: "Failed to update user" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  if (!id || !isValidObjectId(id)) return { ok: false, error: "Invalid user" };

  try {
    await connectDB();
    const user = await User.findById(id);
    if (!user) return { ok: false, error: "User not found" };
    if (user.role === "super_admin") {
      return { ok: false, error: "This user cannot be deleted" };
    }
    await user.deleteOne();
  } catch {
    return { ok: false, error: "Failed to delete user" };
  }

  revalidatePath("/admin");
  return { ok: true };
}
