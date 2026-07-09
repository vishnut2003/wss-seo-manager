"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { updateDailySummarySettings, sendTestSummary } from "../actions";

export interface ConnectorRow {
  provider: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  manageHref: string;
}

export function DailySummaryForm({
  projectId,
  canManage,
  enabled: initialEnabled,
  recipients: initialRecipients,
  connectors: initialConnectors,
  includeDailySubmission: initialIncludeDailySubmission,
}: {
  projectId: string;
  canManage: boolean;
  enabled: boolean;
  recipients: string;
  connectors: ConnectorRow[];
  includeDailySubmission: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [recipients, setRecipients] = useState(initialRecipients);
  const [includeDailySubmission, setIncludeDailySubmission] = useState(
    initialIncludeDailySubmission
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(initialConnectors.map((c) => [c.provider, c.enabled]))
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function toggleConnector(provider: string, value: boolean) {
    setSelected((prev) => ({ ...prev, [provider]: value }));
  }

  async function onSave() {
    setSaving(true);
    const res = await updateDailySummarySettings(projectId, {
      enabled,
      recipients,
      enabledConnectors: Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k),
      includeDailySubmission,
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error ?? "Failed to save settings");
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  async function onTest() {
    setTesting(true);
    const res = await sendTestSummary(projectId);
    setTesting(false);

    if (!res.ok) {
      toast.error(res.error ?? "Failed to send test summary");
      return;
    }
    toast.success("Test summary sent");
    router.refresh();
  }

  return (
    <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
      <CardHeader>
        <CardTitle className="text-base">Settings</CardTitle>
        <CardDescription>
          {canManage
            ? "Configure recipients and which connectors to include."
            : "Daily summary configuration (read-only)."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Enable daily summary
            </p>
            <p className="text-sm text-muted-foreground">
              Send the digest automatically every day.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canManage}
            aria-label="Enable daily summary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recipients">Recipient email(s)</Label>
          <Input
            id="recipients"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            disabled={!canManage}
            placeholder="alice@example.com, bob@example.com"
          />
          <p className="text-xs text-muted-foreground">
            Separate multiple addresses with commas.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Connectors to include</Label>
          {initialConnectors.map((c) => (
            <div
              key={c.provider}
              className="flex items-center justify-between gap-4 rounded-xl border border-purple-100 p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                {!c.configured && (
                  <p className="text-xs text-muted-foreground">
                    Not connected —{" "}
                    <Link
                      href={c.manageHref}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      connect &amp; select a property first
                    </Link>
                  </p>
                )}
              </div>
              <Switch
                checked={Boolean(selected[c.provider]) && c.configured}
                onCheckedChange={(v) => toggleConnector(c.provider, v)}
                disabled={!canManage || !c.configured}
                aria-label={`Include ${c.label}`}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-purple-100 bg-purple-50/40 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Include daily submissions
            </p>
            <p className="text-sm text-muted-foreground">
              Fold the previous day&apos;s team updates and attached files into
              the digest.
            </p>
          </div>
          <Switch
            checked={includeDailySubmission}
            onCheckedChange={setIncludeDailySubmission}
            disabled={!canManage}
            aria-label="Include daily submissions"
          />
        </div>
      </CardContent>

      {canManage && (
        <CardFooter className="mt-2 flex-wrap justify-end gap-3 border-t border-purple-100 pt-6">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={testing || saving}
            onClick={() => void onTest()}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send test summary now
          </Button>
          <Button
            type="button"
            disabled={saving}
            className="h-11 gap-2 rounded-xl border-0 bg-linear-to-r from-primary to-purple-900 px-6 text-sm font-semibold text-white"
            onClick={() => void onSave()}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
