# Daily Summary Feature

A per-project **daily SEO digest**. Once a day, the system pulls the latest
complete day of data from each connector enabled for a project, asks Claude
(Haiku 4.5) to write a short, human-readable summary, and emails it to the
configured recipients via Resend.

It was added in commit `44ade07` ("Add Daily Summary feature").

---

## 1. High-level flow

```
Vercel Cron (06:00 UTC daily)
        │  GET /api/cron/daily-summary   (Bearer CRON_SECRET)
        ▼
  Dispatcher route
   ├─ connectDB()
   ├─ find all NotificationSetting { type: "daily-summary", enabled: true }
   └─ for each → POST /api/cron/daily-summary/run  { projectId }   (fan-out)
                        │   (Promise.allSettled, not awaited deeply)
                        ▼
              Per-project worker route
               ├─ returns 202 immediately
               └─ after() → runDailySummary(projectId)        ← the real work
                                │
                                ▼
                  lib/notifications/daily-summary.ts
                   ├─ load NotificationSetting + Project
                   ├─ for each enabled connector:
                   │     getValidAccessToken(conn)
                   │     getDailySnapshot(...)  → format a markdown "block"
                   ├─ summarize(prompt)        → Claude writes HTML body
                   ├─ renderEmail(...)         → wrap in branded HTML shell
                   └─ sendEmail(...)           → Resend
```

The split into **dispatcher → worker** exists to stay inside Vercel's Hobby
**60-second** function limit: instead of one function processing every project
serially, each project gets its own `≤60s` invocation.

---

## 2. The pieces

### Data model — `models/NotificationSetting.ts`

One MongoDB document per `(projectId, type)`. `type` is a union
(`"daily-summary" | "monthly-summary"`) so the model is generic over cadence;
only `daily-summary` is wired up today.

| Field | Meaning |
|-------|---------|
| `projectId` | The project this setting belongs to (indexed). |
| `type` | `"daily-summary"`. |
| `enabled` | Master on/off switch for the automatic send. |
| `recipients` | `string[]` of email addresses. |
| `enabledConnectors` | Which providers to include (`google-search-console`, `google-analytics`). |
| `lastSentAt` | Timestamp of the last successful send. |
| `lastStatus` | Outcome of the last run (`"sent"`, `"skipped: no data"`, etc.). |

A **unique compound index** on `{ projectId, type }` guarantees one settings
document per type per project, which is what the `upsert` in the save action
relies on.

### Cron config — `vercel.json`

```json
{ "crons": [ { "path": "/api/cron/daily-summary", "schedule": "0 6 * * *" } ] }
```

Runs once a day at **06:00 UTC**. Vercel calls the dispatcher with an
`Authorization: Bearer <CRON_SECRET>` header.

### Dispatcher — `app/api/cron/daily-summary/route.ts` (GET)

- Rejects the request unless the `Authorization` header equals
  `Bearer ${CRON_SECRET}` (and `CRON_SECRET` must be set, else 401).
- Loads every `NotificationSetting` with `type: "daily-summary"` and
  `enabled: true`, selecting only `projectId`.
- Fans out a `POST` to the worker route for each project (using
  `request.nextUrl.origin` as the base URL) inside `Promise.allSettled`, so one
  failing project never blocks the others.
- Returns `{ dispatched: <count> }` quickly. `maxDuration = 60`.

### Per-project worker — `app/api/cron/daily-summary/run/route.ts` (POST)

- Same `CRON_SECRET` bearer-token check.
- Reads `{ projectId }` from the JSON body; 400 if missing.
- Schedules the heavy work with **`after()`** (Next.js) so it runs *after* the
  response is sent, then immediately returns **`202 Accepted`**. This keeps the
  HTTP request short while the summary generation/email send happens in the
  background, each with its own `≤60s` budget.
- Any thrown error is swallowed here because `runDailySummary` records failures
  into `lastStatus` itself.

### Orchestrator — `lib/notifications/daily-summary.ts`

`runDailySummary(projectId, { force? })` is the core. Server-only. Steps:

1. `connectDB()` and load the `NotificationSetting`. If none → `skipped: not configured`.
2. **Guard checks** (each writes `lastStatus` and returns):
   - `!enabled && !force` → `skipped: disabled`
   - no recipients → `skipped: no recipients`
   - no enabled connectors → `skipped: no connectors`
   - project not found → `skipped: project not found`
3. For each enabled connector, build a markdown **block**:
   - Look up the `Connection` for `(projectId, provider)`. If missing →
     "Not connected." block.
   - `getValidAccessToken(conn)` (refreshes the Google OAuth token as needed).
   - **Google Search Console** → `gscDailySnapshot(token, siteUrl)`: emits
     clicks, impressions, CTR, avg position, and top 5 queries for its latest
     available day. Requires `conn.siteUrl`.
   - **Google Analytics** → `gaDailySnapshot(token, propertyId)`: emits
     sessions, total users, page views, avg session duration, top 5 pages, top 5
     channels for **yesterday**. Requires `conn.propertyId`.
   - Per-connector errors are caught and turned into a friendly note:
     `GoogleReconnectError` → "Authorization expired — needs reconnect.",
     anything else → "Data temporarily unavailable." (one bad connector never
     kills the whole digest).
4. If **no connector produced real data** → `skipped: no data` (no email sent).
5. `buildPrompt(...)` assembles the analyst instructions + data blocks, then
   `summarize(prompt)` calls Claude to write the email **body HTML**.
