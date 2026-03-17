# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate perceived latency across all Zeta webapp interactions by replacing blocking refreshes with optimistic updates, scoping cache invalidation, parallelizing queries, and adding progressive loading.

**Architecture:** Five independent tiers, each shippable alone. Tier 1 (optimistic updates) removes `router.refresh()`. Tier 2 scopes `revalidatePath`. Tier 3 parallelizes sequential DB queries. Tier 4 adds Suspense boundaries. Tier 5 tunes animations.

**Tech Stack:** Next.js 15 (App Router), React 19 `useTransition`/`useOptimistic`, Supabase, Framer Motion

**Spec:** `docs/superpowers/specs/2026-03-17-performance-optimization-design.md`

---

## Chunk 1: Tier 5 — Animation Tuning (Quick Win)

### Task 1: Reduce page transition and stagger animation durations

**Files:**
- Modify: `webapp/src/components/ui/page-transition.tsx`
- Modify: `webapp/src/components/mobile/motion.tsx`

- [ ] **Step 1: Reduce page transition from 200ms to 100ms**

In `page-transition.tsx`, change:

```typescript
// Old:
transition={{ duration: 0.2, ease: "easeOut" }}

// New:
transition={{ duration: 0.1, ease: "easeOut" }}
```

Also reduce the initial y offset from 6 to 3 (less vertical jump):

```typescript
// Old:
initial={{ opacity: 0, y: 6 }}

// New:
initial={{ opacity: 0, y: 3 }}
```

- [ ] **Step 2: Reduce mobile stagger animation timing**

In `motion.tsx`, update the variants:

```typescript
// Old:
const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// New:
const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

const listItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.15 } },
};
```

Also update `FadeIn` duration from 0.25 to 0.15:

```typescript
// Old:
transition={{ duration: 0.25, delay }}

// New:
transition={{ duration: 0.15, delay }}
```

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/ui/page-transition.tsx webapp/src/components/mobile/motion.tsx
git commit -m "perf: reduce animation durations — page transition 100ms, stagger 150ms"
```

---

## Chunk 2: Tier 2 — Scoped Revalidation

### Task 2: Scope revalidatePath in transaction actions

**Files:**
- Modify: `webapp/src/actions/transactions.ts`

- [ ] **Step 1: Remove `/dashboard` and `/accounts` from persistTransaction**

At ~line 74-76, change:

```typescript
// Old:
revalidatePath("/transactions");
revalidatePath("/dashboard");
revalidatePath("/accounts");

// New:
revalidatePath("/transactions");
```

- [ ] **Step 2: Check all other revalidation calls in the file**

Search for other `revalidatePath` calls (deleteTransaction, updateTransaction, etc.) and scope each one to only `/transactions`.

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/transactions.ts
git commit -m "perf: scope transaction revalidation to /transactions only"
```

---

### Task 3: Scope revalidatePath in budget actions

**Files:**
- Modify: `webapp/src/actions/budgets.ts`

- [ ] **Step 1: Remove `/dashboard` from upsertBudget and deleteBudget**

At ~line 62-63 and 76-77:

```typescript
// Old:
revalidatePath("/categories");
revalidatePath("/dashboard");

// New:
revalidatePath("/categories");
```

Apply to both `upsertBudget` and `deleteBudget`.

- [ ] **Step 2: Commit**

```bash
git add webapp/src/actions/budgets.ts
git commit -m "perf: scope budget revalidation to /categories only"
```

---

### Task 4: Scope revalidatePath in account actions

**Files:**
- Modify: `webapp/src/actions/accounts.ts`

- [ ] **Step 1: Remove `/dashboard` from all account actions**

Search for all `revalidatePath` in the file. Remove any that revalidate `/dashboard`. Keep only `/accounts`.

- [ ] **Step 2: Commit**

```bash
git add webapp/src/actions/accounts.ts
git commit -m "perf: scope account revalidation to /accounts only"
```

---

### Task 5: Scope revalidatePath in import actions

**Files:**
- Modify: `webapp/src/actions/import-transactions.ts`

- [ ] **Step 1: Reduce from 4 paths to 2**

At ~line 615-618:

```typescript
// Old:
revalidatePath("/transactions");
revalidatePath("/dashboard");
revalidatePath("/accounts");
revalidatePath("/deudas");

// New:
revalidatePath("/transactions");
revalidatePath("/accounts");
```

