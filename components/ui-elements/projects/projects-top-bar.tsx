"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Users } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectsTopBar({
  email,
  isSuperAdmin = false,
}: {
  email?: string | null;
  isSuperAdmin?: boolean;
}) {
  const initial = (email?.[0] ?? "U").toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-purple-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-900 text-lg font-bold text-white shadow-lg shadow-primary/30">
            W
          </div>
          <span className="text-base font-semibold tracking-tight text-purple-900">
            WSS SEO Manager
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-linear-to-br from-primary to-purple-900 text-sm font-semibold text-white">
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-xs font-normal text-muted-foreground">
                Signed in as
              </span>
              <span className="truncate text-sm font-medium">{email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isSuperAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <Users className="size-4" />
                  Manage Users
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => signOut({ redirectTo: "/" })}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
