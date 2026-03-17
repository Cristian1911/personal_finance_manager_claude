# Performance Optimization — Speed-First Webapp

**Date:** 2026-03-17
**Status:** Approved — ready for implementation planning

## Goal

Make every interaction in Zeta feel instantaneous. Eliminate perceived latency from form submissions, page navigations, and data loads. Establish speed-first patterns that carry over to the React Native app.

## Guiding Principle

> **The UI must never wait for the network.** Show the result immediately, sync in background, revert on failure.

This is the #1 priority for the app — above visual polish, animations, or feature completeness.

## Audit Summary

| Category | Current State | Target |
|----------|--------------|--------|
| `router.refresh()` calls | 10 instances blocking UI | 0 — all replaced with optimistic updates |
| `revalidatePath` scope | 64+ calls, many invalidating 4-5 pages | Scoped to affected page only |
| Sequential DB queries | 3 pages with waterfalls | All parallel |
| Suspense boundaries | None on critical pages | Dashboard, deudas, account detail |
| Page transition | 200ms fade on every nav | 100ms (minimal jank cover) |

---

## Tier 1: Optimistic Updates (Critical)

### Pattern

Every mutation follows this pattern:

```typescript
// 1. Update local state IMMEDIATELY
setItems(prev => prev.map(i => i.id === id ? { ...i, ...optimisticData } : i));

// 2. Fire-and-forget server action
mutateServerAction(data).then(result => {
  if (!result.success) {
    // 3. Revert on failure
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...originalData } : i));
    toast.error(result.error);
  }
});
```

No `router.refresh()`. No `startTransition(() => router.refresh())`. No waiting.

### Files to refactor

| File | Line | Action | Optimistic Strategy |
|------|------|--------|-------------------|
| `components/budget/budget-category-grid.tsx` | 56 | Save budget | Update budget amount in local state, close editor |
| `components/budget/month-planner.tsx` | 54 | Bulk budget save | Update all budget values in local state at once |
| `components/budget/category-manage-list.tsx` | 58 | Add subcategory | Append to local tree with temp ID, replace on confirm |
| `components/budget/category-manage-list.tsx` | 72 | Delete subcategory | Remove from local tree immediately |
| `components/budget/category-manage-list.tsx` | 83 | Toggle category active | Toggle local boolean |
| `components/mobile/mobile-sheet-provider.tsx` | 68 | FAB form submit | Close drawer + show toast; dashboard data stays until next nav |
| `components/destinatarios/destinatario-suggestions-tab.tsx` | 106 | Create destinatario | Push to local list |
| `components/destinatarios/merge-dialog.tsx` | 53 | Merge destinatarios | Replace merged items with result |
| `components/debt/scenario-planner.tsx` | 262 | Scenario callback | Already local state — remove refresh if present |
| `components/import/step-destinatarios.tsx` | 181 | Create in import wizard | Append to local rules list |

### Special case: Mobile FAB transactions

The mobile sheet provider is unique — it creates transactions from a drawer overlay on any page. After the drawer closes, the user is back on whatever page they were on.

Strategy: Close drawer + show success toast. The server action already calls `revalidatePath`. On next navigation, the target page will have fresh data. If the user stays on dashboard, the `revalidatePath("/dashboard")` the action already calls will serve fresh data on the next RSC request — but we **don't** force that request immediately. The user sees the toast confirmation and continues.

If the user wants to see the new transaction immediately on the dashboard, they can pull-to-refresh or navigate away and back. This is acceptable because:
- The success toast confirms the action worked
- Full refetch is expensive (8 parallel queries)
- The transaction appears on next natural navigation

Alternative: If this feels too stale, add a lightweight "last transaction" client cache that shows a "just added" indicator on the dashboard without refetching all data.

---

## Tier 2: Scoped Revalidation

### Current Problem

Import a PDF → invalidates `/transactions`, `/dashboard`, `/accounts`, `/deudas` (4 pages).
Save a recurring template → invalidates 5 pages.
Edit a budget → invalidates `/categories` + `/dashboard`.

Most of these invalidations are unnecessary. The dashboard recalculates on visit anyway.

### Rules

1. **Only revalidate the page the user is currently on** — other pages will be fresh when visited
2. **Never revalidate `/dashboard` from non-dashboard actions** — dashboard always fetches fresh data as a dynamic page
3. **Batch revalidations** — if an action affects 2 related paths, that's fine. But 4-5 paths is a broadcast.

### Specific changes

