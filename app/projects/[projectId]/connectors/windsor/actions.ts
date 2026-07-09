"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Connection, {
  type WindsorAccountSelection,
} from "@/models/Connection";
import { getSourceDef, isWindsorConfigured } from "@/lib/windsor/client";

export type ActionResult = { ok: boolean; error?: string };

const PROVIDER = "windsor" as const;

function isManager(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

function revalidate(projectId: string): void {
  revalidatePath(`/projects/${projectId}/connectors/windsor`);
}

async function guard(
  projectId: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  if (!isManager(session.user.role)) {
    return { ok: false, error: "You don't have permission to change this" };
  }
  if (!isValidObjectId(projectId)) {
    return { ok: false, error: "Invalid project" };
  }
  return { ok: true, email: session.user.email ?? "unknown" };
}

/** Enable Windsor for this project (app-wide key — no OAuth). */
export async function connectWindsor(projectId: string): Promise<ActionResult> {
  const g = await guard(projectId);
  if (!g.ok) return g;
  if (!isWindsorConfigured()) {
    return { ok: false, error: "Windsor is not configured on this server" };
  }

  try {
    await connectDB();
    await Connection.findOneAndUpdate(
      { projectId, provider: PROVIDER },
      {
        accountEmail: "Windsor.ai (app-wide key)",
        connectedBy: g.email,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch {
    return { ok: false, error: "Failed to connect Windsor" };
  }

  revalidate(projectId);
  return { ok: true };
}

export interface WindsorAccountInput {
  source: string;
  accountId: string;
  accountName?: string;
}

const keyOf = (source: string, accountId: string) => `${source} ${accountId}`;

/** Set which Windsor workspace accounts are attached to this project. */
export async function setWindsorAccounts(
  projectId: string,
  accounts: WindsorAccountInput[]
): Promise<ActionResult> {
  const g = await guard(projectId);
  if (!g.ok) return g;

  // Validate against the catalog and dedupe by source + account id.
  const seen = new Set<string>();
  const selections: WindsorAccountSelection[] = [];
  for (const a of accounts) {
    if (!getSourceDef(a.source)) {
      return { ok: false, error: "Unknown Windsor source" };
    }
    if (typeof a.accountId !== "string" || a.accountId.length === 0) {
      return { ok: false, error: "Invalid account" };
    }
    const key = keyOf(a.source, a.accountId);
    if (seen.has(key)) continue;
    seen.add(key);
    selections.push({
      source: a.source,
      accountId: a.accountId,
      accountName:
        typeof a.accountName === "string" && a.accountName.length > 0
          ? a.accountName
          : undefined,
    });
  }

  try {
    await connectDB();
    const conn = await Connection.findOne({ projectId, provider: PROVIDER });
    if (!conn) return { ok: false, error: "No connection found" };

    // Preserve field selections for accounts that stay selected.
    const existing = new Map(
      (conn.windsorAccounts ?? []).map((a) => [keyOf(a.source, a.accountId), a])
    );
    conn.windsorAccounts = selections.map((s) => ({
      ...s,
      fields: existing.get(keyOf(s.source, s.accountId))?.fields,
    }));
    await conn.save();
  } catch {
    return { ok: false, error: "Failed to save accounts" };
  }

  revalidate(projectId);
  return { ok: true };
}

/** Set which fields display for one selected account. */
export async function setWindsorAccountFields(
  projectId: string,
  source: string,
  accountId: string,
  fields: string[]
): Promise<ActionResult> {
  const g = await guard(projectId);
  if (!g.ok) return g;

  const def = getSourceDef(source);
  if (!def) return { ok: false, error: "Unknown Windsor source" };

  const valid = new Set(def.metrics.map((m) => m.id));
  const picked = fields.filter((f) => valid.has(f));
  if (picked.length === 0) {
    return { ok: false, error: "Select at least one field" };
  }

  try {
    await connectDB();
    const conn = await Connection.findOne({ projectId, provider: PROVIDER });
    if (!conn) return { ok: false, error: "No connection found" };

    const target = (conn.windsorAccounts ?? []).find(
      (a) => a.source === source && a.accountId === accountId
    );
    if (!target) return { ok: false, error: "Account not selected" };

    target.fields = picked;
    conn.markModified("windsorAccounts");
    await conn.save();
  } catch {
    return { ok: false, error: "Failed to save fields" };
  }

  revalidate(projectId);
  return { ok: true };
}

export async function disconnectWindsor(
  projectId: string
): Promise<ActionResult> {
  const g = await guard(projectId);
  if (!g.ok) return g;

  try {
    await connectDB();
    await Connection.findOneAndDelete({ projectId, provider: PROVIDER });
  } catch {
    return { ok: false, error: "Failed to disconnect" };
  }

  revalidate(projectId);
  return { ok: true };
}
