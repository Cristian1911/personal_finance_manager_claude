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
| #130 | Inline drawer pickers + picker improvements | `feat/inline-drawer-pickers` |
| — | Recurring impact preview + recurring income + account detail redesign | `feat/recurring-impact-income` |

## Features

### Account detail page — deferred items
- **Priority:** Medium
- **What:** Statement snapshots visual redesign, auto-populate `card_brand` from PDF parsers, composite `(account_id, user_id, transaction_date)` index, use `useAccounts()` hook instead of server-side `getAccounts()` in QuickActionsBar
- **Context:** Shipped card hero, flip-to-graph, transaction-based balance history, transfer dialog, quick actions. Deferred items noted by perf-auditor and design reviews.

### Income occurrence UX — different actions from expenses
- **Priority:** Medium
- **What:** Income occurrences show "Confirmar pago" / "Ya pagué" — should say "Confirmar ingreso" / "Ya recibí". Actions, labels, and possibly the color accent should be contextual based on `direction` (INFLOW vs OUTFLOW). Also needs a "skip" or "delete" option for occurrences the user wants to clear without marking as received.
- **Found:** Visual testing, 2026-04-13

### Template active state ↔ occurrence status invariant
- **Priority:** High
- **What:** A pending occurrence for a paused template is invalid state. Currently enforced only in the `toggleRecurringTemplate` action (skips future occurrences on pause). Should also have a DB trigger on `recurring_transaction_templates` that auto-skips pending occurrences when `is_active` flips to `false` — prevents desync from race conditions, manual DB edits, or new code paths that bypass the action. Spawn `supabase-migrator`.
- **Found:** Visual testing, 2026-04-13

### Mobile recurring admin actions
- **Priority:** Medium
- **What:** Add pause/delete/edit actions for recurring templates on mobile. Currently mobile view (`MobileRecurrentesView`) only supports pay/skip — no way to manage templates without switching to desktop.
- **Options:** Long-press action sheet on each item, or a "manage" link navigating to a detail view with admin actions.
- **Found:** Visual testing, 2026-04-13


### Income-aware runway & daily budget
- **Priority:** High
- **What:** Dashboard "gasto diario" and runway metrics should factor in upcoming recurring income. Two options: (A) count until end of month but add next income to available balance, or (B) count until next income date instead of end of month. Currently both metrics assume no more money coming in — overly pessimistic when income is configured.
- **Context:** Recurring income is now first-class. These metrics should reflect it. Affects mobile dashboard hero and gasto diario calculation.
- **Found:** Visual testing, 2026-04-13

### Tag system broader reach
- **Priority:** Medium
- **What:** Tags during destinatario rule imports, nómina variants
- **Context:** Tags exist but are only usable from transaction detail and categorization inbox. Should be available during import flow and when creating recurring templates.

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

### Mobile v2 redesign — Phase 3
- **Priority:** Low (deferred)
- **What:** Full root redesign with zone-based layouts, custom heroes, Zeta-branded visualizations
- **Memory:** `project_mobile_v2_redesign.md`

## Tech Debt

### Defense-in-depth gaps
- **`getCategoriesByRhythm`** (`categories.ts`) — transactions query missing `.eq("user_id", user.id)`. Relies solely on RLS.
- **`bulkTagTransactions`** (`tags.ts`) — upserts into `transaction_tags` without verifying transaction ownership. RLS covers it but violates defense-in-depth convention.
- **Found:** Server action reviewer, 2026-04-13

### Missing revalidation
- **`createDestinatario` with `link_matching_transactions`** (`destinatarios.ts`) — manually lists 5 tags instead of calling `revalidateFinancialViews()`. Misses `"transactions"`, `"accounts"`, `"debt"`, `"recurring"`, `"occurrences"`.
- **Found:** Server action reviewer, 2026-04-13

### Uncached server action
- **`getTagsForEntity`** (`tags.ts`) — called on every tag picker open with no `"use cache"`. Uses React `cache()` which only deduplicates within a single server render, not across client-side calls. 3 sequential DB queries each time.
- **Found:** Efficiency review, 2026-04-13

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
