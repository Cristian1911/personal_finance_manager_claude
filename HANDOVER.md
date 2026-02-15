# HANDOVER.md

## 1. Session Summary

This session executed the 4-feature implementation plan from the previous planning session. All features were fully implemented: 17 flat seed categories with RLS fix, transaction exclusion (`is_excluded`) with UI toggle and chart filtering, keyword-based auto-categorization on PDF import, and a complete debt dashboard at `/deudas`. Three Supabase migrations were pushed, TypeScript types regenerated, and the build passes cleanly.

## 2. Changes Made

### Feature 1: Seed Categories + RLS Fix

- **Created** `supabase/migrations/20260214100001_seed_categories.sql` — 17 flat system categories (12 OUTFLOW + 5 INFLOW) with deterministic UUIDs `a0000001-0001-4000-8000-00000000XXXX`
- **Created** `supabase/migrations/20260214100002_fix_category_rls.sql` — SELECT policy: `user_id = auth.uid() OR user_id IS NULL`. INSERT/UPDATE/DELETE policies enforce `is_system = false`.
- **Modified** `webapp/src/types/database.ts` — Regenerated from Supabase (includes `is_excluded` from Feature 2)

### Feature 2: Transaction Exclusion (`is_excluded`)

- **Created** `supabase/migrations/20260214100003_add_transaction_is_excluded.sql` — `is_excluded boolean NOT NULL DEFAULT false` + partial index
- **Modified** `webapp/src/lib/validators/transaction.ts` — Added `amountMin`, `amountMax`, `showExcluded` to `transactionFiltersSchema`
- **Modified** `webapp/src/actions/transactions.ts` — Filter logic for new fields, `toggleExcludeTransaction()`, `bulkExcludeTransactions()`. Fixed fallback params type.
- **Modified** `webapp/src/components/transactions/transaction-filters.tsx` — Amount range inputs + "Mostrar excluidas" Switch toggle
- **Modified** `webapp/src/components/transactions/transaction-table.tsx` — Refactored to `TransactionRow` with `useTransition`. Eye/EyeOff toggle, opacity, "Excluida" badge, strikethrough.
- **Modified** `webapp/src/app/(dashboard)/dashboard/page.tsx` — `.eq("is_excluded", false)` on `recentTransactions` and `monthTransactions` queries. Added debt summary card (Feature 4).
- **Modified** `webapp/src/actions/charts.ts` — `.eq("is_excluded", false)` on all 5 chart functions
- **Added** `webapp/src/components/ui/switch.tsx` — shadcn Switch component
- **Added** `webapp/src/components/ui/tooltip.tsx` — shadcn Tooltip component

### Feature 3: Auto-Categorization on Import

- **Created** `webapp/src/lib/utils/auto-categorize.ts` — ~100 Bancolombia-specific keywords mapped to seed category UUIDs. Exports `autoCategorize(description)`.
- **Modified** `webapp/src/types/import.ts` — Added `category_id`, `categorization_source`, `categorization_confidence` to `TransactionToImport`
- **Modified** `webapp/src/lib/validators/import.ts` — Same 3 optional fields on `transactionToImportSchema`
- **Modified** `webapp/src/actions/import-transactions.ts` — Uses category fields from payload instead of hardcoded `SYSTEM_DEFAULT`
- **Modified** `webapp/src/components/import/step-confirm.tsx` — Runs `autoCategorize()` on mount, manages `categoryOverrides` state, shows info banner with count
- **Modified** `webapp/src/components/import/parsed-transaction-table.tsx` — Optional "Categoría" column with Select dropdown filtered by direction
- **Modified** `webapp/src/components/import/import-wizard.tsx` — Accepts and passes `categories` prop
- **Modified** `webapp/src/app/(dashboard)/import/page.tsx` — Fetches categories in parallel, flattens tree, passes to wizard

### Feature 4: Debt Dashboard

- **Created** `webapp/src/lib/utils/debt.ts` — `extractDebtAccounts`, `calcUtilization`, `estimateMonthlyInterest`, `toAlmuerzos`, `toHorasMinimo`, `daysUntilPayment`, `generateInsights` (5 rules)
- **Created** `webapp/src/actions/debt.ts` — `getDebtOverview()` server action
- **Created** `webapp/src/components/debt/debt-hero-card.tsx` — Total debt display with Landmark icon
- **Created** `webapp/src/components/debt/utilization-gauge.tsx` — Semicircular Recharts gauge with used/total/available breakdown
- **Created** `webapp/src/components/debt/interest-cost-card.tsx` — Monthly interest estimate with relatable equivalents (almuerzos, minimum wage hours)
- **Created** `webapp/src/components/debt/debt-account-card.tsx` — Per-account detail: utilization bar, rate, interest, payment countdown
- **Created** `webapp/src/components/debt/debt-insights.tsx` — Insight cards with warning/info/success styling
- **Created** `webapp/src/app/(dashboard)/deudas/page.tsx` — Server component with empty state, overview cards, insights, per-account grids
- **Modified** `webapp/src/lib/constants/navigation.ts` — Added `Landmark` import and "Deudas" nav item

