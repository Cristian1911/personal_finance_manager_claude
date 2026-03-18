# Performance Optimization Plan — 2026-03-17

Based on comprehensive audit of database/RLS, rendering, caching, bundle size, and Vercel's 62 React optimization rules.

## Verification Gates

After each phase, run:
```bash
cd webapp && pnpm build  # Must pass clean
```

After database changes, run this query to confirm index usage:
```sql
SELECT indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## Phase 1: Database Indexes & Monitoring (30 min)

**Goal:** Eliminate sequential scans on hot paths, establish baseline metrics.

### Step 1.1: Enable pg_stat_statements

Run in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Then capture baseline of current slowest queries:

```sql
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(max_exec_time::numeric, 2) AS max_ms,
  left(query, 120) AS query
FROM pg_stat_statements
WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Save the output — compare after adding indexes.

### Step 1.2: Add critical indexes

Create migration: `npx supabase migration new add_performance_indexes`

```sql
-- Most impactful: dashboard budget/spending queries scan by user+date on every page load
CREATE INDEX idx_transactions_user_date
  ON transactions(user_id, transaction_date DESC);

-- Budget lookups by user+period (monthly/yearly)
CREATE INDEX idx_budgets_user_period
  ON budgets(user_id, period);

-- Category reassignment on delete (bulk update by category)
CREATE INDEX idx_transactions_category_user
  ON transactions(category_id, user_id)
  WHERE reconciled_into_transaction_id IS NULL;

-- Category tree queries (user's active categories)
CREATE INDEX idx_categories_user_active
  ON categories(user_id, is_active)
  WHERE user_id IS NOT NULL;
```

Push: `npx supabase db push`

### Step 1.3: Standardize budgets RLS

Create migration: `npx supabase migration new fix_budgets_rls_parenthesized`

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete their own budgets" ON public.budgets;

-- Recreate with parenthesized (select auth.uid()) — Supabase fast path
CREATE POLICY "Users can view their own budgets"
  ON public.budgets FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own budgets"
  ON public.budgets FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own budgets"
  ON public.budgets FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own budgets"
  ON public.budgets FOR DELETE
  USING ((select auth.uid()) = user_id);
```

### Step 1.4: Re-measure

Reset stats and use the app for a few minutes, then re-run the slow query report:

```sql
SELECT pg_stat_statements_reset();
-- ... use the app ...
-- Re-run the query from Step 1.1
```

**Expected outcome:** Budget/spending queries should drop from sequential scan to index scan. Dashboard load time should improve 100-300ms.

---

## Phase 2: Rendering & Caching Fixes (1-2 hours)

**Goal:** Fix streaming, eliminate waterfalls, reduce cache churn.

### Step 2.1: Remove root layout bare Suspense

**File:** `webapp/src/app/layout.tsx:40`

**Current:**
```tsx
<Suspense>{children}</Suspense>
```

**Fix:** Remove the Suspense wrapper entirely. Route-specific Suspense boundaries (already on dashboard/page.tsx) handle incremental loading. The root wrapper kills streaming — any suspended component blanks the entire page.

### Step 2.2: Fix dashboard waterfall + deduplicate getPreferredCurrency

**File:** `webapp/src/app/(dashboard)/dashboard/page.tsx:78-106`

**Current:** `getPreferredCurrency()` is called twice, and one call uses `.then()` inside `Promise.all` creating a hidden waterfall.

**Fix:**
```tsx
// Await currency first (it's cached, ~0ms after first call)
const preferredCurrency = await getPreferredCurrency();

