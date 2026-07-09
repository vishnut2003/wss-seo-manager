"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/app/projects/[projectId]/connectors/windsor/actions";

export interface FieldOption {
  id: string;
  label: string;
}

/**
 * Multi-select of which Windsor fields to display for one selected account.
 * Saves the full selection on each toggle via a server action.
 */
export function WindsorFieldToggles({
  projectId,
  source,
  accountId,
  options,
  selected,
  canManage,
  onSave,
}: {
  projectId: string;
  source: string;
  accountId: string;
  options: FieldOption[];
  selected: string[];
  canManage: boolean;
  onSave: (
    projectId: string,
    source: string,
    accountId: string,
    fields: string[]
  ) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<string[]>(selected);
  const [pending, setPending] = useState(false);

  async function toggle(id: string, checked: boolean) {
    const next = checked
      ? [...values, id]
      : values.filter((v) => v !== id);
    if (next.length === 0) {
      toast.error("Select at least one field");
      return;
    }
    const prev = values;
    setValues(next);
    setPending(true);
    const res = await onSave(projectId, source, accountId, next);
    setPending(false);
    if (!res.ok) {
      setValues(prev);
      toast.error(res.error ?? "Failed to save fields");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Fields</span>
        {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {options.map((opt) => {
          const checked = values.includes(opt.id);
          return (
            <div key={opt.id} className="flex items-center gap-2">
              <Checkbox
                id={`windsor-field-${source}-${accountId}-${opt.id}`}
                checked={checked}
                disabled={!canManage || pending}
                onCheckedChange={(v) => void toggle(opt.id, v === true)}
              />
              <Label
                htmlFor={`windsor-field-${source}-${accountId}-${opt.id}`}
                className="text-sm font-normal text-muted-foreground"
              >
                {opt.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
