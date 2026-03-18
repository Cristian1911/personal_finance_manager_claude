# Server Cache + Prefetch Design

**Date:** 2026-03-17
**Status:** Approved
**Goal:** Eliminate data-fetching latency on navigation by caching server queries and prefetching RSC payloads

## Problem

Every page navigation triggers fresh Supabase queries via server components. The app has zero client-side or server-side caching beyond React `cache()` for auth deduplication. Measured SPA navigation times:

| Route | Time |
|-------|------|
| Dashboard → Transacciones | ~2000ms |
| Cuentas → Deudas | ~1500ms |
| Deudas → Presupuesto | ~2000ms |
| Dashboard → Account Detail | ~2700ms |
| Any → Dashboard (revisit) | ~65ms |

Frame rate is excellent (61 FPS, zero jank). The bottleneck is purely data-fetching latency from Supabase (sa-east-1 region).

## Decision

**Hybrid: `use cache` directive on server + RSC prefetch on client.**

- Keeps the pure server component architecture (no client-side state management)
- Next.js 16 `'use cache'` directive with `cacheTag()` and `cacheLife()` for granular invalidation
- Link prefetching makes cached server responses arrive before the click
- Staleness model: **5-minute TTL + immediate mutation invalidation**

### Why `use cache` over `unstable_cache`

The project runs Next.js 16.1.6. `unstable_cache` is deprecated in favor of the `use cache` directive. Using `'use cache'` with `cacheTag()` and `cacheLife()`:
- First-class framework support, not deprecated
- Better DX with per-function directives
- Automatic cache key derivation from function arguments

## Architecture

### Layer 1 — Server Query Cache (`use cache`)

**The `use cache` directive cannot call dynamic request APIs** (`cookies()`, `headers()`). Since `getAuthenticatedClient()` reads cookies internally, auth must happen OUTSIDE the cached function. The pattern splits each read function into two:

1. **Public function** — verifies auth via cookies, then calls the cached inner function with `userId`
2. **Cached inner function** — uses the existing admin Supabase client (no cookies needed), receives `userId` as a parameter (which becomes part of the cache key)

**Pattern:**

```typescript
import { cacheTag, cacheLife } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Before (current)
export async function getAccounts() {
  const { supabase, user } = await getAuthenticatedClient();
  const { data } = await supabase.from("accounts").select("*").eq("user_id", user.id);
  return data;
}

// After — two functions
async function getAccountsCached(userId: string) {
  'use cache'
  cacheTag('accounts')
  cacheLife({ revalidate: 300 })

  const supabase = createAdminClient()!;
  const { data, error } = await supabase.from("accounts").select("*").eq("user_id", userId);
  if (error) throw error;  // never cache failures
  return data;
}

export async function getAccounts() {
  const { user } = await getAuthenticatedClient();  // auth via cookies (NOT cached)
  if (!user) return { success: false as const, error: "No autenticado" };
  return getAccountsCached(user.id);                 // userId becomes cache key
}

// Mutation side
import { revalidateTag } from "next/cache";

export async function createAccount(...) {
  // ... insert logic ...
  revalidateTag("accounts");
  revalidateTag("dashboard");
}
```

**Auth safety:**
- `getAuthenticatedClient()` always runs (cookie-based, not cached) — unauthenticated users are rejected before reaching the cache
- `userId` is a cache key parameter — each user gets their own cache entries, preventing cross-user leaks
- The admin client bypasses RLS, so **every query MUST have an explicit `.eq("user_id", userId)` filter** — this is non-negotiable

**Error handling:** Cached inner functions must `throw` on Supabase errors rather than returning error objects. `use cache` does not cache thrown errors — only successful return values. This prevents caching failures for 5 minutes.

**Return type note:** Functions that currently return `ActionResult<T>` keep that return type in the public wrapper. The cached inner function returns raw data (or throws). The public wrapper catches thrown errors and converts them to `{ success: false, error: message }`. Functions that already return raw arrays/objects (like chart functions) can call the cached inner function directly.

**`getPreferredCurrency` note:** This function is currently wrapped in React `cache()` for request-level deduplication. When adding `use cache`, extract the inner function from the `cache()` wrapper to avoid double-wrapping. The `use cache` directive replaces both behaviors (request dedup + cross-request caching).

### Layer 2 — RSC Prefetch on Client

- Sidebar `<Link>` components: verify `prefetch` is enabled (Next.js default)
- Dynamic links (account cards, transaction rows): `<PrefetchLink>` wrapper with `onMouseEnter={() => router.prefetch(href)}`
- Result: hover triggers RSC payload fetch → server responds from cache → click is instant

## Configuration

Enable the `use cache` directive in `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  cacheComponents: true,  // top-level, NOT under experimental
};
```

Uses the existing `SUPABASE_SECRET_KEY` env var (already configured for `createAdminClient()` in `lib/supabase/admin.ts`). No new environment variables needed.

## Prerequisites: Defense-in-Depth Audit

**CRITICAL:** Before converting any read function to use the admin client, audit it for missing `.eq("user_id", userId)` filters. The admin client bypasses RLS, so explicit user_id filtering is the only data isolation mechanism.

