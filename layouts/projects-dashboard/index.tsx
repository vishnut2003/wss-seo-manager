"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssistantLauncher } from "@/components/ui-elements/assistant/assistant-launcher";
import { AppSidebar } from "./_components/app-sidebar";
import { DashboardHeader } from "./_components/dashboard-header";
import type { DashboardUser } from "./_components/nav-items";

export default function ProjectsDashboardLayout({
  user,
  projectId,
  defaultOpen = true,
  currentLabel,
  children,
}: {
  user: DashboardUser;
  projectId: string;
  defaultOpen?: boolean;
  currentLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="bg-linear-to-br from-purple-100 via-purple-50 to-purple-100/70"
      >
        <AppSidebar projectId={projectId} />
        <SidebarInset className="overflow-hidden border border-purple-100/70 bg-white shadow-xl shadow-purple-900/5">
          <DashboardHeader user={user} currentLabel={currentLabel} />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
        <AssistantLauncher
          projectId={projectId}
          projectName={currentLabel}
          role={user.role}
        />
      </SidebarProvider>
    </TooltipProvider>
  );
}
