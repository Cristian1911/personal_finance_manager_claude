# Server Cache + Prefetch Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate data-fetching latency on SPA navigation by caching server queries with Next.js 16 `use cache` directive and prefetching RSC payloads on hover.

**Architecture:** Split each read function into a public auth wrapper + cached inner function using the admin Supabase client. Replace all `revalidatePath()` calls with granular `revalidateTag()`. Add a `<PrefetchLink>` component for dynamic links.

**Tech Stack:** Next.js 16.1.6 `use cache` / `cacheTag` / `cacheLife`, Supabase admin client, `revalidateTag`

**Spec:** `docs/superpowers/specs/2026-03-17-server-cache-prefetch-design.md`

---

## Task 0: Defense-in-Depth Audit — Add Missing `user_id` Filters

**Files:**
- Modify: `webapp/src/actions/charts.ts` (5 functions + 1 snapshots query)
- Modify: `webapp/src/actions/budgets.ts` (1 function)
- Modify: `webapp/src/actions/recurring-templates.ts` (1 function)

These functions rely on RLS alone. With the admin client (which bypasses RLS), they would leak data across users. Fix **before** any caching work.

- [ ] **Step 1: Fix chart functions in `charts.ts`**

These 5 functions use `executeVisibleTransactionQuery()` with a query builder closure that does NOT include `.eq("user_id", userId)` on the transaction query. Add the filter to each:

| Function | ~Line | Fix |
|----------|-------|-----|
| `getCategorySpending()` | ~56-65 | Add `.eq("user_id", user.id)` to the transaction query inside the builder closure |
| `getMonthlyCashflow()` | ~130-139 | Same |
| `getDailySpending()` | ~184-194 | Same |
| `getMonthMetrics()` | ~228-235 | Same |
| `getDailyCashflow()` | ~271-279 | Same |

- [ ] **Step 2: Fix `getAccountsWithSparklineData()` snapshots query in `charts.ts`**

Find the snapshots query at ~lines 566-570 that uses `.in("account_id", accountIds)` without a `user_id` filter. Add `.eq("user_id", user.id)` to the query.

- [ ] **Step 3: Fix `getBudgetSummary()` in `budgets.ts`**

Find the transaction query at ~line 99-108 that uses `executeVisibleTransactionQuery()`. Add `.eq("user_id", user.id)` to the transaction query inside the builder closure.

- [ ] **Step 4: Fix `getRecurringSummary()` in `recurring-templates.ts`**

Find the query at ~line 779 that has `.eq("is_active", true)` without a `user_id` filter. Add `.eq("user_id", user.id)` before `.eq("is_active", true)`.

- [ ] **Step 5: Verify no other queries are missing `user_id`**

