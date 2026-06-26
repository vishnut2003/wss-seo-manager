"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { oauthErrorMessage } from "./format";

/**
 * Surfaces an OAuth `?error=` flag from the callback redirect as a toast, then
 * strips it from the URL so it doesn't re-fire on refresh.
 */
export function OAuthErrorToast({
  error,
  projectId,
}: {
  error: string;
  projectId: string;
}) {
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.error(oauthErrorMessage(error));
    router.replace(
      `/projects/${projectId}/connectors/google-search-console`
    );
  }, [error, projectId, router]);

  return null;
}
