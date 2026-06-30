"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import NotificationSetting from "@/models/NotificationSetting";
import {
  CONNECTION_PROVIDERS,
  type ConnectionProvider,
} from "@/models/Connection";
import { runMonthlySummary } from "@/lib/notifications/monthly-summary";

export type ActionResult = { ok: boolean; error?: string };

const TYPE = "monthly-summary" as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isManager(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

export interface MonthlySummaryInput {
  enabled: boolean;
  recipients: string;
  enabledConnectors: string[];
}

export async function updateMonthlySummarySettings(
  projectId: string,
  input: MonthlySummaryInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  if (!isManager(session.user.role)) {
    return { ok: false, error: "You don't have permission to change this" };
  }
  if (!isValidObjectId(projectId)) {
    return { ok: false, error: "Invalid project" };
  }

  const recipients = input.recipients
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  const invalid = recipients.filter((r) => !EMAIL_RE.test(r));
  if (invalid.length > 0) {
    return { ok: false, error: `Invalid email: ${invalid[0]}` };
  }

  const enabledConnectors = input.enabledConnectors.filter(
    (c): c is ConnectionProvider =>
      (CONNECTION_PROVIDERS as string[]).includes(c)
  );

  if (input.enabled && recipients.length === 0) {
    return { ok: false, error: "Add at least one recipient to enable" };
  }
  if (input.enabled && enabledConnectors.length === 0) {
    return { ok: false, error: "Enable at least one connector" };
  }

  try {
    await connectDB();
    await NotificationSetting.findOneAndUpdate(
      { projectId, type: TYPE },
      { enabled: input.enabled, recipients, enabledConnectors },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch {
    return { ok: false, error: "Failed to save settings" };
  }

  revalidatePath(`/projects/${projectId}/notifications/monthly-summary`);
  return { ok: true };
}

export async function sendTestMonthlySummary(
  projectId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  if (!isManager(session.user.role)) {
    return { ok: false, error: "You don't have permission to do this" };
  }
  if (!isValidObjectId(projectId)) {
    return { ok: false, error: "Invalid project" };
  }

  try {
    const { status } = await runMonthlySummary(projectId, { force: true });
    if (status !== "sent") {
      return { ok: false, error: status };
    }
  } catch {
    return { ok: false, error: "Failed to send test summary" };
  }

  revalidatePath(`/projects/${projectId}/notifications/monthly-summary`);
  return { ok: true };
}
