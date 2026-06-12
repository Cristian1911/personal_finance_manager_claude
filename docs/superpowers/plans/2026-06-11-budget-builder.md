# Budget Builder ("Armar presupuesto") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compose category budgets bottom-up from subcategory lines ("Hogar = Arriendo + Servicios + Mercado…"), seeded from recurrentes and 3-month averages, via a focus-mode builder route plus a per-group composer sheet.

**Architecture:** No new tables — a line is a `budgets` row on a subcategory; the parent's own row renders as the "Base" line. One invariant everywhere: **group total = base + Σ child rows**, computed by a pure, unit-tested rollup helper wired into `getCategoriesWithBudgetData`. A single `applyBudgetComposition` action persists diffs. Builder (`/presupuesto/armar`) and composer sheet share one `BudgetGroupLines` component.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase, Tailwind v4 + Zeta tokens, vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-budget-builder-design.md` (incl. Addendum)

**Conventions for every task:** Spanish UI strings. Buttons only via constants from `@/lib/constants/styles`. Mutations use `updateTag` (never `revalidateTag`). Defense-in-depth `.eq("user_id", user.id)` on every query. Run builds from `webapp/`: `pnpm build`. Tests: `pnpm vitest run <path>` from `webapp/`.

---

### Task 1: Pure rollup + diff helpers (TDD)

**Files:**
- Create: `webapp/src/lib/utils/budget-rollup.ts`
- Test: `webapp/src/lib/utils/__tests__/budget-rollup.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// webapp/src/lib/utils/__tests__/budget-rollup.test.ts
import { describe, expect, it } from "vitest";
import { rollupGroup, computeCompositionDiff } from "../budget-rollup";

describe("rollupGroup", () => {
  it("parent-only group (today's simple budget)", () => {
    const r = rollupGroup({ baseBudget: 700_000, childBudgets: {}, parentSpent: 350_000, childrenSpent: {} });
    expect(r).toEqual({ totalBudget: 700_000, totalSpent: 350_000, percentUsed: 50 });
  });

  it("subs-only group (composed without Base)", () => {
    const r = rollupGroup({
      baseBudget: null,
      childBudgets: { a: 220_000, b: 450_000 },
      parentSpent: 30_000, // tx categorized directly at parent still counts
      childrenSpent: { a: 110_000 },
    });
    expect(r.totalBudget).toBe(670_000);
    expect(r.totalSpent).toBe(140_000);
    expect(r.percentUsed).toBeCloseTo((140_000 / 670_000) * 100);
  });

  it("mixed: Base + lines", () => {
    const r = rollupGroup({ baseBudget: 100_000, childBudgets: { a: 50_000 }, parentSpent: 0, childrenSpent: {} });
    expect(r.totalBudget).toBe(150_000);
  });

  it("no budget rows at all → totalBudget null, percent 0", () => {
    const r = rollupGroup({ baseBudget: null, childBudgets: {}, parentSpent: 90_000, childrenSpent: { a: 10_000 } });
    expect(r.totalBudget).toBeNull();
    expect(r.totalSpent).toBe(100_000);
    expect(r.percentUsed).toBe(0);
  });

  it("zero total budget → percent 0 (no division by zero)", () => {
    const r = rollupGroup({ baseBudget: 0, childBudgets: {}, parentSpent: 50_000, childrenSpent: {} });
    expect(r.totalBudget).toBe(0);
    expect(r.percentUsed).toBe(0);
  });
});

describe("computeCompositionDiff", () => {
  it("new and changed amounts become upserts", () => {
    const d = computeCompositionDiff({ a: 100 }, { a: 150, b: 200 });
    expect(d.upserts).toEqual([
      { category_id: "a", amount: 150 },
      { category_id: "b", amount: 200 },
    ]);
    expect(d.deletes).toEqual([]);
  });

  it("unchanged amounts produce no operations", () => {
    const d = computeCompositionDiff({ a: 100 }, { a: 100 });
    expect(d.upserts).toEqual([]);
    expect(d.deletes).toEqual([]);
  });

  it("cleared lines (0 or removed) become deletes", () => {
    const d = computeCompositionDiff({ a: 100, b: 50 }, { a: 0 });
    expect(d.upserts).toEqual([]);
    expect(d.deletes.sort()).toEqual(["a", "b"]);
  });

  it("a line that never existed and stays 0 produces nothing", () => {
    const d = computeCompositionDiff({}, { a: 0 });
    expect(d.upserts).toEqual([]);
    expect(d.deletes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/budget-rollup.test.ts`
Expected: FAIL — `Cannot find module '../budget-rollup'`

- [ ] **Step 3: Implement the helpers**

```ts
// webapp/src/lib/utils/budget-rollup.ts

/**
 * Group-budget invariant: total = parent's own budget row ("Base")
 * + Σ subcategory budget rows. A group with no rows at all has no budget (null).
 */
export interface GroupRollup {
  totalBudget: number | null;
  totalSpent: number;
  percentUsed: number;
}

export function rollupGroup(input: {
  baseBudget: number | null;
  childBudgets: Record<string, number>;
  parentSpent: number;
  childrenSpent: Record<string, number>;
}): GroupRollup {
  const childIds = Object.keys(input.childBudgets);
  const childSum = childIds.reduce((s, id) => s + input.childBudgets[id], 0);
  const hasAnyRow = input.baseBudget !== null || childIds.length > 0;
  const totalBudget = hasAnyRow ? (input.baseBudget ?? 0) + childSum : null;
  const totalSpent =
    input.parentSpent + Object.values(input.childrenSpent).reduce((s, v) => s + v, 0);
  const percentUsed = totalBudget && totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  return { totalBudget, totalSpent, percentUsed };
}

export interface CompositionDiff {
  upserts: { category_id: string; amount: number }[];
  deletes: string[];
}

/** Both maps are category_id → amount; the parent's id keys its Base line. */
export function computeCompositionDiff(
  initial: Record<string, number>,
  draft: Record<string, number>
): CompositionDiff {
  const upserts: CompositionDiff["upserts"] = [];
  for (const [category_id, amount] of Object.entries(draft)) {
    if (amount > 0 && initial[category_id] !== amount) upserts.push({ category_id, amount });
  }
  const deletes = Object.keys(initial).filter(
    (id) => initial[id] > 0 && !(draft[id] > 0)
  );
  return { upserts, deletes };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/budget-rollup.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/utils/budget-rollup.ts webapp/src/lib/utils/__tests__/budget-rollup.test.ts
git commit -m "feat(presupuesto): rollup + composition-diff helpers para builder"
```