Search all `actions/*.ts` files for Supabase `.from(` calls that don't have `.eq("user_id"` or `.eq("id", user.id)`. Verify each is either a system table query or already filtered.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/actions/charts.ts webapp/src/actions/budgets.ts webapp/src/actions/recurring-templates.ts
git commit -m "fix: add missing user_id defense-in-depth filters for cache safety"
```

---

## Task 1: Enable `use cache` + Define Cache Profile

**Files:**
- Modify: `webapp/next.config.ts`

- [ ] **Step 1: Update `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  cacheLife: {
    zeta: {
      stale: 300,      // 5 minutes — serve stale while revalidating
      revalidate: 300,  // 5 minutes — background revalidation interval
      expire: 3600,     // 1 hour — max staleness before forced refresh
    },
  },
  turbopack: {
    root: "..",
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify dev server starts cleanly**

```bash
cd webapp && pnpm dev
```

Kill and restart if Turbopack panics. Verify no errors about `cacheComponents`.

- [ ] **Step 3: Commit**

```bash
git add webapp/next.config.ts
git commit -m "feat: enable use cache directive with zeta cache profile"
```

---

## Task 2: Cache Accounts Domain

**Files:**
- Modify: `webapp/src/actions/accounts.ts`

The pattern for each read function:
1. Import `cacheTag`, `cacheLife` from `next/cache` and `createAdminClient` from `@/lib/supabase/admin`
2. Extract the query into a `*Cached(userId)` inner function with `'use cache'` directive
3. Keep the public function for auth (null check) + call inner function
4. Replace `revalidatePath` with `revalidateTag` in mutations

- [ ] **Step 1: Add imports at top of `accounts.ts`**

```typescript
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
```

- [ ] **Step 2: Convert `getAccounts()` (~lines 10-24)**

Split into cached inner function + public wrapper:

```typescript
async function getAccountsCached(userId: string) {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");

  const supabase = createAdminClient()!;
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data;
}

// IMPORTANT: Always preserve the exact query filters and ordering from the
// original function. Read the existing code carefully before writing the
// cached version. The example above preserves .eq("is_active", true) and
// .order("display_order") from the original getAccounts().

export async function getAccounts(): Promise<ActionResult<Account[]>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    const data = await getAccountsCached(user.id);
    return { success: true, data: data ?? [] };
  } catch {
    return { success: false, error: "Error al cargar cuentas" };
  }
}
```

- [ ] **Step 3: Convert `getAccount(id)` (~lines 26-40)**

Same pattern — cached inner receives `(userId, accountId)`:

```typescript
async function getAccountCached(userId: string, accountId: string) {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");

  const supabase = createAdminClient()!;
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getAccount(id: string): Promise<ActionResult<Account>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    const data = await getAccountCached(user.id, id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Cuenta no encontrada" };
  }
}
```

- [ ] **Step 4: Replace `revalidatePath` in all account mutations**

In each mutation function, replace `revalidatePath("/accounts")` with the appropriate `revalidateTag()` calls per the invalidation map:

| Mutation | Replace with |
|----------|-------------|
| `createAccount` (~line 113) | `revalidateTag("accounts"); revalidateTag("dashboard"); revalidateTag("debt");` |
| `updateAccount` (~line 144) | `revalidateTag("accounts"); revalidateTag("dashboard"); revalidateTag("debt");` |
| `deleteAccount` (~line 157) | `revalidateTag("accounts"); revalidateTag("dashboard"); revalidateTag("debt");` |
| `toggleDashboardVisibility` (~line 177) | `revalidateTag("accounts"); revalidateTag("dashboard");` |
| `reconcileBalance` (~line 247) | `revalidateTag("accounts"); revalidateTag("dashboard"); revalidateTag("debt"); revalidateTag("categorize");` |

Remove the `import { revalidatePath } from "next/cache"` if no longer used.

- [ ] **Step 5: Run build to verify types**

```bash
cd webapp && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add webapp/src/actions/accounts.ts
git commit -m "feat(cache): accounts domain — use cache + revalidateTag"
```

---

## Task 3: Cache Categories Domain

**Files:**
- Modify: `webapp/src/actions/categories.ts`

- [ ] **Step 1: Add imports**

```typescript
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
```

- [ ] **Step 2: Convert read functions**

Apply the same split pattern to each:

| Function | Cache Key Params | Tag |
|----------|-----------------|-----|
| `getCategories(direction?)` (~line 11) | `(userId, direction)` | `"categories"` |
| `getCategoriesWithBudgets(direction?)` (~line 62) | `(userId, direction)` | `"categories"` |
| `getAllCategoriesForManagement()` (~line 343) | `(userId)` | `"categories"` |
| `getCategoryTransactionCount(categoryId)` (~line 273) | `(userId, categoryId)` | `"categories"` |
| `getCategoriesWithBudgetData(month, currency)` (~line 399) | `(userId, month, currency)` | Tag with BOTH `"budgets"` and `"dashboard"` (cross-concern) |

**Important:** For `getCategories` and `getCategoriesWithBudgets`, the query uses `.or(\`user_id.eq.${user.id},user_id.is.null\`)` to include system categories. Preserve this exact filter in the cached inner function.

**Important:** `getCategoriesWithBudgetData` is a large function (~140 lines) that joins categories, budgets, transactions, and recurring templates. The cached inner function will need all of its Supabase queries converted to use the admin client. Multiple `cacheTag` calls: `cacheTag("budgets"); cacheTag("dashboard");`.

- [ ] **Step 3: Replace `revalidatePath` in all category mutations**

| Mutation | Replace with |
|----------|-------------|
| `createCategory` (~line 163) | `revalidateTag("categories"); revalidateTag("budgets"); revalidateTag("dashboard");` |
| `updateCategory` (~line 200) | `revalidateTag("categories"); revalidateTag("budgets"); revalidateTag("dashboard");` |
| `deleteCategory` (~line 217) | `revalidateTag("categories"); revalidateTag("budgets"); revalidateTag("dashboard");` |
| `updateCategoryOrder` (~line 250) | `revalidateTag("categories"); revalidateTag("budgets"); revalidateTag("dashboard");` |
| `updateCategoryExpenseType` (~line 269) | `revalidateTag("categories"); revalidateTag("budgets"); revalidateTag("dashboard");` |
| `reassignAndDeleteCategory` (~line 320) | `revalidateTag("categories"); revalidateTag("budgets"); revalidateTag("dashboard");` |
| `toggleCategoryActive` (~line 339) | `revalidateTag("categories"); revalidateTag("budgets"); revalidateTag("dashboard");` |

- [ ] **Step 4: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/categories.ts
git commit -m "feat(cache): categories domain — use cache + revalidateTag"
```

---

## Task 4: Cache Budgets Domain

**Files:**
- Modify: `webapp/src/actions/budgets.ts`

- [ ] **Step 1: Add imports and convert read functions**

| Function | Cache Key Params | Tag | Return Type |
|----------|-----------------|-----|-------------|
| `getBudgets()` (~line 14) | `(userId)` | `"budgets"` | ActionResult |
| `getBudgetSummary(month?)` (~line 85) | `(userId, month)` | `"budgets"` | Raw object |

`getBudgetSummary` returns raw data (not ActionResult), so the public wrapper doesn't need try/catch → ActionResult conversion. Just pass through. **Read the actual `BudgetSummary` type** to write the correct fallback (check the type definition in budgets.ts for exact field names):

```typescript
export async function getBudgetSummary(month?: string): Promise<BudgetSummary> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { totalTarget: 0, totalSpent: 0, progress: 0 }; // match actual BudgetSummary type
  return getBudgetSummaryCached(user.id, month);
}
```

- [ ] **Step 2: Replace `revalidatePath` in mutations**

| Mutation | Replace with |
|----------|-------------|
| `upsertBudget` (~line 62) | `revalidateTag("budgets"); revalidateTag("dashboard");` |
| `deleteBudget` (~line 75) | `revalidateTag("budgets"); revalidateTag("dashboard");` |

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/budgets.ts
git commit -m "feat(cache): budgets domain — use cache + revalidateTag"
```

