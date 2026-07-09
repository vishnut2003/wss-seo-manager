"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Waypoints } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/app/projects/[projectId]/connectors/windsor/actions";

/**
 * Windsor connect empty-state. Unlike the Google connectors this is not an
 * OAuth redirect — the app-wide API key is already configured server-side, so
 * "connecting" just enables Windsor for the project via a server action.
 */
export function WindsorConnectCard({
  projectId,
  canManage,
  onConnect,
}: {
  projectId: string;
  canManage: boolean;
  onConnect: (projectId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function connect() {
    setPending(true);
    const res = await onConnect(projectId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Failed to connect Windsor");
      return;
    }
    toast.success("Windsor connected");
    router.refresh();
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-100 bg-white p-12 text-center shadow-xl shadow-purple-900/5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-400/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-900 text-white shadow-lg shadow-primary/30">
          <Waypoints className="size-7" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Connect Windsor.ai
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pull unified cross-channel marketing data (Meta, Google, Microsoft,
            LinkedIn, TikTok Ads) from your Windsor.ai account into this project.
          </p>
        </div>

        {canManage ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => void connect()}
            className="h-11 gap-2 rounded-xl border-0 bg-linear-to-r from-primary to-purple-900 px-6 text-sm font-semibold text-white"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Waypoints className="size-4" />
            )}
            Connect Windsor.ai
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ask an admin to connect this data source.
          </p>
        )}
      </div>
    </div>
  );
}
