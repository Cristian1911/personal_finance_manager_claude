# HANDOVER — 2026-05-21 — Hero V7 + Resumen aggregates + parity walkthrough + TX detail parity

> Supersedes the 2026-05-03 (Phase 3 wrap) handover. Earlier handovers in git history (`HANDOVER.md@HEAD~N`).

## Latest session (2026-05-21, late) — Mobile TX detail + parity quick wins

Closed 7 of the 10 parity findings from the 5/21 live walkthrough (BACKLOG entry "Mobile ↔ Webapp parity — live walkthrough findings"). Webapp build clean; mobile `tsc --noEmit` clean. Branch off `main`.

**Mobile TX detail** (`mobile/app/transaction/[id].tsx`) is now at feature parity with webapp `webapp/src/app/(dashboard)/transactions/[id]/transaction-detail-client.tsx` for the core actions:
- **Destinatario picker** — new `mobile/components/transactions/DestinatarioPicker.tsx` (bottom-sheet, mirrors `CategoryPicker` style). Read-only row in detail view; full picker in edit form. `getTransactionById` LEFT JOINs `destinatarios` so `destinatario_name` is shown without an extra fetch.
- **Etiquetas/tags UI** — tag chips render in the read-only view (brass tone, matches webapp); the previously-unused `TagSelector` is now rendered inside the edit form between Notes and Exclude.
- **Hacer recurrente** — inline action button creates a MONTHLY `recurring_transaction_templates` row from the current tx (account, amount, currency, day_of_month, merchant_name, category_id, destinatario_id all prefilled). Hidden for debt-payment tx (would need transfer_source_account_id picker).
- **Vincular a recurrente** — new repo fns in `mobile/lib/repositories/recurring.ts`: `getCandidateOccurrencesForTransaction`, `linkExistingTransactionToOccurrence`, `getAccountIdsWithPendingOccurrences`, `isTransactionLinkedToOccurrence`. The link function ports webapp's `computeRecurringGroupUuid` (SHA-256 via `expo-crypto`, RFC v4 version/variant bits) and stamps `recurrence_group_id` on the tx + inherits the template's category if the tx has none + auto-deactivates ONCE templates. New `VincularPicker` bottom-sheet displays candidates sorted by match score (date proximity 0.6 + amount proximity 0.4, ±30-day window, same account + direction).
  - **Known gap (documented in BACKLOG):** cross-account debt-payment vinculación (webapp's `isCrossAccountDebtPayment` branch) is not supported on mobile yet.
- **Destructive Eliminar button** — rendered prominently in detail body with proper `text-z-debt / border-z-debt/20 / bg-z-debt/8` styling and `accessibilityLabel`. The header trash icon also got `accessibilityLabel + accessibilityRole`.
- **Label parity** — "Excluir de totales" → "Excluir de métricas" (matches webapp).

**Quick wins** (same session):
- Mobile `(tabs)/menu.tsx` Ajustes hint: "sincronizacion" → "sincronización".
- Mobile dashboard `summary.attention.pendingEmails` no longer hardcoded to 0 — new `mobile/lib/repositories/pending-email.ts::getPendingEmailTransactionsCount()` issues a remote Supabase count (head: true) and returns 0 on offline/auth failure.
- `MovimientosUtilidades.tsx` Filtrar + Limpiar pills now have `accessibilityLabel`.

**Files changed (mobile):**
- `mobile/app/transaction/[id].tsx` — destinatario, tags, promote, vincular, destructive Eliminar, a11y labels, label fix.
- `mobile/app/(tabs)/menu.tsx` — typo fix.
- `mobile/components/movimientos/MovimientosUtilidades.tsx` — a11y labels on filter pills.
- `mobile/components/transactions/DestinatarioPicker.tsx` — new.
- `mobile/components/transactions/VincularPicker.tsx` — new.
- `mobile/lib/dashboard/useDashboardData.ts` — call new pending-email count.
- `mobile/lib/repositories/pending-email.ts` — new.
- `mobile/lib/repositories/recurring.ts` — `getCandidateOccurrencesForTransaction`, `linkExistingTransactionToOccurrence`, `getAccountIdsWithPendingOccurrences`, `isTransactionLinkedToOccurrence`, `computeRecurringGroupUuid` (private).
- `mobile/lib/repositories/transactions.ts` — `getTransactionById` LEFT JOIN destinatarios for `destinatario_name`.

**Remaining 3 walkthrough items (still in BACKLOG):**
- #4 Row-expand affordances asymmetric — webapp row expand has destinatario + tag picker + Vincular; mobile has only category chip + Editar. Now that mobile TX detail is at parity, the cleaner fix may be to slim the webapp expand to just category and let the deeper drawer be the canonical surface. Decide direction before implementing.
- #7 Mobile import wizard 4 vs webapp 6 — Destinatarios step missing on mobile.
- #9 Webapp /accounts vs /transactions "uncategorized" count drift — webapp-internal, same definition problem as the resolved Resumen findings.

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