Keep `/accounts` because import updates account metadata.

- [ ] **Step 2: Commit**

```bash
git add webapp/src/actions/import-transactions.ts
git commit -m "perf: scope import revalidation to /transactions + /accounts"
```

---

### Task 6: Scope revalidatePath in recurring, categorize, profile, and destinatarios actions

**Files:**
- Modify: `webapp/src/actions/recurring-templates.ts`
- Modify: `webapp/src/actions/categorize.ts`
- Modify: `webapp/src/actions/profile.ts`
- Modify: `webapp/src/actions/destinatarios.ts`

- [ ] **Step 1: Recurring templates — reduce from 5 paths to 1**

At ~line 712-716, replace 5 revalidation calls with just:

```typescript
revalidatePath("/recurrentes");
```

Also check all other `revalidatePath` in the file — scope each to just `/recurrentes`.

- [ ] **Step 2: Categorize — scope to /categorizar only**

Remove `/transactions` from categorize actions. Keep only:

```typescript
revalidatePath("/categorizar");
```

- [ ] **Step 3: Profile — scope to /settings only**

Replace `/dashboard` + `/` layout revalidation with:

```typescript
revalidatePath("/settings");
```

- [ ] **Step 4: Destinatarios — already scoped, verify**

Check all revalidations are only `/destinatarios`. Fix any that revalidate other paths.

- [ ] **Step 5: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add webapp/src/actions/recurring-templates.ts webapp/src/actions/categorize.ts webapp/src/actions/profile.ts webapp/src/actions/destinatarios.ts
git commit -m "perf: scope revalidation in recurring, categorize, profile, destinatarios"
```

---

## Chunk 3: Tier 1 — Optimistic Updates

### Task 7: Remove router.refresh() from budget-category-grid

**Files:**
- Modify: `webapp/src/components/budget/budget-category-grid.tsx`

- [ ] **Step 1: Add local state for categories**

Add a `localCategories` state initialized from props, and a callback to update it optimistically:

```typescript
const [localCategories, setLocalCategories] = useState(categories);

// Sync when server data changes (new render from parent)
useEffect(() => { setLocalCategories(categories); }, [categories]);
```

- [ ] **Step 2: Replace handleSave with optimistic pattern**

```typescript
async function handleSave() {
  if (!editingId || !amount) return;
  const budgetAmount = parseFloat(amount);

  // Optimistic update
  setLocalCategories(prev => prev.map(c =>
    c.id === editingId ? { ...c, budget: budgetAmount, percentUsed: c.spent / budgetAmount * 100 } : c
  ));
  setEditingId(null);
  setAmount("");

  // Fire-and-forget
  const formData = new FormData();
  formData.append("category_id", editingId);
  formData.append("amount", amount);
  formData.append("period", "monthly");

  const [budgetResult] = await Promise.all([
    upsertBudget({ success: false, error: "" }, formData),
    updateCategoryExpenseType(editingId, expenseType),
  ]);

  if (!budgetResult.success) {
    // Revert
    setLocalCategories(categories);
    setSaveError(budgetResult.error ?? "Error al guardar");
  }
}
```

- [ ] **Step 3: Remove `useRouter` and `useTransition` imports**

Remove `router.refresh()` and `startTransition`. Remove the `useRouter` import if no longer used.

- [ ] **Step 4: Render from `localCategories` instead of `categories` prop**

Update the JSX to use `localCategories` in the `.map()`.

- [ ] **Step 5: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 6: Commit**

```bash
git add webapp/src/components/budget/budget-category-grid.tsx
git commit -m "perf: optimistic budget save — no router.refresh()"
```

---

### Task 8: Remove router.refresh() from month-planner

**Files:**
- Modify: `webapp/src/components/budget/month-planner.tsx`

- [ ] **Step 1: Replace handleSaveAll with optimistic close**

```typescript
async function handleSaveAll() {
  // Optimistic: close the planner immediately
  setOpen(false);

  // Fire-and-forget saves
  const entries = Object.entries(amounts).filter(([, v]) => v && parseFloat(v) > 0);
  const results = await Promise.all(
    entries.map(([catId, amt]) => {
      const fd = new FormData();
      fd.append("category_id", catId);
      fd.append("amount", amt);
      fd.append("period", "monthly");
      return upsertBudget({ success: false, error: "" }, fd);
    })
  );

  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    toast.error(`${failures.length} presupuestos no se guardaron`);
  }
}
```

- [ ] **Step 2: Remove useRouter, useTransition, startTransition**

- [ ] **Step 3: Add toast import**

```typescript
import { toast } from "sonner";
```

- [ ] **Step 4: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/budget/month-planner.tsx
git commit -m "perf: optimistic month planner save — no router.refresh()"
```

