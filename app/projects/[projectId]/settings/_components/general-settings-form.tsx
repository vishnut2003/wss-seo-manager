"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProject } from "@/app/projects/actions";
import { toDomain } from "@/lib/domain";
import type { ProjectStatus } from "@/models/Project";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GeneralSettingsProject {
  name: string;
  domain: string;
  description?: string;
  status: ProjectStatus;
}

export function GeneralSettingsForm({
  projectId,
  project,
  canManage,
}: {
  projectId: string;
  project: GeneralSettingsProject;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    const res = await updateProject(projectId, formData);
    setPending(false);

    if (!res.ok) {
      toast.error(res.error ?? "Failed to save changes");
      return;
    }

    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>
          {canManage
            ? "Update your project's basic details."
            : "Your project's basic details (read-only)."}
        </CardDescription>
      </CardHeader>

      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={project.name}
              disabled={!canManage}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              name="domain"
              defaultValue={project.domain}
              disabled={!canManage}
              required
              onBlur={(e) => {
                e.currentTarget.value = toDomain(e.currentTarget.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={project.description ?? ""}
              disabled={!canManage}
              rows={3}
              placeholder="Optional notes about this project"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              name="status"
              defaultValue={project.status}
              disabled={!canManage}
            >
              <SelectTrigger id="status" className="w-full sm:w-56">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>

        {canManage && (
          <CardFooter className="mt-6 justify-end border-t border-purple-100 pt-6">
            <Button
              type="submit"
              disabled={pending}
              className="h-11 gap-2 rounded-xl border-0 bg-linear-to-r from-primary to-purple-900 px-6 text-sm font-semibold text-white"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
