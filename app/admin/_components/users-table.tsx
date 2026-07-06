"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditUserDialog } from "./edit-user-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";
import type { UserView } from "./types";

function RoleBadge({ role }: { role: UserView["role"] }) {
  if (role === "super_admin") {
    return (
      <Badge className="border-purple-300 bg-purple-100 text-purple-900">
        Super Admin
      </Badge>
    );
  }
  if (role === "admin") {
    return (
      <Badge className="border-purple-200 bg-purple-50 text-purple-700">
        Admin
      </Badge>
    );
  }
  return <Badge variant="secondary">User</Badge>;
}

export function UsersTable({ users }: { users: UserView[] }) {
  const [editing, setEditing] = useState<UserView | null>(null);
  const [deleting, setDeleting] = useState<UserView | null>(null);

  return (
    <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
      <CardHeader>
        <CardTitle className="text-base">Users</CardTitle>
        <CardDescription>
          Accounts that can sign in to the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No users yet. Create the first one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="max-w-xs truncate font-medium text-foreground">
                    {user.name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${user.name}`}
                        onClick={() => setEditing(user)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${user.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(user)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {editing && (
        <EditUserDialog
          key={editing.id}
          user={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
      {deleting && (
        <DeleteUserDialog
          user={deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
        />
      )}
    </Card>
  );
}