// Then run everything else in parallel
const [{ data: recentTransactions }, { data: accounts }, { data: currencyCheck }, { data: fallbackAccount }] = await Promise.all([
  executeVisibleTransactionQuery(supabase, userId, preferredCurrency),
  supabase.from("accounts").select("id").eq("user_id", userId).eq("is_active", true).limit(1),
  supabase.from("accounts").select("id").eq("user_id", userId).eq("is_active", true).eq("currency_code", preferredCurrency).limit(1),
  supabase.from("accounts").select("id, name, currency_code").eq("user_id", userId).eq("is_active", true).order("display_order").limit(1),
]);
```

### Step 2.3: Granular cache tags

**Files:** All action files that call `revalidateTag("dashboard")`

Replace the single `"dashboard"` tag with specific tags:

| Current | Replace with |
|---------|-------------|
| `cacheTag("dashboard")` in hero data | `cacheTag("dashboard:hero")` |
| `cacheTag("dashboard")` in charts | `cacheTag("dashboard:charts")` |
| `cacheTag("dashboard")` in accounts | `cacheTag("dashboard:accounts")` |
| `cacheTag("dashboard")` in cashflow | `cacheTag("dashboard:cashflow")` |
| `cacheTag("dashboard")` in budget pace | `cacheTag("dashboard:budgets")` |

Then update revalidation calls in actions:
- `createTransaction` / `categorizeTransaction` → `revalidateTag("dashboard:charts")`, `revalidateTag("dashboard:budgets")`
- `createAccount` / `updateAccount` → `revalidateTag("dashboard:accounts")`, `revalidateTag("dashboard:hero")`
- `updateBudget` → `revalidateTag("dashboard:budgets")`

### Step 2.4: Fix categories page waterfall

**File:** `webapp/src/app/(dashboard)/categories/page.tsx:28-35`

**Current:** Awaits `getPreferredCurrency()` before starting Promise.all.

**Fix:** Include currency in the Promise.all:
```tsx
const [currency, manageResult, uncategorized, categoryTreeResult] = await Promise.all([
  getPreferredCurrency(),
  getAllCategoriesForManagement(),
  getUncategorizedTransactions(),
  getCategories(),
]);
// Then use currency for the budget-dependent query
const result = await getCategoriesWithBudgetData(month, currency);
```

### Step 2.5: Add missing Suspense fallbacks

- `dashboard/page.tsx` — MonthSelector Suspense needs a skeleton fallback
- `(dashboard)/loading.tsx` — Replace `return null` with a proper skeleton
- Account detail chart Suspense — use Card skeleton instead of plain div

---

## Phase 3: Bundle Optimization (1 hour)

**Goal:** Reduce First Load JS, eliminate unused dependencies.

### Step 3.1: Dynamic imports for heavy components

Add `next/dynamic` to these components where they're imported by their parent pages:

```tsx
import dynamic from "next/dynamic";

const DebtSimulator = dynamic(
  () => import("@/components/debt/debt-simulator").then(m => ({ default: m.DebtSimulator })),
  { loading: () => <CardSkeleton className="h-96" />, ssr: false }
);

const CategoryInbox = dynamic(
  () => import("@/components/categorize/category-inbox").then(m => ({ default: m.CategoryInbox })),
  { loading: () => <CardSkeleton className="h-64" /> }
);

const PurchaseDecisionCard = dynamic(
  () => import("@/components/dashboard/purchase-decision-card").then(m => ({ default: m.PurchaseDecisionCard })),
  { loading: () => <CardSkeleton className="h-48" /> }
);

const DestinatarioDetail = dynamic(
  () => import("@/components/destinatarios/destinatario-detail").then(m => ({ default: m.DestinatarioDetail })),
  { loading: () => <CardSkeleton className="h-64" /> }
);
```

Also dynamically import debt planner steps (compare-step, allocate-step, detail-step) since they're wizard steps only loaded one at a time.

### Step 3.2: Remove DashboardHero client directive

**File:** `webapp/src/components/dashboard/dashboard-hero.tsx:1`

Remove `"use client"` — this component is purely presentational with no hooks or interactivity. Let the server render it directly.

### Step 3.3: Disable recharts animations

In every chart component, add `isAnimationActive={false}`:
- `monthly-cashflow-chart.tsx`
- `balance-history-chart.tsx`
- `category-spending-chart.tsx`
- `daily-budget-pace-chart.tsx`
- Any other chart using recharts

The sparkline already does this correctly — follow its pattern.

### Step 3.4: Verify and remove @dnd-kit

```bash
cd webapp && grep -r "@dnd-kit" src/ --include="*.tsx" --include="*.ts"
```

If no results: `pnpm remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

### Step 3.5: Replace framer-motion page transition with CSS

**File:** `webapp/src/components/ui/page-transition.tsx`

Replace the framer-motion implementation with a CSS-only approach:

```tsx
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-enter">{children}</div>;
}
```

Add to `globals.css`:
```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-page-enter {
  animation: page-enter 0.1s ease-out;
}
```

Then check if framer-motion is used elsewhere (onboarding, mobile). If only in non-critical paths, consider keeping it but dynamically importing it there.