| Action file | Current | Proposed |
|-------------|---------|----------|
| `actions/import-transactions.ts:615-618` | 4 paths | Just `/transactions` + `/accounts` |
| `actions/recurring-templates.ts:712-716` | 5 paths | Just `/recurrentes` |
| `actions/budgets.ts:62-63` | `/categories` + `/dashboard` | Just `/categories` |
| `actions/transactions.ts:74-76` | `/transactions` + `/dashboard` + `/accounts` | Just `/transactions` |
| `actions/accounts.ts:113-114, 145-146` | `/accounts` + `/dashboard` | Just `/accounts` |
| `actions/categorize.ts:152-153` | `/categorizar` + `/transactions` | Just `/categorizar` |
| `actions/profile.ts:82-84` | `/dashboard` + `/` layout | Just `/settings` |

**Exception:** `import-transactions` keeps `/accounts` because import updates account metadata (balance, credit limit). Two paths is acceptable for an operation that genuinely touches both entities.

---

## Tier 3: Parallel Queries

### Dashboard fallback waterfall

**File:** `app/(dashboard)/dashboard/page.tsx:95-113`

Current: Fetches preferred currency → checks if accounts exist in that currency → falls back to first account's currency. Three sequential queries.

Fix: Fetch preferred currency and first account currency in parallel, decide after both resolve.

```typescript
const [preferredCurrency, firstAccountCurrency] = await Promise.all([
  getPreferredCurrency(),
  supabase.from("accounts").select("currency_code").eq("is_active", true).order("created_at").limit(1).single(),
]);

const currency = preferredCurrency && hasAccountsInCurrency(preferredCurrency)
  ? preferredCurrency
  : (firstAccountCurrency?.currency_code as CurrencyCode) ?? "COP";
```

### Deudas exchange rate

**File:** `app/(dashboard)/deudas/page.tsx:69-70`

Current: Fetches debt overview → conditionally fetches exchange rate.

Fix: Always fetch exchange rate in the initial `Promise.all` (it's a cached 24h value — cheap). Skip if not needed in render.

### Account detail snapshots

**File:** `app/(dashboard)/accounts/[id]/page.tsx:34-45`

Current: Fetches account → conditionally fetches snapshots.

Fix: Fetch both in parallel. The snapshot query returns empty for non-credit accounts — cheap.

---

## Tier 4: Suspense Boundaries

### Dashboard split

```
┌──────────────────────────────┐
│ Hero card (fast — no suspense│  ← Shows immediately
│ "Disponible para gastar")    │
├──────────────────────────────┤
│ Burn rate card               │  ← Shows immediately (same query batch)
├──────────────────────────────┤
│ <Suspense fallback={skel}>   │
│   Upcoming payments          │  ← May take 200ms more
│   Recent transactions        │
│ </Suspense>                  │
├──────────────────────────────┤
│ <Suspense fallback={skel}>   │  ← Desktop only
│   Charts (budget pace,       │
│   income vs expenses,        │
│   category spending)         │
│ </Suspense>                  │
└──────────────────────────────┘
```

The hero and burn rate data come from the same parallel batch. Payments and transactions are separate Suspense boundaries. Charts (desktop only) are a third boundary.

### Account detail split

Show account info card immediately. Lazy-load balance history chart (heavy Recharts component) inside Suspense.

### Deudas split

Show hero cards (debt total, utilization) immediately. Lazy-load individual debt account cards inside Suspense.

---

## Tier 5: Animation Tuning

### Page transition

**File:** `components/ui/page-transition.tsx`

Reduce from 200ms to 100ms:
```typescript
transition={{ duration: 0.1, ease: "easeOut" }}
```

### Mobile stagger animations

Current: `staggerChildren: 0.04`, item duration `0.2s` (200ms).

For a list of 10 items, total animation time = 0.04 * 9 + 0.2 = 0.56s. That's over half a second before the last item appears.

Reduce to: `staggerChildren: 0.02`, item duration `0.15s` (150ms). Total for 10 items = 0.02 * 9 + 0.15 = 0.33s.

**File:** `components/mobile/motion.tsx`

---

## Principles for RN App

These patterns translate directly to the React Native + SQLite architecture:

1. **Optimistic writes** — write to SQLite immediately, sync to Supabase in background
2. **Never block UI on network** — read from local DB, not remote
3. **Scoped invalidation** — React Query cache keys should be granular, not broadcast
4. **Progressive loading** — show list skeleton while items load, never blank screen
5. **Animation budget** — max 150ms for any transition, prefer `useNativeDriver: true`
6. **Deterministic over smart** — no AI inference, no ML models, no network-dependent logic in the hot path

---

## Success Metrics

After implementation:
- Form submissions: < 50ms perceived latency (optimistic update visible)
- Page navigations: < 300ms to first meaningful content (Suspense boundary)
- Dashboard load: Hero visible in < 200ms, charts in < 500ms
- No `router.refresh()` remaining in codebase
- `revalidatePath` calls reduced from 64+ to ~20