---

## Task 5: Cache Recurring Templates Domain

**Files:**
- Modify: `webapp/src/actions/recurring-templates.ts`

- [ ] **Step 1: Add imports and convert read functions**

| Function | Cache Key Params | Tag | Return Type |
|----------|-----------------|-----|-------------|
| `getRecurringTemplates()` (~line 59) | `(userId)` | `"recurring"` | ActionResult |
| `getRecurringTemplate(id)` (~line 77) | `(userId, id)` | `"recurring"` | ActionResult |
| `getUpcomingRecurrences(days?)` (~line 723) | `(userId, days)` | `"recurring"` | Raw array |
| `getRecurringSummary()` (~line 766) | `(userId)` | `"recurring"` | Raw object |

- [ ] **Step 2: Replace `revalidatePath` in mutations**

| Mutation | Replace with |
|----------|-------------|
| `createRecurringTemplate` (~line 159) | `revalidateTag("recurring"); revalidateTag("dashboard");` |
| `updateRecurringTemplate` (~line 227) | `revalidateTag("recurring"); revalidateTag("dashboard");` |
| `deleteRecurringTemplate` (~line 246) | `revalidateTag("recurring"); revalidateTag("dashboard");` |
| `toggleRecurringTemplate` (~line 266) | `revalidateTag("recurring"); revalidateTag("dashboard");` |
| `recordRecurringOccurrencePayment` (~line 708) | `revalidateTag("accounts"); revalidateTag("recurring"); revalidateTag("dashboard"); revalidateTag("categorize"); revalidateTag("debt");` |

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/recurring-templates.ts
git commit -m "feat(cache): recurring templates domain — use cache + revalidateTag"
```

---

## Task 6: Cache Profile Domain

**Files:**
- Modify: `webapp/src/actions/profile.ts`

- [ ] **Step 1: Add imports and convert read functions**

| Function | Cache Key Params | Tag | Notes |
|----------|-----------------|-----|-------|
| `getPreferredCurrency()` (~line 14) | `(userId)` | `"profile"` | **Remove existing `cache()` wrapper** — `use cache` replaces it |
| `getProfile()` (~line 38) | `(userId)` | `"profile"` | ActionResult |

For `getPreferredCurrency`: change from `export const getPreferredCurrency = cache(async () => { ... })` to a standard function pair:

```typescript
async function getPreferredCurrencyCached(userId: string) {
  "use cache";
  cacheTag("profile");
  cacheLife("zeta");

  const supabase = createAdminClient()!;
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", userId)
    .single();

  return (profile?.preferred_currency ?? "COP") as CurrencyCode;
}

