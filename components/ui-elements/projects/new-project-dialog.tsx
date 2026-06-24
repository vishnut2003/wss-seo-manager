"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createProject } from "@/app/projects/actions";
import { toDomain } from "@/lib/domain";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewProjectDialog({
  variant = "solid",
}: {
  variant?: "solid" | "light";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPending(true);
    const res = await createProject(formData);
    setPending(false);

    if (!res.ok) {
      toast.error(res.error ?? "Failed to create project");
      return;
    }

    toast.success("Project created");
    setOpen(false);
    router.refresh();
  }

  const sizing = "h-11 rounded-xl px-6 text-sm font-semibold";
  const triggerClass =
    variant === "light"
      ? `gap-2 border-0 bg-white text-primary hover:bg-white/90 ${sizing}`
      : `gap-2 border-0 bg-linear-to-r from-primary to-purple-900 text-white shadow-lg shadow-primary/30 transition hover:shadow-xl hover:shadow-primary/40 ${sizing}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClass}>
          <Plus className="size-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        // Don't close the form on an outside click. Besides preventing
        // accidental data loss, this avoids the Radix issue where dismissing
        // the portaled Status select registers as an outside-interaction and
        // closes the whole dialog. Close via the X button, Escape, or submit.
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Add a site to start tracking its SEO performance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" placeholder="Acme Marketing" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              name="domain"
              placeholder="example.com"
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
              placeholder="Optional notes about this project"
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue="active">
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="h-11 gap-2 rounded-xl border-0 bg-linear-to-r from-primary to-purple-900 px-6 text-sm font-semibold text-white"
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
