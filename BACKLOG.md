# Zeta Backlog

> Persistent backlog shared across sessions. Update this file whenever a task is discovered but not tackled in the current session. Remove items when they ship (merged to main).

## How to use

- **Before starting work**: scan this file for items that overlap with your task — fix them together.
- **After finishing work**: if review agents or testing surfaced new issues you didn't fix, add them here.
- **After merging a PR**: remove the items it resolved.

---

## Bugs

### Dashboard "Ritmo" chip shows dead-end empty state when expanded
- **Priority:** Medium
- **What:** `inicio-metrics-grid.tsx` — when `burnRateData` is null (no CHECKING/SAVINGS accounts OR no OUTFLOW tx in base currency in the last 3 months), expanding the Ritmo chip shows only "Sin datos de ritmo suficientes". The ring itself always renders (it uses calendar % `dayOfMonth/daysInMonth`, independent of financial data), which makes the empty state feel like a bug. Replace with an actionable message ("Importa transacciones recientes para ver tu ritmo" + link to /transactions/new) and investigate why `getBurnRate()` returns null for this user (likely currency mismatch between base currency and the existing tx currency, or genuinely no outflows in the 3-month window).
- **Touches:** `webapp/src/components/mobile/v2/inicio/inicio-metrics-grid.tsx:165-169`; possibly `webapp/src/actions/burn-rate.ts` if the null-return logic should be more forgiving.
- **Found:** User feedback, 2026-04-17

### Account detail — "Ajustar" button does nothing when clicked
- **Priority:** High
- **What:** On `/accounts/[id]`, the "Ajustar" button is unresponsive — no dialog, no navigation, no toast. Likely a broken handler or a conditional render gating the dialog's open state. Needs repro + trace of the click event.
- **Touches:** Almost certainly `webapp/src/app/(dashboard)/accounts/[id]/page.tsx` or a child action component (QuickActionsBar / account hero).
- **Found:** User feedback, 2026-04-17

### Promote-to-recurring — success state undersells the outcome
- **Priority:** Medium
- **What:** After promoting a tx, the CTA collapses to a muted grey "Ya es recurrente" badge. User just created a template + linked this tx as paid — but has no signal that a future payment is now scheduled or where to find it. Options: (a) toast on success with the next occurrence date ("Recurrente creada · Próxima: 15 mayo"), (b) badge gains a subtle link to `/plan?tab=recurrentes&template=<id>`, (c) on submit redirect to `/plan?tab=recurrentes&highlight=<template_id>` with a flash highlight.
- **Found:** ux-analyst review, 2026-04-17

### Tx detail hero — Promote vs Edit visual weight inversion
- **Priority:** Low
- **What:** Edit uses the default brass `<Button>`, Promote uses `variant="ghost"`. Promotion is a more consequential action than editing one field. Either swap weights or make both ghost and let Delete remain the icon action.
- **Touches:** `webapp/src/components/transactions/transaction-form-dialog.tsx`, `webapp/src/components/transactions/promote-to-recurring-button.tsx`.
- **Found:** ux-analyst review, 2026-04-17

### Inline Promote dialog inside Vincular drawer
- **Priority:** Low
- **What:** Today "Crear nueva recurrente" navigates to `/transactions/[id]?promote=1` instead of opening the dialog inline in the drawer. Code cost is small (`RecurringFormDialog` already accepts `controlledOpen`). Would remove the full-page detour. Drawback: dialog-in-drawer is visually awkward on mobile and the detail page detour gives the user a landing destination.
- **Found:** ux-analyst review, 2026-04-17