---

### Task 2: Rollup wired into `getCategoriesWithBudgetData` + type extensions

**Files:**
- Modify: `webapp/src/types/domain.ts` (CategoryBudgetData, ~line 147)
- Modify: `webapp/src/actions/categories.ts` (`getCategoriesWithBudgetDataCached` result mapping, ~lines 348-388)
- Modify: `webapp/src/components/budget/month-planner.tsx:26` (prefill Base, not combined)
- Modify: `webapp/src/components/budget/budget-category-grid.tsx:37` (same)

- [ ] **Step 1: Extend the type**

In `webapp/src/types/domain.ts`, replace the `CategoryBudgetData` type with:

```ts
export type CategoryBudgetData = {
  id: string;
  name: string;
  name_es: string | null;
  slug: string;
  icon: string;
  color: string;
  is_essential: boolean;
  is_active: boolean;
  direction: TransactionDirection;
  expense_type: ExpenseType | null;
  /** Combined group budget: baseBudget + Σ childBudgets. Null when no rows exist. */
  budget: number | null;
  /** The parent category's OWN budget row ("Base" line). Null when absent. */
  baseBudget: number | null;
  spent: number;
  committedRecurring: number;
  percentUsed: number;
  average3m: number;
  children: CategoryWithChildren[];
  /** Spending per child category this month: childId → amount */
  childrenSpent: Record<string, number>;
  /** Budget rows on child categories ("lines"): childId → amount */
  childBudgets: Record<string, number>;
  /** 3-month average spend per child: childId → amount */
  childAvg3m: Record<string, number>;
  /** Monthly recurring committed per child: childId → amount */
  childRecurring: Record<string, number>;
};
```

- [ ] **Step 2: Enrich the mapping in `actions/categories.ts`**

Inside `getCategoriesWithBudgetDataCached`, add the import at the top of the file:

```ts
import { rollupGroup } from "@/lib/utils/budget-rollup";
```

Replace the `result` mapping block (the `categories.map((cat) => {...})` starting near line 348) with:

```ts
  const result: CategoryBudgetData[] = categories.map((cat) => {
    const baseBudget = budgetMap.get(cat.id) ?? null;
    const spent = spentMap.get(cat.id) ?? 0;
    const avg3mTotal = avgTotalMap.get(cat.id) ?? 0;

    const children = childrenByParent.get(cat.id) ?? [];
    const childrenSpent: Record<string, number> = {};
    const childBudgets: Record<string, number> = {};
    const childAvg3m: Record<string, number> = {};
    const childRecurring: Record<string, number> = {};
    let childRecurringTotal = 0;
    let childAvg3mTotal = 0;

    for (const child of children) {
      const childSpent = spentMap.get(child.id) ?? 0;
      if (childSpent > 0) childrenSpent[child.id] = childSpent;

      const childBudget = budgetMap.get(child.id) ?? 0;
      if (childBudget > 0) childBudgets[child.id] = childBudget;

      const childAvgTotal = avgTotalMap.get(child.id) ?? 0;
      if (childAvgTotal > 0) {
        childAvg3m[child.id] = childAvgTotal / 3;
        childAvg3mTotal += childAvgTotal;
      }

      const childRec = recurringMap.get(child.id) ?? 0;
      if (childRec > 0) {
        childRecurring[child.id] = childRec;
        childRecurringTotal += childRec;
      }
    }

    const rollup = rollupGroup({
      baseBudget,
      childBudgets,
      parentSpent: spent,
      childrenSpent,
    });

    return {
      id: cat.id,
      name: cat.name,
      name_es: cat.name_es,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      is_essential: cat.is_essential ?? false,
      is_active: cat.is_active ?? true,
      direction: cat.direction as TransactionDirection,
      expense_type: (cat.expense_type as "fixed" | "variable") ?? null,
      budget: rollup.totalBudget,
      baseBudget,
      spent: rollup.totalSpent,
      committedRecurring: (recurringMap.get(cat.id) ?? 0) + childRecurringTotal,
      percentUsed: rollup.percentUsed,
      average3m: (avg3mTotal + childAvg3mTotal) / 3,
      children,
      childrenSpent,
      childBudgets,
      childAvg3m,
      childRecurring,
    };
  });
```

Note: `average3m` previously ignored child spend too (same bug family as budgets); including child averages keeps "Usar promedio" meaningful for composed groups. The old block computed `childSpentTotal` inline — that logic is now inside `rollupGroup`.

- [ ] **Step 3: Fix the two consumers that write the parent row from a prefill**

With `budget` now combined, prefilling an editor from it would save the combined total INTO the Base row (double count). Both must prefill from `baseBudget`:

`webapp/src/components/budget/month-planner.tsx` — in `handleOpen()` replace:

```ts
      if (cat.budget && cat.budget > 0) {
        initial[cat.id] = cat.budget.toString();
      }
```

with:

```ts
      if (cat.baseBudget && cat.baseBudget > 0) {
        initial[cat.id] = cat.baseBudget.toString();
      }
```

`webapp/src/components/budget/budget-category-grid.tsx` — in `handleSetBudget()` replace:

```ts
    setAmount(cat?.budget ? cat.budget.toString() : "");
```

with:

