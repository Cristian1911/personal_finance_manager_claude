# Zeta Backlog

> Persistent backlog shared across sessions. Update this file whenever a task is discovered but not tackled in the current session. Remove items when they ship (merged to main).

## How to use

- **Before starting work**: scan this file for items that overlap with your task — fix them together.
- **After finishing work**: if review agents or testing surfaced new issues you didn't fix, add them here.
- **After merging a PR**: remove the items it resolved.

---

## In Review

| PR | Description | Branch |
|---|---|---|
| — | Recurring impact preview + recurring income + account detail redesign | `feat/recurring-impact-income` |

## Features

### Account detail page — deferred items
- **Priority:** Medium
- **What:** Statement snapshots visual redesign, auto-populate `card_brand` from PDF parsers, composite `(account_id, user_id, transaction_date)` index, use `useAccounts()` hook instead of server-side `getAccounts()` in QuickActionsBar
- **Context:** Shipped card hero, flip-to-graph, transaction-based balance history, transfer dialog, quick actions. Deferred items noted by perf-auditor and design reviews.

### Income occurrence UX — different actions from expenses
- **Priority:** Done (this branch)
- **What:** Direction-aware labels: "Confirmar ingreso" / "Ya recibí" for INFLOW, "Confirmar pago" / "Ya pagué" for OUTFLOW. Covers confirm inline, timeline, toasts, and attention fallback labels.
- **Remaining:** Skip/delete option for clearing occurrences without marking received — deferred.

### Undo completed occurrences
- **Priority:** Done (this branch)
- **What:** Revert paid/skipped occurrences back to pending. For paid: deletes transactions via `recurrence_group_id`, reverses balance deltas. For skipped: resets status. "Deshacer" button on each completed item.

### Template active state — query-side filtering
- **Priority:** Done (implemented in this branch)
- **What:** Paused template occurrences are filtered at query time via `is_active` check in `getPendingOccurrencesCached` and `getNextIncomeOccurrenceCached`. No destructive status changes — occurrences stay `pending`, just invisible when template is paused. Reactivating brings them back automatically.
- **Found:** Visual testing, 2026-04-13

### Mobile recurring admin actions
- **Priority:** Done (this branch)
- **What:** MoreVertical (⋮) button on each occurrence row opens bottom Sheet with Edit, Pause/Activate, Delete. Reuses RecurringFormDialog and RecurringImpactDialog from desktop.
- **Remaining:** Edit dialog opens behind the action sheet (nested Radix portal). Needs to close Sheet first, then open Dialog sequentially. Full recurring form also needs mobile redesign.

### Manual transaction-to-recurring matching
- **Priority:** Done (this branch)
- **What:** Manual link from both sides: occurrence → transaction picker, transaction → occurrence picker. Smart undo via `linked_manually` flag. Bottom drawer with ranked match scoring.
- **Spec:** `docs/superpowers/specs/2026-04-14-manual-tx-recurring-linking.md`

### Recurring stats — historical backfill
- **Priority:** Medium
- **What:** Template stats (YTD, streak, annual estimate) are empty for newly created templates. Options: (1) backfill from `statement_snapshots` minimum payments or balance changes, (2) when creating a recurring template, auto-create historical occurrences as "paid" based on matching past transactions, (3) use snapshot history alongside occurrence history for the metrics.
- **Context:** `getTemplateStats()` in `actions/template-stats.ts` only queries `recurring_occurrences`. New templates have no occurrences yet even if the user has been paying for months.
- **Found:** User feedback, 2026-04-14

### Email import — stale transaction lists after import
- **Priority:** Medium
- **What:** Importing pending email transactions removes them from queue but transaction lists (movimientos + dashboard) don't update. Desktop "Pendientes por correo" card also stays stale. Need page refresh.
- **Context:** Revalidation from email import action may not cover all transaction list cache tags.
- **Found:** User testing, 2026-04-14

### "Vincular a recurrente" in movimientos expanded view
- **Priority:** Medium
- **What:** The "Vincular a recurrente" action was added to inicio-activity (dashboard) but not to the movimientos (transactions) mobile expanded view. Need to add it there too.
- **Found:** User testing, 2026-04-14