### Recurrentes tab shows empty state despite 9 active templates
- **Priority:** High (prod)
- **What:** `/plan?tab=recurrentes` renders the hero `$0 · 0 pendientes · 0 completados` and the empty state "No hay pagos recurrentes este mes" even though "9 activas · 1 pausada" is shown in the MIS PLANTILLAS strip. Reproduced on production (main, not this branch). Hypotheses to check in order: (1) `ensureCurrentOccurrences()` is failing silently on page load, so `recurring_occurrences` has no rows for this month; (2) all active templates have a `start_date` in the future or `end_date` in the past that excludes them from the current-month generator; (3) post-merge migration 20260416120000 deleted loser templates but left orphan occurrence rows whose `template_id` now FKs into a deleted row, tripping the view join; (4) a timezone boundary bug where the month cursor and the DB's `occurrence_date` range differ.
- **Repro:** Open `/plan?tab=recurrentes` on an account with known active templates. Confirm the ring counts are 0 while the strip claims 9+1 templates.
- **Debug path:** SQL `SELECT count(*), status FROM recurring_occurrences WHERE user_id = <uid> AND occurrence_date BETWEEN '2026-04-01' AND '2026-04-30' GROUP BY status;`. If 0 rows, call `ensureCurrentOccurrences()` manually or inspect the function's logs. If rows exist, the client filter or date range is off.
- **Touches:** `webapp/src/actions/occurrences.ts`, `webapp/src/components/recurring/use-recurring-month.ts`, `webapp/src/app/(dashboard)/plan/page.tsx`.
- **Found:** User feedback, 2026-04-17

## Features

### Promote transaction → recurring template ("Hacer recurrente" CTA)
- **Priority:** High
- **What:** Add a "Hacer recurrente" action on `/transactions/[id]` (and ideally the 3-dot menu on list rows) that opens the existing `RecurringFormDialog` pre-filled with the transaction's merchant, amount, account, category, destinatario, and a monthly-frequency default. On confirm, create a `recurring_templates` row with `start_date` = the transaction's date so the occurrence engine generates this month + future pendings; the source transaction auto-links to the current occurrence via `findMatchingOccurrence()`.
- **Why:** When a bill (home services, rent, subscription) first shows up from email import, there's no way to promote it to a recurring template without rebuilding it from scratch at `/recurrentes/new`. User shouldn't retype data the app already has.
- **Touches:** `transactions/[id]/page.tsx`, reuse `RecurringFormDialog`, possibly a new `createRecurringTemplateFromTransaction` helper that wires the link.
- **Found:** User request during Phase 1 PR session, 2026-04-16

### `is_subscription` toggle is a dead flag — connect or remove
- **Priority:** High (ship with "Hacer recurrente")
- **What:** The "Marcar como suscripción" switch in `mobile-transaction-form.tsx`, `transaction-form.tsx`, and `voice-capture-sheet.tsx` writes `is_subscription: boolean` to the transactions row, but **nothing reads that field meaningfully**. Zero filters, zero UI treatment, zero linkage to `recurring_templates`. Email ingest also always writes `is_subscription: false`. The actually meaningful flag for "this is a recurring expense" is `is_recurring`, which is only set by the recurring-template occurrence system (read by `burn-rate.ts` to split discretionary vs recurring spending).
- **Options:**
  - **A. Wire up (recommended):** When the toggle is on, also create a `recurring_templates` row with inferred defaults (monthly frequency, same account, same amount, merchant=description) and link the tx to the first generated occurrence. Same helper as the "Hacer recurrente" CTA above — the form becomes another entry point.
  - **B. Remove:** Delete the toggle from all 3 forms and the `is_subscription` param from the `createTransaction` action path. Drop the column in a follow-up migration (nullable deprecation first, then drop).
- **Why it matters:** Users see the toggle, expect it to do something, and get no signal that it's inert. Feature disappointment.
- **Touches:** 3 form components, `transactions.ts` action, possibly a DB migration if we pick B.
- **Found:** Phase 1 PR session investigation, 2026-04-16

