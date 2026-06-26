"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Unplug, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DisconnectAction } from "./types";

export function ConnectionHeader({
  projectId,
  accountEmail,
  providerLabel,
  canManage,
  onDisconnect,
}: {
  projectId: string;
  accountEmail: string;
  providerLabel: string;
  canManage: boolean;
  onDisconnect: DisconnectAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function disconnect() {
    setPending(true);
    const res = await onDisconnect(projectId);

    if (!res.ok) {
      setPending(false);
      toast.error(res.error ?? "Failed to disconnect");
      return;
    }

    toast.success(`Disconnected ${providerLabel}`);
    setOpen(false);
    router.refresh();
  }

  return (
    <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CircleCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Connected</p>
            <p className="truncate text-sm text-muted-foreground">
              {accountEmail}
            </p>
          </div>
        </div>

        {canManage && (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setOpen(true)}
          >
            <Unplug className="size-4" />
            Disconnect
          </Button>
        )}
      </CardContent>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {providerLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the stored Google authorization for this project. You
              can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void disconnect();
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