Functions currently missing explicit `user_id` filters (relying on RLS alone):

| Function | File | Fix Required |
|----------|------|-------------|
| `getCategorySpending()` | `actions/charts.ts` | Add `.eq("user_id", userId)` to transaction query |
| `getMonthlyCashflow()` | `actions/charts.ts` | Add `.eq("user_id", userId)` to transaction query |
| `getDailySpending()` | `actions/charts.ts` | Add `.eq("user_id", userId)` to transaction query |
| `getMonthMetrics()` | `actions/charts.ts` | Add `.eq("user_id", userId)` to transaction query |
| `getDailyCashflow()` | `actions/charts.ts` | Add `.eq("user_id", userId)` to transaction query |
| `getBudgetSummary()` | `actions/budgets.ts` | Add `.eq("user_id", userId)` to transaction query |
| `getRecurringSummary()` | `actions/recurring-templates.ts` | Add `.eq("user_id", userId)` to templates query |

These filters must be added **before** switching those functions to the admin client. This is a pre-existing defense-in-depth gap that becomes a hard security bug under the new architecture.

## Cache Tag Schema

| Tag | Cached Functions | Source File(s) |
|-----|-----------------|----------------|
| `accounts` | `getAccounts()`, `getAccount(id)`, `getAccountsWithSparklineData()` | `actions/accounts.ts`, `actions/charts.ts` |
| `categories` | `getCategories(direction?)`, `getCategoriesWithBudgets(direction?)`, `getAllCategoriesForManagement()` | `actions/categories.ts` |
| `budgets` | `getBudgets()`, `getBudgetSummary(month?)`, `getCategoriesWithBudgetData(month, currency)` | `actions/budgets.ts`, `actions/categories.ts` |
| `recurring` | `getRecurringTemplates()`, `getRecurringTemplate(id)`, `getUpcomingRecurrences(days?)`, `getRecurringSummary()` | `actions/recurring-templates.ts` |
| `profile` | `getProfile()`, `getPreferredCurrency()` | `actions/profile.ts` |
| `categorize` | `getUncategorizedTransactions()`, `getUncategorizedCount()`, `getUserCategoryRules()` | `actions/categorize.ts` |
| `snapshots` | `getLatestSnapshotDates()`, `getStatementSnapshots(id)`, `getUpcomingPayments()` | `actions/statement-snapshots.ts`, `actions/payment-reminders.ts` |
| `dashboard` | `getDailySpending()`, `getMonthlyCashflow()`, `getCategorySpending()`, `getMonthMetrics()`, `getDailyCashflow()`, `getNetWorthHistory()` | `actions/charts.ts` |
| `dashboard`, `accounts` | `getBurnRate()` | `actions/burn-rate.ts` |
| `debt` | `getDebtOverview(currency?)`, `getEstimatedIncome(currency?, month?)` | `actions/debt.ts`, `actions/income.ts` |
| `destinatarios` | `getDestinatarios()`, `getDestinatario(id)`, `getDestinatarioRules()`, `getUnmatchedDescriptions()` | `actions/destinatarios.ts` |

All tags use a 300-second (5-minute) TTL via `cacheLife({ revalidate: 300 })`.

### Nested caching: functions that delegate to cached sub-functions

These functions are **NOT cached directly** — they benefit from their sub-functions being cached individually. Caching them directly would freeze stale sub-function outputs inside a parent cache entry.

**`getDashboardHeroData(month, currency)`** — internally calls:
- `getUpcomingRecurrences()` (cached under `recurring`)
- `getUpcomingPayments()` (cached under `snapshots`)
- 2 direct Supabase queries (liquid accounts, active accounts) → **extract into cached helpers tagged with `accounts`**

**`getDailyBudgetPace(month, currency)`** — internally calls:
- `getDailySpending()` (cached under `dashboard`)
- `getBudgetSummary()` (cached under `budgets`)

**`getNetWorthHistory(month, currency)`** — internally calls:
- `getMonthlyCashflow()` (cached under `dashboard`)
- Direct account queries → **extract into cached helpers tagged with `accounts`**

### Non-deterministic dates

`getUpcomingPayments()`, `getBurnRate()`, and `getDailyBudgetPace()` (via `getDailySpending()`) use `new Date()` internally as query filters. When cached, this date freezes until TTL expires. With a 5-minute TTL this is acceptable (worst case: 5 minutes of stale data at midnight). No special handling needed.

### Parameter-variant cache keys

Functions with parameters automatically get unique cache entries per argument set (the `use cache` directive keys on arguments). Key parameter coverage:

| Function | Variant Parameters |
|----------|-------------------|
| `getCategories(direction?)` | `direction` (INFLOW / OUTFLOW / undefined) |
| `getCategoriesWithBudgets(direction?)` | `direction` |
| `getCategoriesWithBudgetData(month, currency)` | `month`, `currency` |
| `getDailySpending(month, currency)` | `month`, `currency` |
| `getMonthlyCashflow(month, currency)` | `month`, `currency` |
| `getCategorySpending(month, currency)` | `month`, `currency` |
| `getMonthMetrics(month?)` | `month` |
| `getDailyCashflow(month?)` | `month` |
| `getDebtOverview(currency?)` | `currency` |
| `getEstimatedIncome(currency?, month?)` | `currency`, `month` |
| `getBurnRate(currency?)` | `currency` |
| `getBudgetSummary(month?)` | `month` |
| `getAccount(id)` | `id` |
| `getRecurringTemplate(id)` | `id` |
| `getStatementSnapshots(accountId)` | `accountId` |
| `getDestinatario(id)` | `id` |
| `getUpcomingRecurrences(days?)` | `days` |

### Cross-concern: `getCategoriesWithBudgetData`

This function queries both categories AND transactions for the month. It must be invalidated by both category AND transaction mutations. Tagged with both `budgets` and `dashboard` to ensure this.

## Invalidation Map

| Mutation | Invalidates Tags |
|----------|-----------------|
| Create/update/delete account | `accounts`, `dashboard`, `debt` |
| `reconcileBalance` | `accounts`, `dashboard`, `debt`, `categorize` |
| `toggleDashboardVisibility` | `accounts`, `dashboard` |
| Create/update/delete transaction | `dashboard`, `categorize`, `debt`, `budgets` |
| `toggleExcludeTransaction` / `bulkExcludeTransactions` | `dashboard`, `categorize`, `budgets` |
| Bulk categorize / assign destinatario | `categorize`, `dashboard`, `destinatarios` |
| Create/update/delete category | `categories`, `budgets`, `dashboard` |
| Upsert/delete budget | `budgets`, `dashboard` |
| Create/update/delete recurring template | `recurring`, `dashboard` |
| `toggleRecurringTemplate` | `recurring`, `dashboard` |
| `recordRecurringOccurrencePayment` | `accounts`, `recurring`, `dashboard`, `categorize`, `debt` |
| Import transactions | `accounts`, `dashboard`, `categorize`, `snapshots`, `debt`, `budgets` |
| Update profile | `profile`, `dashboard` |
| `finishOnboarding` | `profile`, `accounts`, `dashboard` |
| Create/update/delete/merge destinatario | `destinatarios` |

**Note on expanded invalidation scope:** Some mutations (e.g., `createCategory`) currently only call `revalidatePath("/categories")`. The tag-based approach intentionally expands their invalidation to include `budgets` and `dashboard` because category names/colors affect dashboard charts and budget views. This is correct but broader than the current behavior — verify no unintended side effects.

**Note on `updateProfile`:** Changing `preferred_currency` affects dashboard charts that default to the user's preferred currency. `dashboard` is included in the invalidation set for this reason.

## What We're NOT Caching

- **Transaction list pages** — paginated, filtered differently each time. Caching every filter combination has diminishing returns.
- **Import flow** — ephemeral wizard state, one-time operation.
- **Auth/login pages** — no data to cache.
- **`getDestinatarioTransactions()`** — paginated per-destinatario view, same rationale as transaction lists.
- **`getDashboardHeroData()`** — not cached directly (nested caching, see above).
- **`getDailyBudgetPace()`** — not cached directly (nested caching, see above).
- **`getNetWorthHistory()`** — not cached directly (nested caching, see above).

## New Files

| File | Purpose |
|------|---------|
| `components/ui/prefetch-link.tsx` | `<PrefetchLink>` wrapper with hover prefetch |

Reuses existing `createAdminClient()` from `lib/supabase/admin.ts`. No new utility files needed.

## Expected Impact

| Metric | Before | After (projected) |
|--------|--------|-------------------|
| Dashboard → Transacciones | ~2000ms | ~50-100ms |
| Cuentas → Deudas | ~1500ms | ~50-100ms |
| Dashboard → Account Detail | ~2700ms | ~100-200ms |
| First visit (cold cache) | ~2000ms | ~2000ms (same, populates cache) |
| Subsequent navigations | ~2000ms | ~50-100ms (cache hit + prefetch) |

## Migration Strategy

1. **Defense-in-depth audit** — add `.eq("user_id", userId)` to all read functions listed in the Prerequisites section. This is a standalone commit that improves security independent of caching.
2. Enable `cacheComponents: true` in `next.config.ts` (top-level config)
3. For each domain (accounts → categories → budgets → recurring → profile → dashboard → debt → destinatarios → categorize → snapshots):
   a. Split each read function into public wrapper (auth + null check) + cached inner function (`use cache` + admin client)
   b. Replace `revalidatePath()` with `revalidateTag()` in the corresponding mutations **in the same commit**
   c. Cached inner functions throw on Supabase errors; public wrappers catch and convert to `ActionResult` where needed
4. Unwrap `getPreferredCurrency` from React `cache()` wrapper (replaced by `use cache`)
5. Extract direct Supabase queries from `getDashboardHeroData` and `getNetWorthHistory` into cached helpers tagged with `accounts`
6. Add `<PrefetchLink>` for dynamic links (account cards, transaction rows)
7. Verify with Playwright performance tests (same measurement harness used in baseline)
