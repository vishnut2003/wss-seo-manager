import {
  LayoutDashboard,
  Search,
  BarChart3,
  Waypoints,
  Settings,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Active only on an exact pathname match (used for the project root). */
  exact?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export function buildNavSections(projectId: string): NavSection[] {
  const base = `/projects/${projectId}`;
  return [
    {
      label: "Overview",
      items: [
        { title: "Dashboard", href: base, icon: LayoutDashboard, exact: true },
      ],
    },
    {
      label: "Connectors",
      items: [
        {
          title: "Google Search Console",
          href: `${base}/connectors/google-search-console`,
          icon: Search,
        },
        {
          title: "Google Analytics",
          href: `${base}/connectors/google-analytics`,
          icon: BarChart3,
        },
        {
          title: "Windsor.ai",
          href: `${base}/connectors/windsor`,
          icon: Waypoints,
        },
      ],
    },
    {
      label: "Updates",
      items: [
        {
          title: "Daily Submission",
          href: `${base}/updates/daily-submission`,
          icon: ClipboardCheck,
        },
      ],
    },
    {
      label: "Notification",
      items: [
        {
          title: "Daily Summary",
          href: `${base}/notifications/daily-summary`,
          icon: CalendarDays,
        },
        {
          title: "Monthly Summary",
          href: `${base}/notifications/monthly-summary`,
          icon: CalendarRange,
        },
      ],
    },
  ];
}

export function buildSettingsItem(projectId: string): NavItem {
  return {
    title: "Settings",
    href: `/projects/${projectId}/settings`,
    icon: Settings,
  };
}

export interface DashboardUser {
  name?: string | null;
  email?: string | null;
  role?: string;
}
