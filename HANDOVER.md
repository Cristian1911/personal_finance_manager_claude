# HANDOVER — 2026-05-21 — Hero V7 + Resumen aggregates + parity walkthrough

> Supersedes the 2026-05-03 (Phase 3 wrap) handover. Earlier handovers in git history (`HANDOVER.md@HEAD~N`).

## What landed since the last handover (2026-05-03)

| PR | Summary | Date |
|---|---|---|
| #252 | Mobile Phase 4 account heroes — flip/pulse/graph + `QuickActionsBar` shell | 2026-05-10 |
| #254 | Optional time-of-day + opt-in location for transactions | 2026-05-13 |
| #255 | BACKLOG: mark type-gen regen as "do not attempt" | 2026-05-14 |
| #257 | Mobile ↔ webapp parity audit doc (26 mobile screens × 4 batches) | 2026-05-21 |
| #258 | Parity quick-wins — 5 cheap fixes from the 5/21 audit | 2026-05-21 |
| #259 | Bump `expo-task-manager` + `expo-location` to SDK 55 versions | 2026-05-21 |
| #253 | Parity audit re-sweep — BACKLOG prune (5/16 follow-up) | 2026-05-21 |
| #260 | BACKLOG: 10 findings from the live mobile↔webapp walkthrough | 2026-05-21 |
| #264 | **V7 hybrid runway hero — Option A canonical predictive runway** | 2026-05-21 |
| #265 | Email-ingest — recognize new "Recibiste un pago" Bancolombia template | 2026-05-21 |
| #262 | **Canonical Resumen del mes aggregates via `@zeta/shared`** | 2026-05-21 |

### Both ❌ CRITICAL parity findings from the 5/21 walkthrough are now resolved
- Finding 1 (Resumen del mes aggregates disagreed by 7-33×) → **#262**. `computeMonthlyAggregates()` in `@zeta/shared` is now the single source; mobile repo + webapp action both consume it.
- Finding 2 (Dashboard hero gave opposite verdicts) → **#264**. `computeRitmo()` + `deriveRitmoStatus()` + shared `BUCKET_LABEL` / `WEEKDAYS_MONDAY_START` / `weekdayMondayStart` in `@zeta/shared`. Both surfaces render the same V7 hybrid hero (predictive runway + clickable calendar heatmap).

### Hero V7 specifics worth knowing
- Headline = today's actual spend (`spentToday`), tone tracks status pill — overspend goes red on both today AND period strain.
- Expand → two views: "Cómo se calcula" (line-by-line) and "Patrón del mes" (clickable calendar heatmap).
- Webhook cache-invalidation fix: `revalidateFinancialViewsFromWebhook()` (uses `revalidateTag(tag, "zeta")`) for Route Handler contexts where `updateTag` no-ops on the Router Cache half.
- All hero sub-components (`HeroSparkline`, `CalculoView`, `CalendarHeatmap` web; `Sparkline`, `CalcView`, `PatternView` native) are wrapped in `React.memo` so day selection doesn't cascade.
- Mobile NativeWind v3 footgun documented: `bg-z-foo/N` opacity classes silently render transparent — use the pre-computed `bg-z-foo-N` tokens from `mobile/tailwind.config.js`.

## Repo state

- **Local main**: synced to `origin/main`. No uncommitted changes.
- **0 open PRs.** The 7 open PRs from earlier today were either merged (#253, #260, #262, #264 already merged before this session, #265) or closed as superseded/stale (#98 demo mode → already on main via different path, #190 planner drag-and-drop → 5+ weeks stale + conflicting, #261 + #263 → superseded by ship).
- Test gates: `@zeta/shared` ritmo + monthly-aggregates suites pass (16/16). Webapp `pnpm build` clean. Pre-existing test failures in `auto-categorize` / `debt-stats` exist on main but are unrelated to this work.

## Next session — pick one

### A. Mobile TX detail screen feature parity *(highest-impact UX gap)*
**What:** From #260 walkthrough finding M4–M7: mobile TX detail is missing destinatario picker, etiquetas/tag UI, "Hacer recurrente" promote button, "Vincular" link-to-recurring action, and proper destructive "Eliminar" styling. Mobile users open this screen dozens of times a day; webapp users get the full edit surface.
**Where:** `mobile/app/transaction/[id].tsx` mirrors `webapp/src/components/transactions/transaction-form-dialog.tsx`.
**Scope:** Single screen; touches mobile-only UI plus existing repository methods. Spawn `mobile-webapp-parity` first.

### B. Remaining 7 ⚠️ items from the 5/21 walkthrough
Tracked in `BACKLOG.md` (search for "live walkthrough findings (2026-05-21)"). Smaller individually, but together they're a session's worth of work: attention count mismatch (M5), header avatar divergence (M6), import wizard step parity 4-vs-6 (M7), mobile a11y labels (M8), webapp internal "uncategorized" count drift (M9), Ajustes typo (M10), row-expand affordance gaps (M4).

### C. Telegram webhook RPCs *(security/correctness)*
**What:** `set_capture_token_label` + `find_capture_token_by_chat_id` SECURITY DEFINER RPCs. The current admin-client path in `webapp/src/app/api/webhooks/telegram/route.ts` silently returns NULL because admin client can't decrypt envelope-encrypted views — so `/start <token>` and `/vincular <token>` never link a chat end-to-end.
**Scope:** Supabase migration + webhook refactor. Spawn `supabase-migrator`.

### D. Mobile App Store / Play compliance prep
**What:** targetSdk, version bump, permissions audit, disclaimer strings. User-blocked on assets; tech prep can run in parallel.

### E. Deferred Phase 2 dashboard widgets *(biggest single perceived-quality jump)*
HealthZone, Flujo, Heatmap, BurnRate, Runway, DashboardHero/StatusHeadline on mobile. Skia chart work; spawn `mobile-perf-doctor`.

## Recommended: A (TX detail mobile parity)

Highest-impact single screen, contained scope, sets the rhythm for the remaining mobile parity items in section B. Once TX detail is at parity, the row-expand affordance gap (M4) collapses naturally because the deeper drawer surfaces the same controls.

## Carry-overs still valid from the 2026-05-03 handover
- **PaymentSheet atomic balance update** — Gemini's race-condition flag on PR #247. `updateAccountBalanceRemote` reads then writes a computed value; needs a Supabase RPC with row-level locking. Spawn `supabase-migrator`.
- **Wishlist reflections sync table** — `wishlist_reflections` SQLite schema + push/pull + repo. Deferred from PR #249.
- **Nudge variants `debt_milestone` + `budget_surplus`** — port webapp's cross-table heuristic.