---

## Phase 4: Query Efficiency (1 hour)

**Goal:** Reduce payload sizes, enforce defense-in-depth.

### Step 4.1: Replace `.select("*")` with explicit columns

Priority files (hot paths):

**`actions/accounts.ts` — getAccountsCached:**
```tsx
// Before
.select("*")
// After (only fields used in account list/dashboard)
.select("id, name, account_type, currency_code, current_balance, credit_limit, interest_rate, minimum_payment, next_payment_date, display_order, is_active, institution_name")
```

**`actions/categories.ts` — getCategoriesCached:**
```tsx
// Before
.select("*")
// After
.select("id, name, icon, color, parent_id, is_active, is_system, user_id, budget_amount")
```

**`actions/transactions.ts` — transaction list queries:**
```tsx
// Before
.select("*")
// After
.select("id, description, amount, direction, transaction_date, category_id, account_id, currency_code, destinatario_id, is_excluded, capture_method, status, installment_current, installment_total, original_amount")
```

### Step 4.2: Add missing user_id defense-in-depth filters

**`import-transactions.ts:270`** — statement_snapshots query:
```tsx
.eq("user_id", userId)  // Add this line
.eq("account_id", meta.accountId)
```

Review all other queries in actions/ for RLS-only reliance and add explicit user_id filters.

---

## Phase 5: Vercel React Best Practices (Ongoing)

**Reference:** [vercel-labs/agent-skills/react-best-practices](https://github.com/vercel-labs/agent-skills)

### Already addressed by Phases 1-4:
- `async-parallel` — Fixed dashboard/categories waterfalls
- `async-suspense-boundaries` — Added missing fallbacks
- `bundle-dynamic-imports` — Added next/dynamic to heavy components
- `server-serialization` — Replaced select("*") with explicit columns
- `server-cache-react` — Already using React cache() correctly
- `server-auth-actions` — Already using getAuthenticatedClient()

### Rules to apply next (by priority):

**CRITICAL:**
- `async-defer-await` — Audit all server actions for early `await` that blocks unused branches
- `bundle-defer-third-party` — Move analytics/error tracking scripts to load after hydration
- `bundle-preload` — Add `<link rel="prefetch">` for routes likely to be navigated

**HIGH:**
- `server-after-nonblocking` — Use Next.js `after()` for logging, analytics, cache warming
- `server-dedup-props` — Check RSC boundaries for duplicate serialization
- `server-hoist-static-io` — Move static config reads to module scope

**MEDIUM:**
- `rerender-derived-state-no-effect` — Audit for useEffect that computes derived state
- `rerender-no-inline-components` — Check for components defined inside other components
- `rerender-transitions` — Use `startTransition` for non-urgent updates (filtering, tab switching)
- `rendering-content-visibility` — Apply `content-visibility: auto` to transaction list items

**LOW:**
- `js-set-map-lookups` — Replace `.includes()` on arrays with `Set.has()` in loops
- `js-flatmap-filter` — Replace `.filter().map()` chains with `.flatMap()`
- `js-index-maps` — Build Map<id, item> for repeated lookups in category/account resolution

### Recommendation: Install the Vercel skill

```bash
# Add to your agent skills for ongoing enforcement
# The skill auto-checks these patterns during code review
```

---

## Metrics to Track

| Metric | Current (est.) | Target | How to Measure |
|--------|---------------|--------|----------------|
| Dashboard TTFB | ~800ms | <400ms | Vercel Analytics or browser DevTools |
| Dashboard LCP | ~1.5s | <1s | Lighthouse / Web Vitals |
| First Load JS | ~250KB+ | <200KB | `pnpm build` output |
| Avg query time | Unknown | <50ms | pg_stat_statements |
| Cache hit rate | Low (broad invalidation) | >80% | Next.js cache headers |

---

## Summary

| Phase | Effort | Expected Impact |
|-------|--------|----------------|
| 1. Database indexes + monitoring | 30 min | 100-300ms dashboard improvement |
| 2. Rendering + caching | 1-2 hours | 200-500ms TTI improvement, 60% less cache churn |
| 3. Bundle optimization | 1 hour | 50-150KB less JS, faster navigation |
| 4. Query efficiency | 1 hour | Smaller payloads, defense-in-depth security |
| 5. Vercel rules (ongoing) | Continuous | Prevents regressions, cumulative gains |
