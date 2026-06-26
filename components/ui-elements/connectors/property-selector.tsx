"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectPropertyAction } from "./types";

export interface PropertyOption {
  value: string;
  label: string;
}

export function PropertySelector({
  projectId,
  items,
  currentValue,
  canManage,
  onSelect,
  label,
  placeholder,
  emptyPlaceholder,
}: {
  projectId: string;
  items: PropertyOption[];
  currentValue?: string;
  canManage: boolean;
  onSelect: SelectPropertyAction;
  label: string;
  placeholder: string;
  emptyPlaceholder: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function change(value: string) {
    if (value === currentValue) return;
    setPending(true);
    const res = await onSelect(projectId, value);
    setPending(false);

    if (!res.ok) {
      toast.error(res.error ?? "Failed to save selection");
      return;
    }
    toast.success("Property updated");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="connector-property" className="flex items-center gap-2">
        {label}
        {pending && <Loader2 className="size-3.5 animate-spin" />}
      </Label>
      <Select
        defaultValue={currentValue}
        disabled={!canManage || pending || items.length === 0}
        onValueChange={(v) => void change(v)}
      >
        <SelectTrigger id="connector-property" className="w-full sm:w-96">
          <SelectValue
            placeholder={items.length === 0 ? emptyPlaceholder : placeholder}
          />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
