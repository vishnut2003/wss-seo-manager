"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AssistantPanel } from "./assistant-panel";

export function AssistantLauncher({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const [open, setOpen] = useState(false);

  const name = projectName ?? "this project";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open SEO Manager assistant"
        className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-linear-to-br from-primary to-purple-900 text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <MessageCircle className="size-6" />
      </button>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-md"
      >
        <SheetTitle className="sr-only">SEO Manager</SheetTitle>
        <SheetDescription className="sr-only">
          Chat assistant for {name}
        </SheetDescription>
        <AssistantPanel
          projectId={projectId}
          projectName={name}
          open={open}
        />
      </SheetContent>
    </Sheet>
  );
}