### Link Destinatario ↔ Recurring Template
- **Priority:** High (pairs well with "Hacer recurrente" CTA)
- **What:** Let a `recurring_templates` row reference a `destinatario_id`. When a new transaction enters the system (manual, PDF import, email) and the destinatario matcher assigns it to a destinatario that's linked to an active recurring template, the system prompts the user to link this transaction to the current pending occurrence of that template — closing the "I just paid my home services, mark it paid" loop automatically. Also: if the transaction's amount matches the expected plannedAmount, auto-link without prompting (configurable).
- **Why:** Today the occurrence auto-link relies on `findMatchingOccurrence()` heuristics (account + direction + amount + date proximity). Anchoring via a destinatario link is stronger and faster — user confirmed once, system links forever. Also powers the "Hacer recurrente" CTA naturally: promoting a tx to a template auto-creates the destinatario link.
- **Touches:** Migration to add `destinatario_id` column to `recurring_templates`; matcher + `findMatchingOccurrence()` updates; confirmation UI on new transactions; `RecurringFormDialog` needs a destinatario field.
- **Found:** Dashboard polish brainstorming, 2026-04-16

### Account aliases + mini icons across the app
- **Priority:** High (unblocks Dashboard polish density gains)
- **What:** Current account labels are too long for dense list rows (`Bancolombia Ahorros ****4398` wraps in RECIENTE, `/transactions` list, account pickers). Add an optional `alias` string on the accounts table; display format becomes `<alias> · ****<mask>` with a tiny colored icon. When no alias is set, fall back to the current full name. Pair with the existing "personalized account card" backlog — same color/icon source of truth. Affects: RECIENTE (Dashboard), `/transactions` list rows, `/accounts` list, account pickers in forms, transaction detail "Cuenta" field, `/deudas` account rows.
- **Why:** Dashboard RECIENTE and similar dense rows lose their visual rhythm because account names overflow. Short aliases reclaim horizontal space and reinforce bank identity via a 16×16 icon rather than a 28-character string.
- **Migration:** Add `alias` column (encrypted table — spawn supabase-migrator for the 6-step process).
- **Found:** Dashboard polish brainstorming, 2026-04-16

### Dashboard RECIENTE — inline category assignment on row expand
- **Priority:** High (scoped for Phase 2 Dashboard polish)
- **What:** Replace the current inline yellow "Sin cat." tag with a tap-to-expand row interaction: tapping a transaction row reveals an inline panel with a category picker (and possibly: destinatario picker, mark-as-recurring, notes field). User resolves the categorization without leaving the Dashboard. Removes visual clutter from the row and turns a passive signal into a one-tap action.
- **Context:** User de-prioritized "Sin cat." as a Dashboard-level reminder (the `/transactions` page already has a prominent CTA). But we still want users to be able to categorize from the Dashboard's RECIENTE list if they notice something.
- **Component:** Update `inicio-activity.tsx`. Likely reuses the zone-picker pattern already in `/transactions` and `/destinatarios`.
- **Found:** Dashboard polish brainstorming, 2026-04-16

### Account detail page — deferred items
- **Priority:** Medium
- **What:** Statement snapshots visual redesign, auto-populate `card_brand` from PDF parsers, composite `(account_id, user_id, transaction_date)` index, use `useAccounts()` hook instead of server-side `getAccounts()` in QuickActionsBar
- **Context:** Shipped card hero, flip-to-graph, transaction-based balance history, transfer dialog, quick actions. Deferred items noted by perf-auditor and design reviews.

### Recurring stats — historical backfill
- **Priority:** Medium
- **What:** Template stats (YTD, streak, annual estimate) are empty for newly created templates. Options: (1) backfill from `statement_snapshots` minimum payments or balance changes, (2) when creating a recurring template, auto-create historical occurrences as "paid" based on matching past transactions, (3) use snapshot history alongside occurrence history for the metrics.
- **Context:** `getTemplateStats()` in `actions/template-stats.ts` only queries `recurring_occurrences`. New templates have no occurrences yet even if the user has been paying for months.
- **Found:** User feedback, 2026-04-14