```ts
    setAmount(cat?.baseBudget ? cat.baseBudget.toString() : "");
```

Also in `handleSave()`'s optimistic update in the same file, the recompute must keep the combined semantics. Replace:

```ts
      setLocalCategories(prev => prev.map(c =>
        c.id === editingId ? { ...c, budget: budgetAmount, percentUsed: budgetAmount > 0 ? c.spent / budgetAmount * 100 : 0 } : c
      ));
```

with:

```ts
      setLocalCategories(prev => prev.map(c => {
        if (c.id !== editingId) return c;
        const childSum = Object.values(c.childBudgets).reduce((s, v) => s + v, 0);
        const combined = budgetAmount + childSum;
        return {
          ...c,
          baseBudget: budgetAmount,
          budget: combined,
          percentUsed: combined > 0 ? (c.spent / combined) * 100 : 0,
        };
      }));
```

And in `handleDelete()` in the same file, replace the optimistic update:

```ts
      setLocalCategories(prev => prev.map(c =>
        c.id === targetId ? { ...c, budget: null, percentUsed: 0 } : c
      ));
```

with:

```ts
      setLocalCategories(prev => prev.map(c => {
        if (c.id !== targetId) return c;
        const childSum = Object.values(c.childBudgets).reduce((s, v) => s + v, 0);
        return {
          ...c,
          baseBudget: null,
          budget: childSum > 0 ? childSum : null,
          percentUsed: childSum > 0 ? (c.spent / childSum) * 100 : 0,
        };
      }));
```

(Note: `deleteBudgetForCategory` deletes only the parent's monthly row by `category_id`, so child lines genuinely survive a Base delete — the optimistic math matches the server.)

- [ ] **Step 4: Verify with build + tests**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/budget-rollup.test.ts && pnpm build`
Expected: tests PASS, build clean. (Type errors here mean a consumer constructs `CategoryBudgetData` literally — fix by adding the four new fields with empty defaults `{}` / `null`.)

- [ ] **Step 5: Commit**

```bash
git add webapp/src/types/domain.ts webapp/src/actions/categories.ts webapp/src/components/budget/month-planner.tsx webapp/src/components/budget/budget-category-grid.tsx
git commit -m "feat(presupuesto): rollup base+líneas en getCategoriesWithBudgetData"
```

---

### Task 3: `getBudgetSummary` counts parent spend of composed groups

**Files:**
- Modify: `webapp/src/actions/budgets.ts` (`getBudgetSummaryCached`, ~lines 21-65)

- [ ] **Step 1: Join parent ids and widen the spent filter**

In `getBudgetSummaryCached`, replace the budgets query:

```ts
    const { data: budgets } = await supabase
        .from("budgets")
        .select("amount, category_id")
        .eq("user_id", userId)
        .eq("is_demo", isDemo);
```

with:

```ts
    const { data: budgets } = await supabase
        .from("budgets")
        .select("amount, category_id, category:categories(parent_id)")
        .eq("user_id", userId)
        .eq("is_demo", isDemo);
```

and replace:

```ts
    const totalTarget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const budgetedCategoryIds = budgets.map((b) => b.category_id);
```

with:

```ts
    const totalTarget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    // Include parents of budgeted subcategories so spending categorized directly
    // at the parent still counts when a group is composed without a Base row.
    const budgetedCategoryIds = [
        ...new Set(
            budgets.flatMap((b) => {
                const parentId = (b.category as { parent_id: string | null } | null)?.parent_id;
                return parentId ? [b.category_id, parentId] : [b.category_id];
            })
        ),
    ];
```

- [ ] **Step 2: Build**

Run: `cd webapp && pnpm build`
Expected: clean. (If TypeScript complains about the join shape, type the row as `{ amount: number; category_id: string; category: { parent_id: string | null } | null }`.)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/budgets.ts
git commit -m "fix(presupuesto): summary cuenta gasto del padre en grupos compuestos"
```

---

### Task 4: `applyBudgetComposition` action + sandbox child-cleanup

**Files:**
- Modify: `webapp/src/actions/budgets.ts` (new action at the end)
- Modify: `webapp/src/actions/budget-scenarios.ts` (`applyBudgetScenario`, the upsert section ~lines 145-172)

- [ ] **Step 1: Add the action**

Append to `webapp/src/actions/budgets.ts`:

```ts
export interface BudgetCompositionInput {
    upserts: { category_id: string; amount: number }[];
    deletes: string[];
}

/**
 * Persists a builder/composer diff: batch-upserts changed lines (incl. the
 * parent's "Base" row) and batch-deletes cleared ones. Sequential, not
 * transactional — same atomicity level as applyBudgetScenario; the client
 * keeps its draft on failure.
 */
export async function applyBudgetComposition(
    input: BudgetCompositionInput
): Promise<ActionResult<null>> {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return { success: false, error: "No autenticado" };

    const ids = [...input.upserts.map((u) => u.category_id), ...input.deletes];
    if (ids.some((id) => !UUID_RE.test(id))) {
        return { success: false, error: "Categoría inválida" };
    }
    if (input.upserts.some((u) => !Number.isFinite(u.amount) || u.amount <= 0)) {
        return { success: false, error: "Monto inválido" };
    }
    if (ids.length === 0) return { success: true, data: null };

    if (input.upserts.length > 0) {
        const rows = input.upserts.map((u) => ({
            user_id: user.id,
            category_id: u.category_id,
            amount: u.amount,
            period: "monthly" as const,
            updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
            .from("budgets")
            .upsert(rows, { onConflict: "user_id, category_id, period" });
        if (error) return { success: false, error: error.message };
    }

    if (input.deletes.length > 0) {
        const { error } = await supabase
            .from("budgets")
            .delete()
            .eq("user_id", user.id)
            .eq("period", "monthly")
            .in("category_id", input.deletes);
        if (error) return { success: false, error: error.message };
    }

    updateTag("budgets");
    updateTag("dashboard:budgets");
    updateTag("attention");
    return { success: true, data: null };
}
```

- [ ] **Step 2: Sandbox apply cleans child lines (correctness with rollup)**

The sandbox operates at group level. After this feature, "Aplicar al presupuesto" writing the parent row of a composed group would yield `total = scenario amount + surviving child lines` — inflated. Rule: **scenario wins; applying a group amount deletes that group's child lines** so the result equals what the user saw.

In `webapp/src/actions/budget-scenarios.ts`, inside `applyBudgetScenario` AFTER the existing upsert/delete of scenario lines succeeds and BEFORE the `updateTag` calls, add:

```ts
  // Scenario amounts are group-level truth: drop child lines of every touched
  // group so rollup (base + Σ children) equals exactly the applied amount.
  const touchedParentIds = [
    ...new Set([...upsertCategoryIds, ...deleteCategoryIds]),
  ];
  if (touchedParentIds.length > 0) {
    const { data: childRows, error: childErr } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", user.id)
      .in("parent_id", touchedParentIds);
    if (childErr) return { success: false, error: childErr.message };
    const childIds = (childRows ?? []).map((c) => c.id);
    if (childIds.length > 0) {
      const { error: delErr } = await supabase
        .from("budgets")
        .delete()
        .eq("user_id", user.id)
        .eq("period", "monthly")
        .in("category_id", childIds);
      if (delErr) return { success: false, error: delErr.message };
    }
  }
```

**Adaptation note:** `upsertCategoryIds` / `deleteCategoryIds` refer to whatever local variables hold the applied/deleted category ids in the existing function (read the function first; the upserts come from scenario lines > 0 and deletes from lines cut to 0, ~lines 145-172). Also: system categories have `user_id IS NULL` — if the children query returns nothing for system subs, use `.or(\`user_id.eq.${user.id},user_id.is.null\`)` instead of `.eq("user_id", user.id)` **for the categories lookup only** (the budgets delete keeps the strict user filter).

- [ ] **Step 3: Build**

Run: `cd webapp && pnpm build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/budgets.ts webapp/src/actions/budget-scenarios.ts
git commit -m "feat(presupuesto): applyBudgetComposition + limpieza de líneas al aplicar escenario"
```

---

### Task 5: Shared `BudgetGroupLines` component

**Files:**
- Create: `webapp/src/components/budget/budget-group-lines.tsx`

One component renders a group's line list in both surfaces. It is fully controlled: the owner holds the draft (`Record<categoryId, string>`, where the **parent's own id keys the Base line**).