6. `renderEmail(...)` wraps that body in a branded purple HTML shell.
7. `sendEmail({ to: recipients, subject, html })` via Resend.
8. `finish("sent", true)` → sets `lastStatus = "sent"` and `lastSentAt = now`.

### Snapshot helpers (the data sources)

- **`lib/google/search-console.ts` → `getDailySnapshot`**: queries the last ~6
  days by `date`, picks the **most recent day that has data** (GSC lags ~2–3
  days), then pulls that day's top queries. Returns `{ date, totals, topQueries }`;
  `date: null` means no recent data.
- **`lib/google/analytics.ts` → `getDailySnapshot`**: GA4 has no reporting lag,
  so it requests `startDate/endDate = "yesterday"` and returns totals + top
  pages + top channels.

Because the two sources report **different dates**, the prompt explicitly tells
Claude about the GSC lag and each block is stamped with its own date so the
email is unambiguous.

### Claude client — `lib/anthropic.ts`

Minimal `fetch`-based wrapper over the Anthropic **Messages API**
(`POST /v1/messages`). Model: **`claude-haiku-4-5`**, `max_tokens` 1024 by
default. Needs `ANTHROPIC_API_KEY`. Returns the concatenated text of the
response. The prompt constrains output to clean HTML body tags only
(`<h2>`, `<h3>`, `<p>`, `<ul>`, `<li>`, `<strong>`) — no `<html>`/`<body>`,
no markdown, no code fences.

### Email client — `lib/email.ts`

Wraps the **Resend** SDK. Lazily constructs the client from `RESEND_API_KEY`.
The `from` address comes from `RESEND_FROM_EMAIL` (a bare address is prefixed
with the display name `WSS SEO Manager <...>`; a full `Name <a@b.com>` string is
used as-is). Throws on Resend errors.

### Email template — `renderEmail()`

Inline-styled HTML (email clients need inline CSS): a purple gradient header
(`#8C00FF → #450693`) with the project name, a white card containing Claude's
generated body, and a "Generated with Claude" footer.

---

## 3. The settings UI

Route: **`/projects/[projectId]/notifications/daily-summary`**

### Page — `page.tsx` (Server Component)

- Validates the `projectId`, loads the `Project`, the existing
  `NotificationSetting`, and all `Connection`s for the project in parallel.
- Determines `canManage` from the session role
  (`super_admin` or `admin` only).
- For each supported provider, computes whether it's **configured**
  (GSC needs `siteUrl`, GA needs `propertyId`) and whether it's currently
  enabled in the setting.
- Renders an explanatory "How it works" card + the `DailySummaryForm`.

### Form — `_components/daily-summary-form.tsx` (Client Component)

- Controls: an **enable** switch, a comma-separated **recipients** input, and a
  per-connector **include** switch (disabled when a connector isn't configured,
  with a deep link to connect it).
- **Save changes** → `updateDailySummarySettings` server action.
- **Send test summary now** → `sendTestSummary` server action.
- Non-managers see everything **read-only** (no footer actions).

### Server actions — `actions.ts`

Both actions re-check auth and **manager role** server-side (never trust the
client), and validate the `projectId`.

- **`updateDailySummarySettings`**: splits/trims/validates recipient emails
  against a regex, filters `enabledConnectors` to known providers, enforces that
  enabling requires ≥1 recipient and ≥1 connector, then `upsert`s the
  `NotificationSetting`. Revalidates the page.
- **`sendTestSummary`**: calls `runDailySummary(projectId, { force: true })` —
  the `force` flag bypasses the `enabled` guard so a test can be sent before the
  feature is switched on. Surfaces the run `status` as the error if it isn't
  `"sent"`.

---

## 4. Environment variables

| Variable | Used by | Purpose |
|----------|---------|---------|
| `CRON_SECRET` | dispatcher + worker | Bearer token that authorizes cron calls. |
| `ANTHROPIC_API_KEY` | `lib/anthropic.ts` | Claude Messages API auth. |
| `RESEND_API_KEY` | `lib/email.ts` | Resend SDK auth. |
| `RESEND_FROM_EMAIL` | `lib/email.ts` | Verified sender address. |
| `MONGODB_URI` / `DB_NAME` | `configs/db.ts` | DB connection (shared app config). |

Plus the Google OAuth connection records and refresh tokens that
`getValidAccessToken` relies on (configured per-project via the GSC/GA
connectors).

---

## 5. Design notes & gotchas

- **Why two routes?** The dispatcher fans out so each project's summary runs in
  its own function invocation, keeping every run under the Vercel Hobby 60s cap.
- **`after()` + `202`**: the worker acknowledges fast and does the slow
  Claude/Resend work in the background. Failures are persisted to
  `lastStatus`, not returned to the caller.
- **Resilience**: a missing/broken connector degrades to a note in the email
  rather than failing the whole digest. If *no* connector has data, no email is
  sent at all (`skipped: no data`).
- **Date mismatch is intentional**: GSC lags ~2–3 days vs GA4's "yesterday";
  the email labels each source's exact date and the prompt warns Claude.
- **Manager-only writes**: both the page UI and the server actions gate
  configuration and test-sends behind the `super_admin`/`admin` role.
- **Generic by design**: `NotificationType` already includes
  `"monthly-summary"`, so a monthly cadence can reuse the same model and
  patterns.
