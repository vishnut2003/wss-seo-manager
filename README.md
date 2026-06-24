# WSS SEO Manager

Internal dashboard for **Web Spider Solutions** to manage SEO projects for their clients.

## Tech Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (CSS-first config — no `tailwind.config` file)
- **shadcn/ui** (new-york, Radix base) — all components installed
- **NextAuth v5 (Auth.js)** — credentials provider, JWT sessions
- **MongoDB** via **Mongoose**
- **Rubik** font · purple brand theme (primary `#8C00FF`, secondary `#450693`)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```bash
# Database
MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/?appName=..."
DB_NAME="wss_seo_manager"

# Super admin (verified directly against these values at login)
SUPER_ADMIN_EMAIL="admin@example.com"
SUPER_ADMIN_PASS="change-me"

# NextAuth — generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_SECRET="<random-base64-string>"
```

> `.env` is gitignored — never commit secrets.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on the login page; sign in with the super-admin credentials to reach `/projects`.

## Authentication

- The **login page is the home route** (`/`). Authenticated users are redirected to `/projects`.
- **`/projects` and all sub-paths require login**, enforced by `proxy.ts` (Next.js 16's renamed middleware).
- The **super admin** authenticates against `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASS` from `.env` (no DB record).
- Additional users are stored in the `User` collection (passwords bcrypt-hashed). There is no public signup.

## Project Structure

```
auth.ts                     # NextAuth instance (Credentials authorize, DB access)
auth.config.ts              # DB-free base config shared with the proxy
proxy.ts                    # Route protection for /projects (Next 16 "Proxy")
configs/db.ts               # HMR-safe Mongoose connection
models/User.ts              # User schema (bcrypt, roles)
providers/                  # Client providers (SessionProvider)
types/next-auth.d.ts        # Session/JWT type augmentation
app/
  layout.tsx                # Root layout (Rubik font, providers, toaster)
  page.tsx                  # Login page (redirects if authed)
  projects/                 # Protected area
  api/auth/[...nextauth]/   # NextAuth route handler
components/
  ui/                       # shadcn/ui primitives
  ui-elements/              # Custom feature UI (e.g. auth/login)
app/globals.css             # Tailwind v4 theme + brand tokens
```

Path alias: `@/*` maps to the repo root.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Notes for Contributors

- This is a **modified Next.js 16** — conventions can differ from older versions (e.g. middleware → `proxy.ts`). Check `node_modules/next/dist/docs/` and see `CLAUDE.md` for project-specific guidance.
- Add UI primitives with `npx shadcn@latest add <component>`; compose features in `components/ui-elements/`.
- Use theme tokens (`bg-primary`, `text-muted-foreground`, `bg-purple-*`) rather than raw hex values.
- Run `npx tsc --noEmit` before committing.