export async function getPreferredCurrency(): Promise<CurrencyCode> {
  const { user } = await getAuthenticatedClient();
  if (!user) return "COP";
  return getPreferredCurrencyCached(user.id);
}
```

Remove the React `cache` import if no longer used elsewhere in this file.

- [ ] **Step 2: Replace `revalidatePath` in `updateProfile`**

Replace `revalidatePath("/settings")` (~line 82) with:
```typescript
revalidateTag("profile");
revalidateTag("dashboard");
```

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/profile.ts
git commit -m "feat(cache): profile domain — use cache + revalidateTag, unwrap getPreferredCurrency"
```

---

## Task 7: Cache Dashboard Charts Domain

**Files:**
- Modify: `webapp/src/actions/charts.ts`

This is the largest file — many functions, all return raw data (not ActionResult).

- [ ] **Step 1: Add imports**

```typescript
import { cacheTag, cacheLife } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
```

- [ ] **Step 2: Convert directly-cached chart functions**

These functions get `'use cache'` directly (they don't have nested caching issues):

| Function | Cache Key Params | Tag |
|----------|-----------------|-----|
| `getCategorySpending(month?, currency?)` (~line 47) | `(userId, month, currency)` | `"dashboard"` |
| `getMonthlyCashflow(month?, currency?)` (~line 124) | `(userId, month, currency)` | `"dashboard"` |
| `getDailySpending(month?, currency?)` (~line 178) | `(userId, month, currency)` | `"dashboard"` |
| `getMonthMetrics(month?)` (~line 222) | `(userId, month)` | `"dashboard"` |
| `getDailyCashflow(month?)` (~line 262) | `(userId, month)` | `"dashboard"` |
| `getAccountsWithSparklineData()` (~line 549) | `(userId)` | `"accounts"` |

**Important:** These functions use `executeVisibleTransactionQuery` or similar helpers internally. The cached inner function needs to replicate the query using the admin client directly, not through the helper (which may call `getAuthenticatedClient()`). Read the existing query logic carefully and reproduce it with the admin client + explicit `user_id` filter.

- [ ] **Step 3: Handle non-cached orchestrator functions**

These functions are NOT cached directly (they call other cached functions):

| Function | Delegates to | Action |
|----------|-------------|--------|
| `getDashboardHeroData(month?, currency?)` (~line 424) | `getUpcomingRecurrences()`, `getUpcomingPayments()`, + 2 direct queries | Extract the 2 direct account queries into a cached helper `getDashboardAccountsCached(userId)` tagged `"accounts"`. Keep the function itself uncached. |
| `getDailyBudgetPace(month?, currency?)` (~line 652) | `getDailySpending()`, `getBudgetSummary()` | Keep uncached — both sub-functions are already cached. |
| `getNetWorthHistory(month?, currency?)` (~line 329) | `getMonthlyCashflow()` + direct account queries | Extract direct account queries into a cached helper if not already covered by `getDashboardAccountsCached`. Keep uncached. |

- [ ] **Step 4: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/charts.ts
git commit -m "feat(cache): dashboard charts — use cache for chart queries"
```

---

## Task 8: Cache Burn Rate, Debt, Income Domains

**Files:**
- Modify: `webapp/src/actions/burn-rate.ts`
- Modify: `webapp/src/actions/debt.ts`
- Modify: `webapp/src/actions/income.ts`

- [ ] **Step 1: Convert `getBurnRate(currency?)` in `burn-rate.ts`**

Cache key params: `(userId, currency)`. Tags: `"dashboard"`, `"accounts"` (queries both). Return type: raw object or null.

- [ ] **Step 2: Convert `getDebtOverview(currency?)` in `debt.ts`**

Cache key params: `(userId, currency)`. Tag: `"debt"`. Return type: raw object.

- [ ] **Step 3: Convert `getEstimatedIncome(currency?, month?)` in `income.ts`**

Cache key params: `(userId, currency, month)`. Tag: `"debt"`. Return type: raw object or null.

- [ ] **Step 4: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/burn-rate.ts webapp/src/actions/debt.ts webapp/src/actions/income.ts
git commit -m "feat(cache): burn-rate, debt, income — use cache"
```

---

## Task 9: Cache Categorize Domain

**Files:**
- Modify: `webapp/src/actions/categorize.ts`

- [ ] **Step 1: Convert read functions**

| Function | Cache Key Params | Tag | Return Type |
|----------|-----------------|-----|-------------|
| `getUncategorizedTransactions()` (~line 14) | `(userId)` | `"categorize"` | Raw array |
| `getUncategorizedCount()` (~line 41) | `(userId)` | `"categorize"` | Raw number |
| `getUserCategoryRules()` (~line 66) | `(userId)` | `"categorize"` | Raw array |

- [ ] **Step 2: Replace `revalidatePath` in mutations**

| Mutation | Replace with |
|----------|-------------|
| `categorizeTransaction` (~line 152) | `revalidateTag("categorize"); revalidateTag("dashboard"); revalidateTag("destinatarios");` |
| `bulkCategorize` (~line 215) | `revalidateTag("categorize"); revalidateTag("dashboard"); revalidateTag("destinatarios");` |
| `assignDestinatario` (~line 297) | `revalidateTag("categorize"); revalidateTag("dashboard"); revalidateTag("destinatarios");` |
| `removeDestinatarioFromTransaction` (~line 320) | `revalidateTag("categorize"); revalidateTag("dashboard"); revalidateTag("destinatarios");` |

**Note:** `categorizeTransaction` can update a destinatario's `default_category_id`, and `removeDestinatarioFromTransaction` changes transaction counts visible in `getDestinatarios()`. Both need to invalidate `destinatarios`.

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/categorize.ts
git commit -m "feat(cache): categorize domain — use cache + revalidateTag"
```

---

## Task 10: Cache Snapshots + Payment Reminders

**Files:**
- Modify: `webapp/src/actions/statement-snapshots.ts`
- Modify: `webapp/src/actions/payment-reminders.ts`

- [ ] **Step 1: Convert read functions**

| Function | File | Cache Key Params | Tag | Return Type |
|----------|------|-----------------|-----|-------------|
| `getLatestSnapshotDates()` | `statement-snapshots.ts` | `(userId)` | `"snapshots"` | Raw object |
| `getStatementSnapshots(accountId)` | `statement-snapshots.ts` | `(userId, accountId)` | `"snapshots"` | ActionResult |
| `getUpcomingPayments()` | `payment-reminders.ts` | `(userId)` | `"snapshots"` | Raw array |

- [ ] **Step 2: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/statement-snapshots.ts webapp/src/actions/payment-reminders.ts
git commit -m "feat(cache): snapshots + payment reminders — use cache"
```

---

## Task 11: Cache Destinatarios Domain

**Files:**
- Modify: `webapp/src/actions/destinatarios.ts`

- [ ] **Step 1: Convert read functions**

| Function | Cache Key Params | Tag |
|----------|-----------------|-----|
| `getDestinatarios()` (~line 93) | `(userId)` | `"destinatarios"` |
| `getDestinatario(id)` (~line 123) | `(userId, id)` | `"destinatarios"` |
| `getDestinatarioRules()` (~line 152) | `(userId)` | `"destinatarios"` |
| `getUnmatchedDescriptions()` (~line 437) | `(userId)` | `"destinatarios"` |
| `getDestinatarioSuggestions()` (~line 514) | `(userId)` | `"destinatarios"` |

**Not cached:** `getDestinatarioTransactions()` — paginated, per spec.
**Not cached:** `testDestinatarioPattern()` — ephemeral UI testing function.

- [ ] **Step 2: Replace `revalidatePath` in mutations**

| Mutation | Replace with |
|----------|-------------|
| `createDestinatario` (~line 251) | `revalidateTag("destinatarios");` |
| `updateDestinatario` (~line 286) | `revalidateTag("destinatarios");` |
| `deleteDestinatario` (~line 306) | `revalidateTag("destinatarios");` |
| `mergeDestinatarios` (~line 351) | `revalidateTag("destinatarios");` |
| `addDestinatarioRule` (~line 411) | `revalidateTag("destinatarios");` |
| `removeDestinatarioRule` (~line 431) | `revalidateTag("destinatarios");` |

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/destinatarios.ts
git commit -m "feat(cache): destinatarios domain — use cache + revalidateTag"
```

---

## Task 12: Update Cross-Domain Mutation Invalidation

**Files:**
- Modify: `webapp/src/actions/transactions.ts`
- Modify: `webapp/src/actions/import-transactions.ts`
- Modify: `webapp/src/actions/onboarding.ts`

These files have mutations that affect cached domains but weren't covered in the domain-specific tasks above.

- [ ] **Step 1: Update `transactions.ts` mutations**

Add import: `import { revalidateTag } from "next/cache";`

| Mutation | Current `revalidatePath` | Replace with |
|----------|------------------------|-------------|
| `persistTransaction` (internal, ~line 74) | `/transactions` | `revalidateTag("dashboard"); revalidateTag("categorize"); revalidateTag("debt"); revalidateTag("budgets");` |
| `updateTransaction` (~line 272) | `/transactions` | `revalidateTag("dashboard"); revalidateTag("categorize"); revalidateTag("debt"); revalidateTag("budgets");` |
| `deleteTransaction` (~line 285) | `/transactions` | `revalidateTag("dashboard"); revalidateTag("categorize"); revalidateTag("debt"); revalidateTag("budgets");` |
| `toggleExcludeTransaction` (~line 305) | `/transactions` | `revalidateTag("dashboard"); revalidateTag("categorize"); revalidateTag("budgets");` |
| `bulkExcludeTransactions` (~line 325) | `/transactions` | `revalidateTag("dashboard"); revalidateTag("categorize"); revalidateTag("budgets");` |

**Note:** Transaction list pages are NOT cached, so we don't need a `"transactions"` tag. We only invalidate domains that depend on transaction data.

- [ ] **Step 2: Update `import-transactions.ts` mutations**

| Mutation | Current `revalidatePath` | Replace with |
|----------|------------------------|-------------|
| `importTransactions` (~line 615-616) | `/transactions`, `/accounts` | `revalidateTag("accounts"); revalidateTag("dashboard"); revalidateTag("categorize"); revalidateTag("snapshots"); revalidateTag("debt"); revalidateTag("budgets");` |

- [ ] **Step 3: Update `onboarding.ts` mutations**

| Mutation | Current `revalidatePath` | Replace with |
|----------|------------------------|-------------|
| `finishOnboarding` (~lines 79-80) | `/dashboard`, `/` | `revalidateTag("profile"); revalidateTag("accounts"); revalidateTag("dashboard");` |

- [ ] **Step 4: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/transactions.ts webapp/src/actions/import-transactions.ts webapp/src/actions/onboarding.ts
git commit -m "feat(cache): cross-domain mutation invalidation — transactions, import, onboarding"
```

---

## Task 13: Add `<PrefetchLink>` Component

**Files:**
- Create: `webapp/src/components/ui/prefetch-link.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type PrefetchLinkProps = ComponentProps<typeof Link>;

export function PrefetchLink({ onMouseEnter, ...props }: PrefetchLinkProps) {
  const router = useRouter();

  return (
    <Link
      {...props}
      onMouseEnter={(e) => {
        const href = typeof props.href === "string" ? props.href : props.href.pathname;
        if (href) router.prefetch(href);
        onMouseEnter?.(e);
      }}
    />
  );
}
```

- [ ] **Step 2: Use `PrefetchLink` in dashboard account cards**

In `webapp/src/app/(dashboard)/dashboard/page.tsx` (or the component rendering account cards), replace `<Link>` with `<PrefetchLink>` for account detail links (e.g., `/accounts/[id]`). These are the dynamic links that benefit most from hover prefetching.

Also check transaction row links and any other links to detail pages that take >200ms.

- [ ] **Step 3: Verify sidebar `<Link>` has prefetch enabled**

Check `webapp/src/components/layout/sidebar.tsx` — Next.js `<Link>` has `prefetch={true}` by default. Confirm it's NOT set to `prefetch={false}`. No changes needed if using default.

- [ ] **Step 4: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/ui/prefetch-link.tsx webapp/src/app/\(dashboard\)/dashboard/
git commit -m "feat: PrefetchLink component for hover-based RSC prefetching"
```

---

## Task 14: Verify with Playwright Performance Tests

**Files:** None (testing only)

- [ ] **Step 1: Start dev server and navigate to dashboard**

```bash
cd webapp && pnpm dev
```

Navigate to `http://localhost:3000/dashboard` in Playwright, log in.

- [ ] **Step 2: Measure cold navigation (first visit)**

Navigate Dashboard → Transacciones → Cuentas → Deudas → Presupuesto. Record times.

- [ ] **Step 3: Measure warm navigation (cache populated)**

Navigate the same circuit again. Record times. Compare against baseline:

| Route | Baseline | Target |
|-------|----------|--------|
| Dashboard → Transacciones | ~2000ms | <200ms |
| Transacciones → Cuentas | ~800ms | <150ms |
| Cuentas → Deudas | ~1500ms | <200ms |
| Deudas → Presupuesto | ~2000ms | <200ms |
| Any → Dashboard | ~65ms | ~65ms (already fast) |

- [ ] **Step 4: Verify mutation invalidation**

Create a test transaction or category, then navigate back to dashboard. Verify the new data appears (cache was invalidated correctly).

- [ ] **Step 5: Run production build**

```bash
cd webapp && pnpm build
```

Verify clean build with no type errors.

- [ ] **Step 6: Commit any test infrastructure if saved**

If Playwright test scripts were saved, commit them.
