"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPTED_TYPES,
  MAX_FILES,
  MAX_FILE_BYTES,
  isAcceptedType,
} from "@/lib/storage/blob";
import { createDailySubmission } from "../actions";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DailySubmissionForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        toast.error(`You can attach at most ${MAX_FILES} files`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(
          `"${file.name}" is larger than ${MAX_FILE_BYTES / (1024 * 1024)}MB`
        );
        continue;
      }
      if (!isAcceptedType(file.type)) {
        toast.error(`"${file.name}" is an unsupported file type`);
        continue;
      }
      // Skip exact duplicates already staged.
      if (next.some((f) => f.name === file.name && f.size === file.size)) {
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit() {
    if (!body.trim()) {
      toast.error("Please describe what you did today");
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.append("body", body);
    for (const file of files) formData.append("files", file);

    const res = await createDailySubmission(projectId, formData);
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error ?? "Failed to save your submission");
      return;
    }
    toast.success("Submission saved");
    setBody("");
    setFiles([]);
    router.refresh();
  }

  return (
    <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
      <CardHeader>
        <CardTitle className="text-base">Today&apos;s update</CardTitle>
        <CardDescription>
          Summarize your work and attach any supporting files.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="body">What did you work on today?</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Published 2 blog posts, fixed broken internal links on the pricing page, submitted the updated sitemap to GSC…"
            rows={6}
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Attachments (optional)</Label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-fit gap-2"
            disabled={saving || files.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-4" />
            Add files
          </Button>
          <p className="text-xs text-muted-foreground">
            Up to {MAX_FILES} files, {MAX_FILE_BYTES / (1024 * 1024)}MB each.
            Images, PDFs, text, and Office documents.
          </p>

          {files.length > 0 && (
            <div className="mt-1 flex flex-col gap-1.5">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate text-sm text-foreground">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={saving}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="justify-end border-t border-purple-100 pt-6">
        <Button
          type="button"
          disabled={saving}
          className="h-11 gap-2 rounded-xl border-0 bg-linear-to-r from-primary to-purple-900 px-6 text-sm font-semibold text-white"
          onClick={() => void onSubmit()}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {saving ? "Submitting…" : "Submit update"}
        </Button>
      </CardFooter>
    </Card>
  );
}