- [ ] **Step 1: Create the component**

```tsx
// webapp/src/components/budget/budget-group-lines.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface BudgetGroupLinesProps {
  group: CategoryBudgetData;
  currency: CurrencyCode;
  /** category_id → amount string. The group's own id keys the "Base" line. */
  draft: Record<string, string>;
  onChange: (categoryId: string, amount: string) => void;
  /** Adds a line to the draft (chip tap / picker), prefilled by the caller. */
  onAddLine: (categoryId: string, prefill: string) => void;
  /** Optional inline creation of a subcategory; resolves to the new id. */
  onCreateSub?: (name: string) => Promise<string | null>;
  /** Composer mode: show real spend next to each line. */
  showSpend?: boolean;
}

export function BudgetGroupLines({
  group,
  currency,
  draft,
  onChange,
  onAddLine,
  onCreateSub,
  showSpend = false,
}: BudgetGroupLinesProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const baseValue = draft[group.id] ?? "";
  const lineChildren = group.children.filter((c) => draft[c.id] !== undefined);
  const suggested = group.children.filter(
    (c) =>
      draft[c.id] === undefined &&
      ((group.childRecurring[c.id] ?? 0) > 0 || (group.childAvg3m[c.id] ?? 0) > 0)
  );
  const pickable = group.children.filter(
    (c) => draft[c.id] === undefined && !suggested.includes(c)
  );

  function suggestionAmount(childId: string): number {
    // Recurring amount is exact; fall back to rounded 3m average.
    const rec = group.childRecurring[childId] ?? 0;
    if (rec > 0) return Math.round(rec);
    return Math.round(group.childAvg3m[childId] ?? 0);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !onCreateSub || busy) return;
    setBusy(true);
    try {
      const id = await onCreateSub(name);
      if (id) {
        onAddLine(id, "");
        setNewName("");
        setCreating(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <LineRow
        label="Base (general)"
        muted={Number(baseValue || 0) === 0 && lineChildren.length > 0}
        spend={showSpend ? (group.spent - Object.values(group.childrenSpent).reduce((s, v) => s + v, 0)) : null}
        currency={currency}
        value={baseValue}
        onChange={(v) => onChange(group.id, v)}
      />

      {lineChildren.map((child) => (
        <LineRow
          key={child.id}
          label={child.name_es ?? child.name}
          badge={
            (group.childRecurring[child.id] ?? 0) > 0
              ? "recurrente"
              : (group.childAvg3m[child.id] ?? 0) > 0
                ? "prom 3m"
                : undefined
          }
          spend={showSpend ? (group.childrenSpent[child.id] ?? 0) : null}
          currency={currency}
          value={draft[child.id] ?? ""}
          onChange={(v) => onChange(child.id, v)}
        />
      ))}

      {(suggested.length > 0 || pickable.length > 0 || onCreateSub) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {suggested.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => onAddLine(child.id, String(suggestionAmount(child.id)))}
              className="rounded-full border border-dashed border-z-brass/40 bg-z-brass/8 px-2.5 py-1 text-[10px] font-medium text-z-brass transition-colors active:bg-z-brass/14"
            >
              + {child.name_es ?? child.name} ·{" "}
              {(group.childRecurring[child.id] ?? 0) > 0 ? "recurrente " : "prom "}
              {formatCurrency(suggestionAmount(child.id), currency)}
            </button>
          ))}

          {pickable.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => onAddLine(child.id, "")}
              className="rounded-full border border-dashed border-white/15 px-2.5 py-1 text-[10px] text-z-sage-light transition-colors active:bg-white/5"
            >
              + {child.name_es ?? child.name}
            </button>
          ))}

          {onCreateSub && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-1 text-[10px] text-z-sage-dark transition-colors active:bg-white/5"
            >
              <Plus className="size-2.5" strokeWidth={2} /> Otra línea…
            </button>
          )}
        </div>
      )}

      {creating && (
        <div className="flex items-center gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre — ej. Netflix"
            className="h-9 flex-1 rounded-md border border-white/6 bg-black/10 px-3 text-sm outline-none placeholder:text-z-sage-dark focus-visible:border-z-brass/35"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !newName.trim()}
            className="h-9 shrink-0 rounded-md border border-z-brass/20 bg-z-brass/8 px-3 text-xs font-semibold text-z-brass disabled:opacity-50"
          >
            {busy ? "Creando..." : "Crear línea"}
          </button>
        </div>
      )}
    </div>
  );
}

function LineRow({
  label,
  badge,
  muted,
  spend,
  currency,
  value,
  onChange,
}: {
  label: string;
  badge?: string;
  muted?: boolean;
  spend: number | null;
  currency: CurrencyCode;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-black/10 px-2.5 py-1.5",
        muted && "opacity-60"
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[13px] font-medium">{label}</span>
        {badge && (
          <span className="shrink-0 rounded-full border border-z-brass/30 bg-z-brass/12 px-1.5 text-[8.5px] font-semibold text-z-brass">
            {badge}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {spend !== null && spend > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {formatCurrency(spend, currency)} /
          </span>
        )}
        <CurrencyInput
          className="w-28 text-right"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd webapp && pnpm build`
