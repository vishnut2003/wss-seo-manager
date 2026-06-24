"use client";

import { useState } from "react";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-linear-to-br from-purple-900 via-purple-800 to-primary px-4 py-10">
      {/* Decorative glow blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-purple-400/30 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-purple-900/40 md:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between bg-linear-to-br from-primary to-purple-900 p-10 text-white md:flex">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur-sm">
              W
            </div>
            <span className="text-lg font-semibold tracking-tight">
              WSS SEO Manager
            </span>
          </div>

          <div className="relative">
            <h2 className="text-3xl font-bold leading-tight">
              Rank higher.
              <br />
              Work smarter.
            </h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/80">
              Track rankings, audits, and content for every client from a single
              dashboard.
            </p>

            <ul className="mt-8 flex flex-col gap-3 text-sm text-white/90">
              {[
                "Real-time keyword tracking",
                "Automated site audits",
                "Client-ready reports",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/60">
            © {new Date().getFullYear()} Web Spider Solutions
          </p>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center p-8 sm:p-12">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-900 text-lg font-bold text-white">
              W
            </div>
            <span className="text-lg font-semibold tracking-tight text-purple-800">
              WSS SEO Manager
            </span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to continue to your dashboard.
            </p>
          </div>

          {/* Form (UI only — no auth wired) */}
          <form className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-border bg-purple-50/40 py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 transition focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-purple-50/40 py-3 pl-11 pr-12 text-sm text-foreground placeholder:text-muted-foreground/60 transition focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-purple-50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-4 w-4 rounded border-border accent-primary focus:ring-primary/30"
                />
                Remember me
              </label>
              <a
                href="#"
                className="font-medium text-primary transition hover:text-purple-700"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className="mt-1 w-full rounded-xl bg-linear-to-r from-primary to-purple-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:shadow-xl hover:shadow-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 active:scale-[0.99]"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need access?{" "}
            <a
              href="#"
              className="font-medium text-primary transition hover:text-purple-700"
            >
              Contact your admin
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}