### Merge recurrentes pages into one
- **Priority:** Medium
- **What:** Two separate recurrentes views (plan tab + standalone page) is confusing. They offer different things. Unify into a single page with all features (checklist + admin actions + templates).
- **Found:** User feedback, 2026-04-14

### Plan page mobile — grid navigation instead of list
- **Priority:** Medium
- **What:** The "Ir a" section on the plan page mobile view shows Presupuesto, Periodo, Recurrentes, Deseos as a vertical list of link cards. Replace with a 2x2 grid of buttons for better visual density and scannability.
- **Found:** User feedback, 2026-04-14

### Recurring checklist — unify inline expand + action drawer
- **Priority:** Medium
- **What:** The plan tab checklist has two disconnected interaction patterns: (1) tap row → inline payment form with flat buttons, (2) tap ⋮ → bottom Sheet with chip-style admin actions. They look like different apps. Unify into a single cohesive pattern — either improve inline to match chip style with small confirmation Sheet, or merge both into one bottom drawer per-item.
- **Found:** Visual testing, 2026-04-14

### Debt payment category — distinguish CREDIT_CARD vs LOAN
- **Priority:** Medium
- **What:** All debt payments auto-assign `CATEGORY_OBLIGACIONES` (parent). Should distinguish: CREDIT_CARD → "Pago tarjeta" subcategory, LOAN → "Cuota crédito" subcategory. Three changes needed: (1) add seed subcategories for "Pago tarjeta" and "Cuota crédito" under Obligaciones if they don't exist, (2) allow category picker in RecurringForm for debt accounts (pre-select correct subcategory based on `account_type`), (3) update `recordRecurringOccurrencePayment` to use template's `category_id` instead of hardcoded `DEBT_PAYMENT_CATEGORY_ID`.
- **Context:** Currently `category_id` is forced to `null` on template create (lines 277/351 in recurring-templates.ts), and payment recording hardcodes `DEBT_PAYMENT_CATEGORY_ID` (line 650). User already has manual subcategories mapped correctly.
- **Found:** User feedback, 2026-04-14

### Audit effectiveDirection usage across app
- **Priority:** Low
- **What:** The recurring manager introduced `effectiveDirection()` (INFLOW to debt account = expense, not income). Audit the whole app for places that classify by raw `template.direction` without checking account type — dashboards, budget calculations, income metrics, etc.
- **Found:** Bug fix during recurring manager development, 2026-04-14


