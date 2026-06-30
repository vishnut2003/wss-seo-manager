# Monthly Summary Feature

A per-project **monthly SEO digest**. Once a month, the system pulls the
**previous full calendar month** of data from each connector enabled for a
project, compares it against the month before (month-over-month), asks Claude
(Haiku 4.5) to write a short, human-readable summary, and emails it to the
configured recipients via Resend.

It mirrors the [Daily Summary feature](daily-summary.md) — same dispatcher →
worker → orchestrator → Claude → Resend shape, same `NotificationSetting` model
(`type: "monthly-summary"`) — and differs only in cadence, reporting window, and
the addition of MoM deltas.

---

## 1. High-level flow

```
Vercel Cron (06:00 UTC, 3rd of month)
        │  GET /api/cron/monthly-summary   (Bearer CRON_SECRET)
        ▼
  Dispatcher route
   ├─ connectDB()
   ├─ find all NotificationSetting { type: "monthly-summary", enabled: true }
   └─ for each → POST /api/cron/monthly-summary/run  { projectId }   (fan-out)
                        │   (Promise.allSettled)
                        ▼
              Per-project worker route
               ├─ returns 202 immediately
               └─ after() → runMonthlySummary(projectId)        ← the real work
                                │
                                ▼
                  lib/notifications/monthly-summary.ts
                   ├─ monthRanges() → current + previous calendar month (UTC)
                   ├─ for each enabled connector:
                   │     getValidAccessToken(conn)
                   │     getMonthlySnapshot(token, …, current, previous)
                   │       → format a markdown "block" with MoM deltas
                   ├─ summarize(prompt)        → Claude writes HTML body
                   ├─ renderEmail(…)           → branded HTML shell
                   └─ sendEmail(…)             → Resend
```

## 2. What differs from the daily summary

- **Schedule:** `0 6 3 * *` (06:00 UTC on the **3rd** of each month) in
  `vercel.json`. Running a few days into the month lets GSC's ~2–3 day lag
  settle for the final days of the period.
- **Window:** the previous full calendar month. `monthRanges()` (in
  `lib/notifications/monthly-summary.ts`) computes `current` and `previous`
  `{ startDate, endDate }` in UTC plus a human `label` (e.g. "June 2026").
- **Shared boundaries:** the orchestrator computes one range and passes it to
  **both** connectors, so GSC and GA4 cover the *same* month (the daily feature's
  intentional date mismatch does not apply here).
- **Month-over-month:** new `getMonthlySnapshot` helpers in
  `lib/google/search-console.ts` and `lib/google/analytics.ts` fetch the prior
  month's totals too. The orchestrator's `delta()` renders
  `▲ 12% MoM` / `▼ 8% MoM` / `flat MoM` / `new vs prior month` next to each count
  metric, and the prompt asks Claude to narrate the trends.
  - GSC: two `querySearchAnalytics` totals calls (current + previous) plus top 5
    queries, in one `Promise.all`.
  - GA4: one `runReport` with **two `dateRanges`** → row 0 = current, row 1 =
    previous; top pages/channels use the current range only.

Everything else — the dispatcher/worker split for the Vercel **Hobby 60s** cap,
`after()` + `202`, per-connector error degradation, `skipped: …` statuses,
manager-only writes, the branded purple email shell — is identical to daily.

## 3. The settings UI

Route: **`/projects/[projectId]/notifications/monthly-summary`** (already linked
from the sidebar "Notification" section). Same three-file shape as daily:
`page.tsx`, `_components/monthly-summary-form.tsx`, and `actions.ts`
(`updateMonthlySummarySettings`, `sendTestMonthlySummary`). The
**Send test summary now** button calls `runMonthlySummary(projectId, { force: true })`.

## 4. Environment variables

Identical to the daily summary — `CRON_SECRET`, `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MONGODB_URI` / `DB_NAME` — no new vars.
