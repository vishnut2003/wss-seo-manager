"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { type DashboardUser } from "./nav-items";
import { UserMenu } from "./user-menu";

interface Crumb {
  href: string;
  label: string;
  isLast: boolean;
}

function humanize(segment: string): string {
  // Truncate opaque ids (e.g. a Mongo ObjectId); humanize real slugs.
  if (/^[a-f0-9]{12,}$/i.test(segment)) return `${segment.slice(0, 6)}…`;
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";

  segments.forEach((segment, i) => {
    href += `/${segment}`;
    const label = segment === "projects" ? "Projects" : humanize(segment);
    crumbs.push({ href, label, isLast: i === segments.length - 1 });
  });

  return crumbs;
}

export function DashboardHeader({
  user,
  currentLabel,
}: {
  user: DashboardUser;
  currentLabel?: string;
}) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  // Replace the project-id crumb (/projects/<id>) with the resolved name.
  if (currentLabel && crumbs.length > 1) {
    crumbs[1].label = currentLabel;
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-purple-100 bg-white/80 px-4 backdrop-blur sm:px-6">
      <SidebarTrigger className="text-muted-foreground" />
      <Separator orientation="vertical" className="h-6! self-center" />

      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb) => (
            <Fragment key={crumb.href}>
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage className="font-medium">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!crumb.isLast && (
                <BreadcrumbSeparator className="flex items-center" />
              )}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