Expected: clean (component not yet consumed — verifies types only).

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/budget/budget-group-lines.tsx
git commit -m "feat(presupuesto): componente compartido BudgetGroupLines"
```

---

### Task 6: Builder route `/presupuesto/armar`

**Files:**
- Create: `webapp/src/app/(dashboard)/presupuesto/armar/page.tsx`
- Create: `webapp/src/components/budget/budget-builder.tsx`
- Modify: `webapp/src/lib/constants/mobile-nav.ts:74-78` (focus mode)
- Modify: `webapp/src/components/mobile/v2/mobile-header.tsx` (add `onBackClick` to sub variant)
- Modify: `webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx` (entry buttons)

- [ ] **Step 1: Focus mode registration**

In `webapp/src/lib/constants/mobile-nav.ts` replace:

```ts
const FOCUS_MODE_PATHS: ReadonlyArray<string> = [
  "/transactions/new",
  "/recurrentes/new",
  "/deudas/planificador",
] as const;
```

with:

```ts
const FOCUS_MODE_PATHS: ReadonlyArray<string> = [
  "/transactions/new",
  "/recurrentes/new",
  "/deudas/planificador",
  "/presupuesto/armar",
] as const;
```

- [ ] **Step 2: `MobileHeader` sub variant gains `onBackClick`**

The dirty-draft guard needs to intercept the back tap; today the sub header only renders a `Link` (or history back). In `webapp/src/components/mobile/v2/mobile-header.tsx`, add to `SubHeaderProps`:

```ts
  /**
   * Intercepts the back affordance (e.g. dirty-draft confirm). When provided,
   * renders a button instead of the Link/history back.
   */
  onBackClick?: () => void;
```

and in the sub-variant render, replace the back affordance block:

```tsx
            {props.backHref ? (
              <Link
                href={props.backHref}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
                aria-label={label}
              >
                <Icon className="size-4" />
              </Link>
            ) : (
              <MobileBackButton />
            )}
```

with:

```tsx
            {props.onBackClick ? (
              <button
                type="button"
                onClick={props.onBackClick}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
                aria-label={label}
              >
                <Icon className="size-4" />
              </button>
            ) : props.backHref ? (
              <Link
                href={props.backHref}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
                aria-label={label}
              >
                <Icon className="size-4" />
              </Link>
            ) : (
              <MobileBackButton />
            )}
```

- [ ] **Step 3: Server page**

```tsx
// webapp/src/app/(dashboard)/presupuesto/armar/page.tsx
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getEstimatedIncome } from "@/actions/income";
import { getPreferredCurrency } from "@/actions/profile";
import { BudgetBuilder } from "@/components/budget/budget-builder";

export default async function ArmarPresupuestoPage() {
  const currency = await getPreferredCurrency();
  const [categoriesResult, incomeEstimate] = await Promise.all([
    getCategoriesWithBudgetData(undefined, currency),
    getEstimatedIncome(currency),
  ]);

  const groups = (categoriesResult.success ? categoriesResult.data : []).filter(
    (c) => c.direction === "OUTFLOW" && c.is_active
  );

  return (
    <BudgetBuilder
      groups={groups}
      income={incomeEstimate?.monthlyAverage ?? 0}
      currency={currency}
    />
  );
}
```

**Adaptation note:** if `getPreferredCurrency` doesn't exist under `@/actions/profile`, look at how `webapp/src/app/(dashboard)/plan/page.tsx` resolves `currency` and copy that exact mechanism.

- [ ] **Step 4: Builder client component**

```tsx
// webapp/src/components/budget/budget-builder.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { CategoryIcon } from "@/components/categories/category-icon";
import { BudgetGroupLines } from "./budget-group-lines";
import { applyBudgetComposition } from "@/actions/budgets";
import { createCategory } from "@/actions/categories";
import { computeCompositionDiff } from "@/lib/utils/budget-rollup";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  BRASS_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE_CLASS,
  PANEL_INSET_CLASS,
} from "@/lib/constants/styles";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

const BACK_TARGET = "/plan?tab=presupuesto";

interface BudgetBuilderProps {
  groups: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
}

