import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { connectDB } from "@/configs/db";
import User from "@/models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        // 1) Super admin verified directly against env values (no DB record).
        const superEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
        const superPass = process.env.SUPER_ADMIN_PASS;
        if (superEmail && superPass && email === superEmail) {
          if (password === superPass) {
            return {
              id: "super-admin",
              name: "Super Admin",
              email: superEmail,
              role: "super_admin",
            };
          }
          return null;
        }

        // 2) Fall back to a DB-backed user.
        await connectDB();
        const user = await User.findOne({ email }).select("+password");
        if (!user) return null;

        const valid = await user.comparePassword(password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
