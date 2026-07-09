@AGENTS.md

# WSS SEO Manager

Internal dashboard for Web Spider Solutions to manage their SEO projects.

## Stack

- **Next.js 16.2.9** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — CSS-first config in `app/globals.css` via `@theme inline`; there is **no `tailwind.config.*`** file
- **shadcn/ui** (new-york style, Radix base) — all components installed under `components/ui/`
- **NextAuth v5 (Auth.js)** — credentials provider, JWT sessions
- **MongoDB via Mongoose**
- Font: **Rubik** (`next/font`). Theme: **purple** brand — primary `#8C00FF`, secondary `#450693`

## Version-specific gotchas (do not "fix" these)

- **Middleware is renamed "Proxy" in Next 16.** Route protection lives in root `proxy.ts`, not `middleware.ts` (which is deprecated here). Read `node_modules/next/dist/docs/` before touching framework conventions.
- **Tailwind v4 utility renames** apply — e.g. gradients use `bg-linear-to-*`, not `bg-gradient-to-*`.
- **shadcn token semantics:** `--muted`/`--accent`/`--secondary` are *surface* colors, not text colors. For readable muted text use `text-muted-foreground`. The brand purple is wired as the shadcn `--primary`/`--ring`; a supporting `--purple-50…900` scale is also exposed (use `bg-purple-700`, etc.). Avoid raw hex in components — use the theme tokens.
- The app font is applied via `rubik.className` on `<body>` in `app/layout.tsx`.

## Project layout

| Path | Purpose |
|------|---------|
| `auth.ts` | Full NextAuth instance (Credentials `authorize`, DB access). Exports `handlers, auth, signIn, signOut`. |
| `auth.config.ts` | DB-free base config shared with the proxy (`pages`, session strategy, `authorized`/`jwt`/`session` callbacks). **Never import Mongoose/bcrypt here.** |
| `proxy.ts` | Route protection (Next 16 middleware). Matcher: `/projects` + sub-paths. |
| `configs/` | Infrastructure config — `db.ts` is the HMR-safe Mongoose connection (`connectDB`). |
| `models/` | Mongoose models — `User.ts` (bcrypt hashing, `comparePassword`, role enum). |
| `providers/` | Client context providers — `NextAuthProviders` (SessionProvider). |
| `components/ui/` | shadcn primitives (generated; prefer these over raw elements). |
| `components/ui-elements/` | Custom feature UI, e.g. `auth/login/index.tsx`. |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth catch-all handler. |
| `app/projects/` | Protected area (login required). |
| `types/` | Ambient TS, incl. `next-auth.d.ts` (session/JWT augmented with `id`, `role`). |

- Path alias: `@/*` → repo root.

## Auth model

- **Super admin** logs in with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASS` from `.env` — verified directly, **not stored in the DB**.
- Other users resolve from the `User` collection (bcrypt-compared). No public signup.
- `/` redirects authenticated users to `/projects`; `proxy.ts` redirects unauthenticated users away from `/projects` to `/`.

## Environment (`.env`, gitignored)

`MONGODB_URI`, `DB_NAME`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASS`, `AUTH_SECRET`.

Connector/integration keys (read directly via `process.env` in server-only lib modules): `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, `CRON_SECRET`, and **`WINDSOR_API_KEY`** — a single app-wide Windsor.ai key (all projects share one Windsor account; the Windsor connector is API-key based, not per-project OAuth).

## Commands

- `npm run dev` — dev server
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint
- `npx tsc --noEmit` — typecheck (run before committing)

## Conventions

- Add UI primitives with `npx shadcn@latest add <name>`; build features by composing them in `components/ui-elements/`.
- Mongoose models must use the recompile guard (`models.X || model(...)`) to survive HMR.
- Commit only when asked. `.env` is never committed.