## 3. Key Decisions

- **Flat categories (no hierarchy)** — User chose to flatten. All 17 have `parent_id=NULL`. Users create sub-categories themselves.
- **`is_excluded` boolean over soft-delete** — Simpler than status-based. Excluded transactions remain queryable but filtered from all metrics.
- **Keyword-based auto-categorization, not ML** — Simple `string.includes()` on ~100 keywords. Confidence fixed at 0.7. ML deferred.
- **Category overrides in client state** — `categoryOverrides` Map in `StepConfirm` tracks auto vs user-assigned to set correct `categorization_source`.
- **Amber for debt warnings, not red** — Per prior UX research, red triggers avoidance ("ostrich effect").
- **Relatable equivalents** — Almuerzos (~$20K COP) and minimum wage hours (~$7.2K COP) make interest costs tangible.
- **Separate `/deudas` route** — Own page, not embedded in dashboard. Summary card on dashboard links to it.
- **Debt simulator deferred** — Snowball vs Avalanche simulator deferred to follow-up sprint.

## 4. Current State

- **Build**: `cd webapp && pnpm build` passes with 0 errors
- **No git repo**: Project is not under version control
- **Supabase migrations**: 4 total, all pushed and applied:
  - `20260214034921_add_account_specialized_fields.sql` (pre-existing)
  - `20260214100001_seed_categories.sql`
  - `20260214100002_fix_category_rls.sql`
  - `20260214100003_add_transaction_is_excluded.sql`
- **Types current**: `database.ts` includes `is_excluded`

## 5. Open Issues & Gotchas

- **`supabase gen types` piping**: Using `tail -n +2` strips the first *content* line (`export type Json =`), not just the `compdef` warning. This session had to manually repair the file. Use `sed '1d'` instead, or verify the header after piping.
- **RLS policy duplication risk**: Previous session's RLS policies were set via Supabase dashboard. This session's migration uses `DROP POLICY IF EXISTS` for common names, but the dashboard-created policies may have different names. Verify via Supabase dashboard that no duplicate/conflicting policies exist on the `categories` table.
- **`bulkExcludeTransactions` not wired to UI**: The server action exists in `webapp/src/actions/transactions.ts` but no UI invokes it. Needs checkboxes + bulk action bar on the transactions list page.
- **Auto-categorize keywords are static**: Hardcoded in `webapp/src/lib/utils/auto-categorize.ts`. No admin UI. Only covers Bancolombia descriptions.
- **Debt insights use hardcoded COP values**: `toAlmuerzos()` assumes ~$20K COP/lunch, `toHorasMinimo()` assumes ~$7.2K COP/hr. Update if minimum wage changes or multi-currency debt is supported.
- **No tests**: No test infrastructure. All verification is manual + build check.

## 6. Suggested Next Steps

1. **Initialize git** — Set up `.gitignore` and make an initial commit.
2. **Visual verification** — Run `pnpm dev` and verify all 4 features:
   - `/categories` — 17 seed categories visible, non-editable
   - `/transactions` — Eye toggle dims/excludes, amount range filter works, "Mostrar excluidas" toggle works
   - `/import` — Upload a Bancolombia PDF, confirm "Categoría" column with auto-assigned categories
   - `/deudas` — With a credit card/loan account, confirm gauge, interest card, insights render
3. **Wire up bulk exclude UI** — Add checkboxes to transaction table + "Excluir seleccionadas" action bar
4. **Debt simulator** (deferred) — Snowball vs Avalanche comparison with payment slider
5. **Phase 1 Sprint 2** — Budget tracking, recurring transaction detection, or next roadmap items

## 7. Context for Claude

- **Seed category UUIDs** follow `a0000001-0001-4000-8000-0000000000XX` (01–17). Referenced in both the migration and `auto-categorize.ts`. If UUIDs change, update both.
- **Recharts** is a project dependency used for charts and the debt utilization gauge (`PieChart` with `startAngle={180}`, `endAngle={0}`).
- **`InteractiveMetricCard`** at `webapp/src/components/dashboard/interactive-metric-card.tsx` supports types: `net-worth`, `income`, `expenses`, `balance`, `savings-rate`, `budget`.
- **`CategoryWithChildren`** type exists for tree views, but categories are now flat. `getCategories()` still builds a tree — the import page flattens it with `flatMap`.
- **`showExcluded` filter** uses `z.preprocess` to convert URL param string `"true"` to boolean.
- **`formatCurrency()`** defaults to COP with 0 decimals.
- **No tests exist** — verification is manual (browser + build check).