### Income-aware runway & daily budget
- **Priority:** Done (shipped in PR #134)
- **What:** Dashboard hero and runway use pay-cycle budgeting (now → next income date). Obligations scoped to window. Burn-rate chart shows single segment with obligation markers.
- **Context:** Spec: `docs/superpowers/specs/2026-04-13-income-aware-runway.md`

### Multi-currency aggregation in dashboard metrics
- **Priority:** Done (this branch)
- **What:** Dashboard hero, burn rate, runway, and net worth now aggregate all currencies by converting to base via `getRatesForCurrencies()`. Accounts/obligations with unavailable rates are excluded (not mixed raw). UI shows "tasa del día" hint when conversions are included.
- **Known limitation:** Net worth history steps backward using single-currency cashflow, so the foreign portion floats as a constant — acceptable approximation for now.

### Tag system broader reach
- **Priority:** Partial (this branch)
- **What:** Auto-tag from destinatario during import — transactions inherit their matched destinatario's tags. Reconciliation merges also preserve existing tags. Batched for performance.
- **Remaining:** Tags on recurring templates (needs `recurring_template_tags` migration + form changes + occurrence-to-tx tag copy). Nómina tag variants.

### Categorization view enhancements
- **Priority:** Medium
- **What:** Show similar transactions when categorizing, more action options in the categorization inbox
- **Context:** Currently only shows category suggestion + accept/change. Could show "5 more like this" to encourage bulk categorization.

### Smart insights
- **Priority:** Low (large scope)
- **What:** Cross-month account movement tracking, debt payment impact analysis
- **Context:** Dashboard answers "Am I on track?" but doesn't yet show trends or explain why things changed.

### Desktop transaction table expansion
- **Priority:** Medium
- **What:** Same action chip pattern (destinatario, tag, edit) for desktop table rows. Migrate desktop consumers from old pickers (`destinatario-picker.tsx`, `tag-picker.tsx`) to zone pickers, then delete old files.
- **Context:** PR #130 only covers mobile. Desktop table still uses inline category popover only.
- **Blocked by:** PR #130 merge

### Mobile app — Apple compliance (pre-submission)
- **Priority:** High (blocks App Store submission)
- **What:** Privacy Policy (ES + EN, hosted on webapp domain), Terms of Service, update `PrivacyInfo.xcprivacy` with accurate data types (app collects financial data, user IDs — currently declares empty), add `NSPhotoLibraryUsageDescription` + `NSCameraUsageDescription` to `app.json`, add in-app financial disclaimer ("Zeta no es un asesor financiero"), remove `NSAllowsLocalNetworking` from production builds.
- **Context:** 2 new guardrail agents (`mobile-sync-doctor`, `mobile-webapp-parity`) are in place. Compliance is the remaining blocker before TestFlight/App Store submission.
- **Found:** Mobile pages session, 2026-04-14

### Mobile v2 redesign — Phase 3
- **Priority:** Low (deferred)
- **What:** Full root redesign with zone-based layouts, custom heroes, Zeta-branded visualizations
- **Memory:** `project_mobile_v2_redesign.md`

## Tech Debt

### Defense-in-depth gaps
- **Priority:** Done (this branch)
- **What:** Added `.eq("user_id")` to `getCategoriesByRhythm` transactions query. Added ownership verification to `bulkTagTransactions`.

### Missing revalidation
- **Priority:** Done (this branch)
- **What:** `createDestinatario` with `link_matching_transactions` now calls `revalidateFinancialViews()`.

### Uncached server action
- **Priority:** Done (this branch)
- **What:** `getTagsForEntity` extracted to `"use cache"` inner with `cacheTag("tags")` + `cacheLife("zeta")`.

### `useRecurringMonth` callbacks use `router.refresh()` instead of `startTransition`
- **Priority:** Medium
- **What:** All three callbacks in `use-recurring-month.ts` (`confirmPayment`, `skipPayment`, `linkExisting`) call `router.refresh()` after the server action. Should wrap in `startTransition` instead — `router.refresh()` is a redundant network round-trip.
- **Found:** cache-doctor review, 2026-04-14

### `inicio-activity.tsx` non-token colors
- **Priority:** Low
- **What:** `bg-green-500/12` and `bg-orange-500/12` should be `bg-z-income/12` and `bg-z-expense/12`. Also eyebrow uses `text-[9px] font-bold` instead of `SECTION_EYEBROW_CLASS`.
- **Found:** zetas-front-guy review, 2026-04-14

### `recurring-confirm-inline.tsx` surface token
- **Priority:** Low
- **What:** Uses `bg-muted/50` (shadcn token) instead of Zeta surface tier token (`bg-z-surface-3/60` or `bg-black/20`).
- **Found:** zetas-front-guy review, 2026-04-14

### `transaction_tags` table missing columns
- **What:** No `created_at` or `user_id` columns. Recents query works around this by joining through `transactions`. Adding these columns would:
  - Enable proper recency ordering (currently orders by transaction_date as proxy)
  - Improve RLS performance (current policy uses EXISTS subquery per row)
  - Allow direct defense-in-depth filtering
- **Migration needed:** `ALTER TABLE` + backfill + index + RLS policy update. Spawn `supabase-migrator`.
- **Found:** Server action reviewer + perf auditor, 2026-04-13

### Shared PickerShell component
- **What:** Popover/dialog/drawer branching is duplicated across 3 zone pickers (~40 lines each, ~120 total). A shared `PickerShell` accepting `{ open, onOpenChange, trigger, title, icon, body, variant }` would eliminate the duplication.
- **When:** Extract when a 4th picker is added or when touching all 3 pickers.
- **Found:** Code reuse review, 2026-04-13

### `categories.ts` cached functions use `createAdminClient()`
- **What:** 5 cached functions use `createAdminClient()` instead of `createCachedClient(accessToken)`. Categories table is not encrypted so it works, but deviates from established pattern and bypasses RLS entirely.
- **Found:** Server action reviewer, 2026-04-13

## Open PRs (stale)

| PR | Description | Status |
|---|---|---|
| #98 | Demo mode with mock accounts | Open since 2026-04-08 |
| #84 | Design review system in production | Open since 2026-04-06 |
