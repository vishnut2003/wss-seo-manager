import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16: middleware is now "Proxy". This guards /projects and /admin
// (plus sub-paths). Uses the db-free authConfig so Mongoose/bcrypt are never
// bundled here.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/projects", "/projects/:path*", "/admin", "/admin/:path*"],
};