### Recurring checklist — unify inline expand + action drawer
- **Priority:** Medium
- **What:** The plan tab checklist has two disconnected interaction patterns: (1) tap row → inline payment form with flat buttons, (2) tap ⋮ → bottom Sheet with chip-style admin actions. They look like different apps. Unify into a single cohesive pattern — either improve inline to match chip style with small confirmation Sheet, or merge both into one bottom drawer per-item.
- **Found:** Visual testing, 2026-04-14

### Audit effectiveDirection usage across app
- **Priority:** Done (this branch)
- **What:** Audited all `direction === "INFLOW"` usages. Fixed 3 bugs where raw template direction was used without debt account check: `plan-flow-timeline.tsx` (icon/color), `attention-items.ts` (fallback label), `recurring-template-card.tsx` (grid layout + pause button visibility). Transaction-level displays are correct (actual money flow per account).

### Accounts — `deactivated_at` timestamp
- **Priority:** Medium
- **What:** Add `deactivated_at` column to accounts table. When a user deactivates an account, store the date. Use in historical debt views to show "Cerrada en abril 2026" label on account cards. Currently only `is_active` boolean — no record of when.
- **Migration:** 6-step encrypted table process (accounts is a view over `accounts_enc`). Spawn `supabase-migrator`.
- **Found:** Debt page month selector work, 2026-04-15

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

### Tag system broader reach — remaining items
- **Priority:** Medium
- **What:** Tags on recurring templates (needs `recurring_template_tags` migration + form changes + occurrence-to-tx tag copy). Nómina tag variants.
- **Context:** Auto-tag from destinatario during import shipped in PR #138. This is the remaining work.

### Mobile app — Apple compliance (pre-submission)
- **Priority:** High (blocks App Store submission)
- **What:** Privacy Policy (ES + EN, hosted on webapp domain), Terms of Service, update `PrivacyInfo.xcprivacy` with accurate data types (app collects financial data, user IDs — currently declares empty), add `NSPhotoLibraryUsageDescription` + `NSCameraUsageDescription` to `app.json`, add in-app financial disclaimer ("Zeta no es un asesor financiero"), remove `NSAllowsLocalNetworking` from production builds.
- **Context:** 2 new guardrail agents (`mobile-sync-doctor`, `mobile-webapp-parity`) are in place. Compliance is the remaining blocker before TestFlight/App Store submission.
- **Found:** Mobile pages session, 2026-04-14

### Mobile v2 redesign — Phase 3
- **Priority:** Low (deferred)
- **What:** Full root redesign with zone-based layouts, custom heroes, Zeta-branded visualizations
- **Memory:** `project_mobile_v2_redesign.md`

### Mobile charts — MVP set
- **Priority:** Medium
- **What:** Build mobile equivalents for the 6 most important webapp charts: monthly cashflow (bar), category donut (pie), daily spending (area), burn rate + runway, budget pace (ideal vs actual), account sparklines. `@shopify/react-native-skia` is already installed but unused.
- **Data sources:** `getMonthlyCashflow()`, `getCategorySpending()`, `getDailySpending()`, `getBurnRate()`, `getDailyBudgetPace()`, `getAccountsWithSparklineData()` — all in `webapp/src/actions/charts.ts`.
- **Found:** Mobile audit, 2026-04-15

### Mobile missing pages
- **Priority:** Low
- **What:** Etiquetas (Tags), Pendientes (Pending Transactions), Settings Analytics — all exist in webapp but have no mobile equivalent.
- **Found:** Mobile audit, 2026-04-15

### Mobile sync — secondary tables
- **Priority:** Low
- **What:** `debt_scenarios`, `wishlist_reflections`, `dashboard_config` tables are used by the webapp but not synced to mobile. Add to SYNC_TABLES when mobile features need them.
- **Found:** Mobile audit, 2026-04-15

## Tech Debt

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