---

### Task 9: Remove router.refresh() from category-manage-list

**Files:**
- Modify: `webapp/src/components/budget/category-manage-list.tsx`

- [ ] **Step 1: Add local state for categories**

```typescript
const [localCategories, setLocalCategories] = useState(categories);
useEffect(() => { setLocalCategories(categories); }, [categories]);
```

- [ ] **Step 2: Optimistic handleAddSubcategory**

After server returns success, append to local tree with the real data. Before server returns, close the add form immediately:

```typescript
if (result.success) {
  setAddingToParent(null);
  setNewSubName("");
  // Server action already called revalidatePath — data refreshes on next nav
}
```

Remove `startTransition(() => router.refresh())`.

- [ ] **Step 3: Optimistic handleDeleteSubcategory**

```typescript
async function handleDeleteSubcategory(id: string) {
  // Optimistic removal
  setLocalCategories(prev => prev.filter(c => c.id !== id));

  const result = await deleteCategory(id);
  if (!result.success) {
    setLocalCategories(categories); // revert
    toast.error("Error al eliminar");
  }
}
```

- [ ] **Step 4: Optimistic handleToggleActive**

```typescript
async function handleToggleActive(id: string, currentlyActive: boolean) {
  // Optimistic toggle
  setLocalCategories(prev => prev.map(c =>
    c.id === id ? { ...c, is_active: !currentlyActive } : c
  ));

  const result = await toggleCategoryActive(id, !currentlyActive);
  if (!result.success) {
    setLocalCategories(categories); // revert
  }
}
```

- [ ] **Step 5: Remove useRouter, remove all startTransition(router.refresh()) calls**

- [ ] **Step 6: Render from localCategories**

- [ ] **Step 7: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 8: Commit**

```bash
git add webapp/src/components/budget/category-manage-list.tsx
git commit -m "perf: optimistic category management — no router.refresh()"
```

---

### Task 10: Remove router.refresh() from mobile-sheet-provider

**Files:**
- Modify: `webapp/src/components/mobile/mobile-sheet-provider.tsx`

- [ ] **Step 1: Replace router.refresh() with toast confirmation**

Change the `handleSuccess` callback to close drawer + show toast, no refresh:

```typescript
import { toast } from "sonner";

const handleSuccess = useCallback(() => {
  setActiveAction(null);
  toast.success("Guardado");
}, []);
```

- [ ] **Step 2: Remove `useRouter` import**

Remove `import { useRouter } from "next/navigation"` and the `router` variable.

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/mobile-sheet-provider.tsx
git commit -m "perf: FAB success shows toast instead of router.refresh()"
```

---

### Task 11: Remove router.refresh() from destinatarios components

**Files:**
- Modify: `webapp/src/components/destinatarios/destinatario-suggestions-tab.tsx`
- Modify: `webapp/src/components/destinatarios/merge-dialog.tsx`
- Modify: `webapp/src/components/import/step-destinatarios.tsx`

- [ ] **Step 1: Read each file, find router.refresh() calls**

For each file, apply the same pattern:
- Remove `router.refresh()`
- Either use local state update or rely on `revalidatePath` from server action + next navigation
- Show toast on success

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/destinatarios/ webapp/src/components/import/step-destinatarios.tsx
git commit -m "perf: optimistic updates in destinatarios + import wizard"
```

---

### Task 12: Verify zero router.refresh() remaining

- [ ] **Step 1: Search for any remaining router.refresh()**

Run: `grep -r "router.refresh" webapp/src/ --include="*.tsx" --include="*.ts"`

Expected: **0 results** (or only in test files)

- [ ] **Step 2: If any remain, apply the same optimistic pattern**

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit if changes were needed**

---

## Chunk 4: Tier 3 — Parallel Queries

### Task 13: Parallelize dashboard currency fallback

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Replace sequential currency fallback with parallel fetch**

At ~lines 75-113, replace the currency waterfall with a single parallel batch. Fetch preferred currency + first account currency together:

