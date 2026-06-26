import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Disconnected (or needs-reconnect) empty state with a Connect call to action.
 * The button is a full navigation to the connect route, which redirects to
 * Google's consent screen.
 */
export function ConnectCard({
  projectId,
  canManage,
  reconnect = false,
}: {
  projectId: string;
  canManage: boolean;
  reconnect?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-100 bg-white p-12 text-center shadow-xl shadow-purple-900/5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-400/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-md flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-900 text-white shadow-lg shadow-primary/30">
          <Search className="size-7" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {reconnect
              ? "Reconnect Google Search Console"
              : "Connect Google Search Console"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {reconnect
              ? "Your Google authorization expired or was revoked. Reconnect to keep syncing search performance data."
              : "Authorize a Google account to pull clicks, impressions, and ranking data for this project."}
          </p>
        </div>

        {canManage ? (
          <Button
            asChild
            className="h-11 gap-2 rounded-xl border-0 bg-linear-to-r from-primary to-purple-900 px-6 text-sm font-semibold text-white"
          >
            <a
              href={`/api/connectors/google-search-console/connect?projectId=${projectId}`}
            >
              <Search className="size-4" />
              {reconnect ? "Reconnect" : "Connect Google Search Console"}
            </a>
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
