"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  buildNavSections,
  buildSettingsItem,
  type NavItem,
} from "./nav-items";

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavButton({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <SidebarMenuButton
      asChild
      isActive={active}
      tooltip={item.title}
      className={cn(
        "relative h-11 gap-3 rounded-xl pl-2 text-muted-foreground transition-all [&_svg]:size-5",
        "hover:bg-purple-50/70 hover:text-foreground",
        "data-[active=true]:bg-purple-50 data-[active=true]:font-semibold data-[active=true]:text-primary data-[active=true]:shadow-sm data-[active=true]:shadow-primary/10",
        // left accent bar (hidden when collapsed to icons)
        "before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:opacity-0 before:transition-opacity data-[active=true]:before:opacity-100 group-data-[collapsible=icon]:before:hidden",
        // tidy icon-only collapsed state: centered square; tile carries the highlight
        "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:data-[active=true]:bg-transparent group-data-[collapsible=icon]:data-[active=true]:shadow-none"
      )}
    >
      <Link href={item.href}>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-100/60 text-primary transition-colors",
            "group-data-[active=true]/menu-button:bg-linear-to-br group-data-[active=true]/menu-button:from-primary group-data-[active=true]/menu-button:to-purple-900 group-data-[active=true]/menu-button:text-white group-data-[active=true]/menu-button:shadow-md group-data-[active=true]/menu-button:shadow-primary/30"
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="group-data-[collapsible=icon]:hidden">
          {item.title}
        </span>
      </Link>
    </SidebarMenuButton>
  );
}

export function AppSidebar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const sections = buildNavSections(projectId);
  const settingsItem = buildSettingsItem(projectId);

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="**:data-[slot=sidebar-inner]:rounded-2xl **:data-[slot=sidebar-inner]:border **:data-[slot=sidebar-inner]:border-purple-100/70 **:data-[slot=sidebar-inner]:shadow-sm"
    >
      <SidebarHeader className="border-b border-purple-100/70 pb-3">
        <Link
          href="/projects"
          className="flex items-center gap-2.5 px-1 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-900 text-base font-bold text-white shadow-lg shadow-primary/30">
            W
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden min-w-max">
            <span className="text-sm leading-tight font-semibold tracking-tight text-purple-900">
              WSS SEO Manager
            </span>
            <span className="text-xs leading-tight text-muted-foreground">
              SEO Management Suite
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1 pt-2 group-data-[collapsible=icon]:items-center">
        {sections.map((section) => (
          <SidebarGroup
            key={section.label}
            className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-0.5"
          >
            <SidebarGroupLabel className="text-[0.65rem] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <NavButton
                      item={item}
                      active={isItemActive(pathname, item)}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-purple-100/70 pt-3 group-data-[collapsible=icon]:items-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <NavButton
              item={settingsItem}
              active={isItemActive(pathname, settingsItem)}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
