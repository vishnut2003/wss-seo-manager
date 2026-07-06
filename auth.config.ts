import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/models/User";

/**
 * Base config shared with the proxy (middleware). It must NOT import Mongoose,
 * bcrypt, or any Node-only modules so it stays lightweight. The Credentials
 * provider (which touches the DB) is added separately in `auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // /admin is super-admin only. Non-super-admins who are logged in get
      // sent back to their dashboard; visitors get the default sign-in redirect.
      if (nextUrl.pathname.startsWith("/admin")) {
        if (!isLoggedIn) return false;
        if (auth.user.role !== "super_admin") {
          return Response.redirect(new URL("/projects", nextUrl));
        }
        return true;
      }

      const isProtected = nextUrl.pathname.startsWith("/projects");
      if (isProtected) return isLoggedIn;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as UserRole;
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