```typescript
const [preferredCurrency, { data: recentTransactions }, { data: accounts }, { data: firstAccount }] = await Promise.all([
  getPreferredCurrency(),
  executeVisibleTransactionQuery(() =>
    supabase.from("transactions").select("*, categories!category_id(name_es, name)")
      .eq("is_excluded", false)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5)
  ),
  supabase.from("accounts").select("id").eq("is_active", true).limit(1),
  supabase.from("accounts").select("currency_code").eq("user_id", user.id).eq("is_active", true).order("created_at").limit(1).single(),
]);

let currency = preferredCurrency;
// Check if preferred currency has active accounts
const { data: currencyCheck } = await supabase
  .from("accounts").select("id").eq("user_id", user.id).eq("is_active", true).eq("currency_code", currency).limit(1);

if (!currencyCheck?.length && firstAccount) {
  currency = firstAccount.currency_code as CurrencyCode;
}
```

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "perf: parallelize dashboard currency fallback query"
```

---

### Task 14: Parallelize deudas exchange rate and account detail snapshots

**Files:**
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`
- Modify: `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`

- [ ] **Step 1: Deudas — move exchange rate into initial Promise.all**

Read the file, find the conditional `await getExchangeRate(...)` that runs after the main batch. Move it into the `Promise.all` so it runs in parallel (the result is cheap — cached 24h).

- [ ] **Step 2: Account detail — fetch account and snapshots in parallel**

Read the file, find where snapshots are conditionally fetched after account loads. Fetch both in `Promise.all`. The snapshot query returns empty for non-credit accounts (cheap).

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/deudas/page.tsx webapp/src/app/\(dashboard\)/accounts/\[id\]/page.tsx
git commit -m "perf: parallelize exchange rate + snapshot fetches"
```

---

## Chunk 5: Tier 4 — Suspense Boundaries

### Task 15: Add Suspense boundaries to dashboard

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Split dashboard into async sub-components**

Extract the chart section into a separate async component:

```typescript
async function DashboardCharts({ month, currency }: { month: string | undefined; currency: CurrencyCode }) {
  const [budgetPaceData, cashflowData, categoryData] = await Promise.all([
    getDailyBudgetPace(month, currency),
    getMonthlyCashflow(month, currency),
    getCategorySpending(month, currency),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BudgetPaceChart ... />
      <IncomeVsExpensesChart ... />
      <DashboardBudgetBar ... />
    </div>
  );
}
```

- [ ] **Step 2: Wrap charts in Suspense with skeleton fallback**

```tsx
<Suspense fallback={<div className="grid gap-6 lg:grid-cols-2"><ChartSkeleton /><ChartSkeleton /><ChartSkeleton /></div>}>
  <DashboardCharts month={month} currency={currency} />
</Suspense>
```

Create a simple `ChartSkeleton` component (a rounded div with animate-pulse).

- [ ] **Step 3: Keep hero + burn rate + payments outside Suspense**

These should render immediately from the main page `Promise.all`. Only the heavy chart components go in Suspense.

- [ ] **Step 4: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "perf: Suspense boundaries on dashboard — hero instant, charts lazy"
```

---

### Task 16: Add Suspense to account detail (balance chart)

**Files:**
- Modify: `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`

- [ ] **Step 1: Wrap BalanceHistoryChart in Suspense**

The account info card should render immediately. The heavy Recharts balance history chart loads inside Suspense:

```tsx
<Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
  <BalanceHistorySection accountId={account.id} />
</Suspense>
```

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/accounts/\[id\]/page.tsx
git commit -m "perf: Suspense on account detail — info instant, chart lazy"
```

---

### Task 17: Final verification gate

- [ ] **Step 1: Full build**

Run: `cd webapp && pnpm build`

Expected: Clean build

- [ ] **Step 2: Verify zero router.refresh() remaining**

Run: `grep -rn "router\.refresh" webapp/src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".spec."`

Expected: 0 results

- [ ] **Step 3: Count revalidatePath calls**

Run: `grep -rn "revalidatePath" webapp/src/actions/ --include="*.ts" | wc -l`

Expected: Approximately 20 or fewer (down from 64+)

- [ ] **Step 4: Run E2E tests**

Run: `TEST_EMAIL="giraldo.0302@gmail.com" TEST_PASSWORD="cristian19" npx playwright test --project=setup --project=mobile e2e/mobile-redesign.spec.ts`

Expected: All 38 tests pass

- [ ] **Step 5: Commit and push**

```bash
git push
```
