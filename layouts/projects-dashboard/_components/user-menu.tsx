"use client";

import { signOut } from "next-auth/react";
import { LogOut, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DashboardUser } from "./nav-items";

function formatRole(role?: string): string {
  if (!role) return "Member";
  return role
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function UserMenu({ user }: { user: DashboardUser }) {
  const initial = (user.email?.[0] ?? user.name?.[0] ?? "U").toUpperCase();
  const name = user.name ?? "Account";
  const role = formatRole(user.role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-1.5 outline-none transition hover:bg-purple-50 focus-visible:ring-2 focus-visible:ring-primary/40 sm:pl-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm leading-tight font-medium text-foreground">
            {name}
          </p>
          <p className="text-xs leading-tight text-muted-foreground">{role}</p>
        </div>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-linear-to-br from-primary to-purple-900 text-sm font-semibold text-white">
            {initial}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-linear-to-br from-primary to-purple-900 text-sm font-semibold text-white">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <div className="px-2 pb-1.5">
          <Badge className="bg-purple-100 text-primary">{role}</Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => signOut({ redirectTo: "/" })}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
