import { put } from "@vercel/blob";
import type { ISubmissionAttachment } from "@/models/DailySubmission";

/**
 * Vercel Blob storage for daily-submission attachments. Server-only.
 * Requires the BLOB_READ_WRITE_TOKEN env var (auto-injected on Vercel when a
 * Blob store is connected; set it manually for local dev).
 */

/** Upload limits, shared by the client form and the server action. */
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

/** Accepted MIME types. `image/*` matches any image subtype. */
export const ACCEPTED_TYPES = [
  "image/*",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** Whether a file's MIME type is allowed (supports `image/*` wildcards). */
export function isAcceptedType(type: string): boolean {
  return ACCEPTED_TYPES.some((accepted) =>
    accepted.endsWith("/*")
      ? type.startsWith(accepted.slice(0, -1))
      : accepted === type
  );
}

/** Strip path separators so a filename can't escape its Blob prefix. */
function safeName(name: string): string {
  return name.replace(/[/\\]+/g, "_").replace(/\s+/g, "-").slice(0, 120);
}

/**
 * Upload files to Vercel Blob under a per-project prefix and return the
 * attachment metadata to persist on the submission.
 */
export async function uploadSubmissionFiles(
  projectId: string,
  files: File[]
): Promise<ISubmissionAttachment[]> {
  return Promise.all(
    files.map(async (file) => {
      const key = `submissions/${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const blob = await put(key, file, {
        access: "public",
        contentType: file.type || undefined,
      });
      return {
        url: blob.url,
        filename: file.name,
        contentType: file.type || "",
        size: file.size,
      };
    })
  );
}
