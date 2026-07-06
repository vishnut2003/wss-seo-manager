import type { UserRole } from "@/models/User";

/** Roles the super admin may assign. The real super admin is env-based and
 *  never stored in the DB, so `super_admin` is intentionally not assignable. */
export const ASSIGNABLE_ROLES = ["admin", "user"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}
