# Zeta Backlog

> Persistent backlog shared across sessions. Update this file whenever a task is discovered but not tackled in the current session. Remove items when they ship (merged to main).

## How to use

- **Before starting work**: scan this file for items that overlap with your task — fix them together.
- **After finishing work**: if review agents or testing surfaced new issues you didn't fix, add them here.
- **After merging a PR**: remove the items it resolved.

---

## Features

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
