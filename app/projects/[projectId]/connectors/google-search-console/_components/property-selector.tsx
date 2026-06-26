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
import type { GscSite } from "@/lib/google/search-console";
import { selectProperty } from "../actions";

export function PropertySelector({
  projectId,
  sites,
  currentSiteUrl,
  canManage,
}: {
  projectId: string;
  sites: GscSite[];
  currentSiteUrl?: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onChange(siteUrl: string) {
    if (siteUrl === currentSiteUrl) return;
    setPending(true);
    const res = await selectProperty(projectId, siteUrl);
    setPending(false);

    if (!res.ok) {
      toast.error(res.error ?? "Failed to save property");
      return;
    }
    toast.success("Property updated");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="gsc-property" className="flex items-center gap-2">
        Property
        {pending && <Loader2 className="size-3.5 animate-spin" />}
      </Label>
      <Select
        defaultValue={currentSiteUrl}
        disabled={!canManage || pending || sites.length === 0}
        onValueChange={(v) => void onChange(v)}
      >
        <SelectTrigger id="gsc-property" className="w-full sm:w-96">
          <SelectValue
            placeholder={
              sites.length === 0
                ? "No properties available for this account"
                : "Select a Search Console property"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {sites.map((site) => (
            <SelectItem key={site.siteUrl} value={site.siteUrl}>
              {site.siteUrl}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
