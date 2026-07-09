import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ClipboardCheck, Paperclip } from "lucide-react";
import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import DailySubmission, {
  type IDailySubmission,
} from "@/models/DailySubmission";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DailySubmissionForm } from "./_components/daily-submission-form";

type SubmissionLean = IDailySubmission & { _id: unknown };

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function DailySubmissionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  if (!isValidObjectId(projectId)) {
    notFound();
  }

  await connectDB();
  const project = await Project.findById(projectId)
    .select("name")
    .lean<{ name: string } | null>();
  if (!project) {
    notFound();
  }

  const submissions = await DailySubmission.find({ projectId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean<SubmissionLean[]>();

  const rows = submissions.map((s) => ({
    id: String(s._id),
    submittedBy: s.submittedBy,
    submittedByName: s.submittedByName ?? "",
    body: s.body,
    attachments: s.attachments ?? [],
    createdAt: formatWhen(new Date(s.createdAt)),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Daily Submission
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log what you worked on today for {project.name}. When enabled, these
          updates are folded into the project&apos;s daily summary email.
        </p>
      </div>

      <DailySubmissionForm projectId={projectId} />

      <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
        <CardHeader>
          <CardTitle className="text-base">Recent submissions</CardTitle>
          <CardDescription>
            The latest {rows.length > 0 ? rows.length : ""} updates for this
            project.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No submissions yet. Add the first one above.
            </p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-purple-100 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {row.submittedByName || row.submittedBy}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.createdAt}
                  </p>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-foreground">
                  {row.body}
                </p>
                {row.attachments.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {row.attachments.map((a) => (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-primary underline-offset-2 hover:underline"
                      >
                        <Paperclip className="size-3.5 shrink-0" />
                        {a.filename}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {rows.length === 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardCheck className="size-3.5" />
          Submissions from the previous day are included in the 6:00 AM summary
          email when the project enables them.
        </p>
      )}
    </div>
  );
}