function initialDraft(groups: CategoryBudgetData[]): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const g of groups) {
    if (g.baseBudget && g.baseBudget > 0) draft[g.id] = String(g.baseBudget);
    for (const [childId, amount] of Object.entries(g.childBudgets)) {
      draft[childId] = String(amount);
    }
  }
  return draft;
}

function toNumberMap(draft: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(draft)) out[id] = parseFloat(v) || 0;
  return out;
}

export function BudgetBuilder({ groups, income, currency }: BudgetBuilderProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const initial = useMemo(() => toNumberMap(initialDraft(groups)), [groups]);
  const [draft, setDraft] = useState<Record<string, string>>(() => initialDraft(groups));
  const [openId, setOpenId] = useState<string | null>(groups[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);

  const diff = useMemo(
    () => computeCompositionDiff(initial, toNumberMap(draft)),
    [initial, draft]
  );
  const dirty = diff.upserts.length > 0 || diff.deletes.length > 0;

  const groupTotal = (g: CategoryBudgetData) =>
    (parseFloat(draft[g.id] ?? "") || 0) +
    g.children.reduce((s, c) => s + (parseFloat(draft[c.id] ?? "") || 0), 0);

  const total = groups.reduce((s, g) => s + groupTotal(g), 0);
  const remaining = income - total;

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => Number(groupTotal(b) > 0) - Number(groupTotal(a) > 0)),
    // Intentionally sorted once on mount so groups don't jump while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function setLine(categoryId: string, amount: string) {
    setDraft((prev) => ({ ...prev, [categoryId]: amount }));
  }

  async function handleCreateSub(parentId: string, name: string): Promise<string | null> {
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const fd = new FormData();
    fd.append("name", name);
    fd.append("name_es", name);
    fd.append("slug", `${slug}-${Date.now().toString(36)}`);
    fd.append("direction", "OUTFLOW");
    fd.append("parent_id", parentId);
    const result = await createCategory({ success: false, error: "" }, fd);
    if (!result.success) {
      toast.error(result.error || "No se pudo crear la línea");
      return null;
    }
    return result.data.id;
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const result = await applyBudgetComposition(diff);
      if (!result.success) {
        toast.error(result.error || "No se pudo guardar el presupuesto");
        return;
      }
      toast.success("Presupuesto guardado");
      startTransition(() => router.push(BACK_TARGET));
    } finally {
      setSaving(false);
    }
  }

  function handleExit() {
    if (dirty) setExitConfirm(true);
    else router.push(BACK_TARGET);
  }

  return (
    <div className={cn("lg:hidden", MOBILE_TAB_BAR_CLEARANCE_CLASS, "lg:pb-0", "contents lg:block")}>
      <div>
        <MobileHeader
          variant="sub"
          title="Armar presupuesto"
          backStyle="exit"
          onBackClick={handleExit}
        />

        <div className="space-y-3 pt-4 lg:mx-auto lg:max-w-md">
          <div className="hidden items-center justify-between lg:flex">
            <h2 className="text-2xl font-semibold">Armar presupuesto</h2>
            <button
              type="button"
              onClick={handleExit}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Salir
            </button>
          </div>

          {sortedGroups.map((g) => {
            const open = openId === g.id;
            const totalG = groupTotal(g);
            return (
              <section key={g.id} className={cn(PANEL_INSET_CLASS, "p-3", open && "border-z-brass/30")}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : g.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${g.color}20`, color: g.color }}
                    >
                      <CategoryIcon icon={g.icon} className="size-3.5" />
                    </span>
                    <span className="truncate text-sm font-semibold">{g.name_es ?? g.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-sm font-semibold tabular-nums text-z-brass">
                      {totalG > 0 ? formatCurrency(totalG, currency) : "—"}
                    </span>
                    {open ? (
                      <ChevronDown className="size-3.5 text-z-sage-dark" strokeWidth={1.5} />
                    ) : (
                      <ChevronRight className="size-3.5 text-z-sage-dark" strokeWidth={1.5} />
                    )}
                  </span>
                </button>

                {open && (
                  <div className="mt-3">
                    <BudgetGroupLines
                      group={g}
                      currency={currency}
                      draft={draft}
                      onChange={setLine}
                      onAddLine={(id, prefill) => setLine(id, prefill)}
                      onCreateSub={(name) => handleCreateSub(g.id, name)}
                    />
                  </div>
                )}
              </section>
            );
          })}

          {/* Sticky total */}
          <div className="sticky bottom-2 z-10 space-y-2 rounded-xl border border-z-brass/35 bg-z-surface-2/95 p-3 backdrop-blur-sm">
            <div className="flex items-baseline justify-between text-sm font-semibold">
              <span>
                Σ {formatCurrency(total, currency)}
                {income > 0 && (
                  <span className="font-normal text-muted-foreground"> de {formatCurrency(income, currency)}</span>
                )}
              </span>
              {income > 0 && (
                <span className={cn("tabular-nums", remaining < 0 ? "text-z-debt" : "text-z-income")}>
                  {remaining < 0
                    ? `te pasas ${formatCurrency(-remaining, currency)}`
                    : `quedan ${formatCurrency(remaining, currency)}`}
                </span>
              )}
            </div>
            {income > 0 && (
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className={cn("h-full rounded-full", total > income ? "bg-z-debt" : "bg-z-brass")}
                  style={{ width: `${Math.min(100, (total / income) * 100)}%` }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className={cn(
                "h-10 w-full rounded-md text-sm font-semibold transition-colors disabled:opacity-50",
                BRASS_BUTTON_CLASS
              )}
            >
              {saving ? "Guardando..." : "Guardar presupuesto"}
            </button>
          </div>
        </div>

        <AlertDialog open={exitConfirm} onOpenChange={setExitConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
              <AlertDialogDescription>
                Tienes líneas sin guardar. Si sales ahora, se pierden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir editando</AlertDialogCancel>
              <AlertDialogAction onClick={() => router.push(BACK_TARGET)}>
                Descartar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
```

**Adaptation notes:** (1) the outer wrapper `cn("lg:hidden", ...)` trick above is WRONG as written — the builder renders on BOTH viewports from one tree; use a single wrapper `<div className={cn(MOBILE_TAB_BAR_CLEARANCE_CLASS, "lg:pb-8")}>` (MobileHeader self-hides at lg). Fix during implementation; this is the only intentionally-flagged adjustment. (2) Confirm `createCategory`'s exact `_prevState` signature at `webapp/src/actions/categories.ts:~470` before calling.

- [ ] **Step 5: Entry points in the tab**

In `webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx`:

Mobile — directly above `<ScenarioEntryPoint />` add:

```tsx
          <Link
            href="/presupuesto/armar"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-z-brass/25 bg-z-brass/8 text-[13px] font-semibold text-z-brass transition-colors active:bg-z-brass/14"
          >
            <Hammer className="size-3.5" strokeWidth={2} />
            Armar presupuesto
          </Link>
```

Desktop — inside the `<div className="flex items-center gap-2">` next to `<MonthPlanner ...>` add as the first child:

```tsx
            <Link
              href="/presupuesto/armar"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                BRASS_GHOST_BUTTON_CLASS
              )}
            >
              <Hammer className="size-3.5" strokeWidth={1.5} />
              Armar presupuesto
            </Link>
```

Imports to add in that file: `import Link from "next/link";`, `import { Hammer } from "lucide-react";`, and `BRASS_GHOST_BUTTON_CLASS` added to the existing styles import.

- [ ] **Step 6: Build + manual smoke**

Run: `cd webapp && pnpm build`
Expected: clean. Then `pnpm dev`, open `http://localhost:3000/presupuesto/armar` at 390px: tab bar hidden, accordion works, chips add lines, Σ bar updates, Guardar persists and lands on the tab with new totals, exit with dirty draft asks confirmation.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/app/\(dashboard\)/presupuesto/armar webapp/src/components/budget/budget-builder.tsx webapp/src/lib/constants/mobile-nav.ts webapp/src/components/mobile/v2/mobile-header.tsx webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx
git commit -m "feat(presupuesto): builder /presupuesto/armar con líneas sembradas"
```

---

### Task 7: Composer sheet in the tab

**Files:**
- Create: `webapp/src/components/budget/budget-composer-sheet.tsx`
- Modify: `webapp/src/components/budget/mobile-budget-list.tsx` (route taps: composed → composer)
- Modify: `webapp/src/components/budget/budget-editor-sheet.tsx` (add "Convertir en líneas")

- [ ] **Step 1: Composer sheet**

```tsx
// webapp/src/components/budget/budget-composer-sheet.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { BudgetGroupLines } from "./budget-group-lines";
import { applyBudgetComposition } from "@/actions/budgets";
import { computeCompositionDiff } from "@/lib/utils/budget-rollup";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface BudgetComposerSheetProps {
  group: CategoryBudgetData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  /** Optimistic refresh callback — parent re-syncs after save. */
  onSaved: () => void;
}

function groupDraft(group: CategoryBudgetData | null): Record<string, string> {
  if (!group) return {};
  const draft: Record<string, string> = {};
  if (group.baseBudget && group.baseBudget > 0) draft[group.id] = String(group.baseBudget);
  for (const [id, amount] of Object.entries(group.childBudgets)) draft[id] = String(amount);
  return draft;
}

export function BudgetComposerSheet({
  group,
  open,
  onOpenChange,
  currency,
  onSaved,
}: BudgetComposerSheetProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(groupDraft(group));
  }, [open, group]);

  const initial = useMemo(() => {
    const numbers: Record<string, number> = {};
    for (const [id, v] of Object.entries(groupDraft(group))) numbers[id] = parseFloat(v) || 0;
    return numbers;
  }, [group]);

  if (!group) return null;

  const total = Object.values(draft).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const diff = computeCompositionDiff(
    initial,
    Object.fromEntries(Object.entries(draft).map(([id, v]) => [id, parseFloat(v) || 0]))
  );
  const dirty = diff.upserts.length > 0 || diff.deletes.length > 0;

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const result = await applyBudgetComposition(diff);
      if (!result.success) {
        toast.error(result.error || "No se pudo guardar");
        return;
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("max-h-[85vh] overflow-y-auto", MOBILE_SHEET_SAFE_AREA_CLASS)}>
        <SheetHeader>
          <SheetTitle>{group.name_es ?? group.name} — {formatCurrency(total, currency)}/mes</SheetTitle>
          <SheetDescription>
            Gastaste {formatCurrency(group.spent, currency)} este mes · cada línea muestra su gasto real
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-2">
          <BudgetGroupLines
            group={group}
            currency={currency}
            draft={draft}
            onChange={(id, v) => setDraft((p) => ({ ...p, [id]: v }))}
            onAddLine={(id, prefill) => setDraft((p) => ({ ...p, [id]: prefill }))}
            showSpend
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className={cn(
              "h-10 w-full rounded-md text-sm font-semibold transition-colors disabled:opacity-50",
              BRASS_BUTTON_CLASS
            )}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

(No `onCreateSub` here — inline creation stays a builder capability; the sheet's "+ línea" chips cover existing subs. YAGNI.)

- [ ] **Step 2: Route taps in `MobileBudgetList`**

In `webapp/src/components/budget/mobile-budget-list.tsx`:

1. Import the composer: `import { BudgetComposerSheet } from "./budget-composer-sheet";`
2. Add state alongside the existing sheet state:

```ts
  const [composerOpen, setComposerOpen] = useState(false);
```

3. Replace the body of `openEditor` with composed-group routing:

```ts
  function openEditor(categoryId: string) {
    setEditingId(categoryId);
    const cat = localCategories.find((c) => c.id === categoryId);
    if (cat && Object.keys(cat.childBudgets).length > 0) setComposerOpen(true);
    else setSheetOpen(true);
  }
```

4. After the existing `<BudgetEditorSheet ... />` add:

```tsx
      <BudgetComposerSheet
        group={editing}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        currency={currency}
        onSaved={() => startTransition(() => router.refresh())}
      />
```

5. In `handleSaved` (simple editor), the optimistic update must respect rollup — replace its `setLocalCategories` call with:

```ts
    setLocalCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoryId) return c;
        const childSum = Object.values(c.childBudgets).reduce((s, v) => s + v, 0);
        const combined = amount + childSum;
        return {
          ...c,
          baseBudget: amount,
          budget: combined,
          expense_type: expenseType,
          percentUsed: combined > 0 ? (c.spent / combined) * 100 : 0,
        };
      })
    );
```

and `handleDeleted`'s with:

```ts
    setLocalCategories((prev) =>
      prev.map((c) => {
        if (c.id !== categoryId) return c;
        const childSum = Object.values(c.childBudgets).reduce((s, v) => s + v, 0);
        return {
          ...c,
          baseBudget: null,
          budget: childSum > 0 ? childSum : null,
          percentUsed: childSum > 0 ? (c.spent / childSum) * 100 : 0,
        };
      })
    );
```

- [ ] **Step 3: "Convertir en líneas" in the simple editor**

In `webapp/src/components/budget/budget-editor-sheet.tsx` add an optional prop and button. Add to the props interface:

```ts
  /** Shown for groups with subcategories: switches to the composer. */
  onConvertToLines?: () => void;
```

and inside the sheet body, after the Fijo/Variable segmented control, add:

```tsx
          {onConvertToLines && category.children.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onConvertToLines();
              }}
              className="w-full rounded-md border border-dashed border-z-brass/35 bg-z-brass/6 px-3 py-2 text-xs font-medium text-z-brass transition-colors active:bg-z-brass/12"
            >
              Convertir en líneas — arma este grupo por subcategorías
            </button>
          )}
```

Wire it in `MobileBudgetList`'s `<BudgetEditorSheet ...>`:

```tsx
        onConvertToLines={() => setComposerOpen(true)}
```

(Destructure `onConvertToLines` in `BudgetEditorSheet`'s parameters along with the existing props.)

- [ ] **Step 4: Build + manual smoke**

Run: `cd webapp && pnpm build`
Expected: clean. In dev at 390px: tap a simple group → editor with "Convertir en líneas" → composer; compose lines → group total updates; tap a composed group → composer directly with per-line spend.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/budget/budget-composer-sheet.tsx webapp/src/components/budget/mobile-budget-list.tsx webapp/src/components/budget/budget-editor-sheet.tsx
git commit -m "feat(presupuesto): composer por grupo en el tab + convertir en líneas"
```

---

### Task 8: Desktop grid hint for composed groups

**Files:**
- Modify: `webapp/src/components/budget/budget-category-card.tsx` (budgeted branch)

- [ ] **Step 1: Add the hint**

In the `hasBudget` branch of `BudgetCategoryCard`, after the "Disponible:" paragraph, add:

```tsx
            {Object.keys(category.childBudgets).length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {Object.keys(category.childBudgets).length} líneas — edítalas en{" "}
                <span className="text-z-brass">Armar presupuesto</span>
              </p>
            )}
```

(The grid popover keeps editing only the Base row — `handleSetBudget` already prefills `baseBudget` from Task 2.)

- [ ] **Step 2: Build + commit**

Run: `cd webapp && pnpm build` — expected clean.

```bash
git add webapp/src/components/budget/budget-category-card.tsx
git commit -m "feat(presupuesto): hint de líneas en tarjetas desktop"
```

---

### Task 9: Gates + manual QA

**Files:** none new.

- [ ] **Step 1: Full test + build gate**

Run: `cd webapp && pnpm vitest run && pnpm build`
Expected: all tests pass, build clean.

- [ ] **Step 2: Manual QA checklist (dev server, 390px + desktop)**

1. Compose Hogar from scratch via suggestion chips (recurrente + prom labels show correct amounts) → Guardar → tab shows combined total; dashboard budget bar agrees; `getBudgetSummary` (dashboard) agrees.
2. Convert an existing simple budget → lines; verify Base muted at 0; zero out one line → it deletes on save.
3. Spend categorized at the parent counts in tab AND dashboard summary, with and without Base.
4. Planificar mes still edits Base only and totals stay correct (no double count).
5. Sandbox: apply a scenario touching a composed group → group total equals the scenario amount exactly (child lines were cleaned).
6. Builder exit with dirty draft → confirm dialog; without → direct exit. Tab bar hidden on `/presupuesto/armar`.
7. Create "Netflix" inline under Gustos → appears as a line, saves, shows in tab after refresh.

- [ ] **Step 3: Review gates (project rule)**

Spawn `server-action-reviewer` (applyBudgetComposition + scenario change), `zetas-front-guy` (all new TSX), `perf-auditor` (rollup enrichment + new route). Fix high-severity findings, re-run build.

- [ ] **Step 4: Final commit**

```bash
git add -A webapp/src
git commit -m "feat(presupuesto): budget builder — gates y ajustes de revisión"
```

---

## Self-review notes (already applied)

- **Spec coverage:** data-model invariant → Tasks 1-2; builder → Task 6; composer → Task 7; rollup views → Task 2; summary fix → Task 3; action → Task 4; entry points → Task 6 step 5; untouched surfaces → only correctness-level edits to MonthPlanner/grid prefill and sandbox apply, documented in the spec addendum.
- **Known intentional adaptation points** are marked inline ("Adaptation note") — exact `_prevState` signature of `createCategory`, currency resolution on the page, the builder wrapper classes, and variable names inside `applyBudgetScenario`.
- **Type consistency:** `baseBudget`/`childBudgets`/`childAvg3m`/`childRecurring` defined once in Task 2 and consumed with those exact names in Tasks 5-8.
