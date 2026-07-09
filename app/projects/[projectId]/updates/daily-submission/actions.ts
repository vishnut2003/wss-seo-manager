"use server";

import { revalidatePath } from "next/cache";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import DailySubmission from "@/models/DailySubmission";
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  isAcceptedType,
  uploadSubmissionFiles,
} from "@/lib/storage/blob";

export type ActionResult = { ok: boolean; error?: string };

const MAX_BODY_LEN = 5000;

/**
 * Post a daily update for a project. Open to any authenticated user (append-only
 * — each call creates a new record attributed to the submitter).
 */
export async function createDailySubmission(
  projectId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated" };
  if (!isValidObjectId(projectId)) {
    return { ok: false, error: "Invalid project" };
  }

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "Please describe what you did today" };
  if (body.length > MAX_BODY_LEN) {
    return { ok: false, error: `Keep the note under ${MAX_BODY_LEN} characters` };
  }

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length > MAX_FILES) {
    return { ok: false, error: `Attach at most ${MAX_FILES} files` };
  }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: `"${file.name}" is larger than ${MAX_FILE_BYTES / (1024 * 1024)}MB`,
      };
    }
    if (!isAcceptedType(file.type)) {
      return { ok: false, error: `"${file.name}" is an unsupported file type` };
    }
  }

  try {
    const attachments =
      files.length > 0 ? await uploadSubmissionFiles(projectId, files) : [];

    await connectDB();
    await DailySubmission.create({
      projectId,
      submittedBy: session.user.email ?? "unknown",
      submittedByName: session.user.name ?? undefined,
      body,
      attachments,
    });
  } catch {
    return { ok: false, error: "Failed to save your submission" };
  }

  revalidatePath(`/projects/${projectId}/updates/daily-submission`);
  return { ok: true };
}
