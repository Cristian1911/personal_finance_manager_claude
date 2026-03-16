# Dual Budget System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expense archetypes (fixed/variable) to categories, enhance budget comparison UI with fixed/variable split, and add an optional monthly planning flow.

**Architecture:** Migration adds `expense_type` to categories. The `CategoryBudgetData` type gains the new field. Budget UI components are enhanced to show fixed vs variable splits. A new `MonthPlanner` component provides the optional monthly planning ritual.

**Tech Stack:** Supabase (migration), Next.js server actions, React client components, Zeta brand tokens.

---

## Task 1: Migration + type updates

**Files:**
- Migration: add `expense_type` to `categories`
- Modify: `webapp/src/types/database.ts` — regenerate
- Modify: `webapp/src/types/domain.ts` — add `expense_type` to `CategoryBudgetData`

- [ ] **Step 1: Apply migration**

```sql
ALTER TABLE categories ADD COLUMN expense_type text
  CHECK (expense_type IN ('fixed', 'variable'));
```

- [ ] **Step 2: Regenerate types**

```bash
cd webapp && npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts
```

- [ ] **Step 3: Add expense_type to CategoryBudgetData**

In `webapp/src/types/domain.ts`, add to the `CategoryBudgetData` type:

```typescript
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
  expense_type: "fixed" | "variable" | null;  // ← ADD THIS
  budget: number | null;
  spent: number;
  committedRecurring: number;
  percentUsed: number;
  average3m: number;
  children: CategoryWithChildren[];
};
```

- [ ] **Step 4: Return expense_type in getCategoriesWithBudgetData**

In `webapp/src/actions/categories.ts`, in the `getCategoriesWithBudgetData` function, add `expense_type` to the category select query and include it in the returned data. Find the parent categories query (query #1 in the Promise.all) and add `expense_type` to the select. Then include it in the result mapping.

The query currently selects: `id, name, name_es, slug, icon, color, is_essential, is_active, direction, display_order`
Add: `expense_type`

In the result mapping (the `.map()` that builds `CategoryBudgetData`), add:
```typescript
expense_type: cat.expense_type as "fixed" | "variable" | null,
```

- [ ] **Step 5: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/types/database.ts webapp/src/types/domain.ts webapp/src/actions/categories.ts
git commit -m "feat: add expense_type column to categories"
```

---

## Task 2: Expense type selector in budget edit popover

**Files:**
- Modify: `webapp/src/components/budget/budget-category-grid.tsx` — add expense_type toggle
- Modify: `webapp/src/actions/categories.ts` — add `updateCategoryExpenseType` action

- [ ] **Step 1: Add server action to update expense type**

In `webapp/src/actions/categories.ts`, add a new exported function:

```typescript
export async function updateCategoryExpenseType(
  categoryId: string,
  expenseType: "fixed" | "variable" | null
): Promise<ActionResult<undefined>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("categories")
    .update({ expense_type: expenseType })
    .eq("id", categoryId)
    .or(`user_id.eq.${user.id},is_system.eq.true`);

  if (error) return { success: false, error: error.message };

  revalidatePath("/categories");
  return { success: true, data: undefined };
}
```

- [ ] **Step 2: Add expense type toggle to budget popover**

In `webapp/src/components/budget/budget-category-grid.tsx`:

Add import:
```typescript
import { updateCategoryExpenseType } from "@/actions/categories";
```

Add state for expense type:
```typescript
const [expenseType, setExpenseType] = useState<"fixed" | "variable" | null>(null);
```

Update `handleSetBudget` to initialize expense type:
```typescript
function handleSetBudget(categoryId: string) {
  const cat = categories.find((c) => c.id === categoryId);
  setAmount(cat?.budget ? cat.budget.toString() : "");
  setExpenseType(cat?.expense_type ?? null);
  setSaveError(null);
  setEditingId(categoryId);
}
```

Update `handleSave` to also save expense type:
```typescript
async function handleSave() {
  if (!editingId || !amount) return;
  setIsSaving(true);
  setSaveError(null);
  try {
    const formData = new FormData();
    formData.append("category_id", editingId);
    formData.append("amount", amount);
    formData.append("period", "monthly");

    const [budgetResult] = await Promise.all([
      upsertBudget({ success: false, error: "" }, formData),
      updateCategoryExpenseType(editingId, expenseType),
    ]);
    if (budgetResult.success) {
      setEditingId(null);
      setAmount("");
      startTransition(() => router.refresh());
    } else {
      setSaveError(budgetResult.error ?? "Error al guardar");
    }
  } finally {
    setIsSaving(false);
  }
}
```

Add the toggle buttons in the `PopoverContent`, between the CurrencyInput and the error/buttons:

```tsx
<div className="flex gap-1">
  <Button
    variant={expenseType === "fixed" ? "default" : "outline"}
    size="sm"
    className="flex-1 text-xs"
    type="button"
    onClick={() => setExpenseType("fixed")}
  >
    Fijo
  </Button>
  <Button
    variant={expenseType === "variable" ? "default" : "outline"}
    size="sm"
    className="flex-1 text-xs"
    type="button"
    onClick={() => setExpenseType("variable")}
  >
    Variable
  </Button>
</div>
```

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/categories.ts webapp/src/components/budget/budget-category-grid.tsx
git commit -m "feat: add expense type selector to budget edit popover"
```

---

## Task 3: Archetype badge on budget cards + enhanced comparison

**Files:**
- Modify: `webapp/src/components/budget/budget-category-card.tsx`

- [ ] **Step 1: Add archetype badge and enhanced breakdown**

In `webapp/src/components/budget/budget-category-card.tsx`, add a Badge import:
```typescript
import { Badge } from "@/components/ui/badge";
```

After the CardTitle (line ~83), add the archetype badge:
```tsx
<CardTitle className="text-sm">
  {category.name_es ?? category.name}
</CardTitle>
{category.expense_type && (
  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
    {category.expense_type === "fixed" ? "Fijo" : "Variable"}
  </Badge>
)}
```

Replace the existing spend summary line (line ~129-132) with an enhanced breakdown:
```tsx
<div className="space-y-0.5">
  <p className="text-xs font-medium">
    Gastado: {formatCurrency(category.spent)}
    <span className="text-muted-foreground font-normal">
      {" "}de {formatCurrency(category.budget!)}
    </span>
  </p>
  <p className="text-xs text-muted-foreground">
    Disponible:{" "}
    <span className={category.spent > category.budget! ? "text-z-debt" : "text-z-income"}>
      {formatCurrency(Math.max(0, category.budget! - category.spent))}
    </span>
  </p>
</div>
```

- [ ] **Step 2: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/budget/budget-category-card.tsx
git commit -m "feat: add expense type badge and enhanced budget breakdown to cards"
```

---

## Task 4: Fixed vs variable split in summary bar

**Files:**
- Modify: `webapp/src/components/budget/budget-summary-bar.tsx`

- [ ] **Step 1: Add fixed/variable totals and split display**

In `webapp/src/components/budget/budget-summary-bar.tsx`, compute fixed vs variable totals after the existing totals:

```typescript
const fixedCategories = categories.filter((c) => c.expense_type === "fixed" && c.budget && c.budget > 0);
const variableCategories = categories.filter((c) => c.expense_type === "variable" && c.budget && c.budget > 0);

const totalFixed = fixedCategories.reduce((s, c) => s + (c.budget ?? 0), 0);
const totalFixedSpent = fixedCategories.reduce((s, c) => s + c.spent, 0);
const totalVariable = variableCategories.reduce((s, c) => s + (c.budget ?? 0), 0);
const totalVariableSpent = variableCategories.reduce((s, c) => s + c.spent, 0);

const hasArchetypes = totalFixed > 0 || totalVariable > 0;
```

Add a fixed/variable summary below the existing header, before the stacked bar:

```tsx
{hasArchetypes && (
  <div className="flex gap-4 text-xs">
    {totalFixed > 0 && (
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-muted-foreground/50 shrink-0" />
        <span className="text-muted-foreground">
          Fijo: {formatCurrency(totalFixedSpent)} / {formatCurrency(totalFixed)}
          <span className="ml-1 font-medium text-foreground">
            {totalFixed > 0 ? Math.round((totalFixedSpent / totalFixed) * 100) : 0}%
          </span>
        </span>
      </div>
    )}
    {totalVariable > 0 && (
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-z-income shrink-0" />
        <span className="text-muted-foreground">
          Variable: {formatCurrency(totalVariableSpent)} / {formatCurrency(totalVariable)}
          <span className="ml-1 font-medium text-foreground">
            {totalVariable > 0 ? Math.round((totalVariableSpent / totalVariable) * 100) : 0}%
          </span>
        </span>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/budget/budget-summary-bar.tsx
git commit -m "feat: add fixed vs variable split to budget summary bar"
```

---

## Task 5: Month-end insight card

**Files:**
- Create: `webapp/src/components/budget/month-end-insight.tsx`
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx`

- [ ] **Step 1: Create month-end insight component**

Create `webapp/src/components/budget/month-end-insight.tsx`:

```typescript
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData } from "@/types/domain";

interface Props {
  categories: CategoryBudgetData[];
  daysRemaining: number;
}

export function MonthEndInsight({ categories, daysRemaining }: Props) {
  // Only show in last 5 days of month or first 3 days
  if (daysRemaining > 5) return null;

  const fixed = categories.filter((c) => c.expense_type === "fixed" && c.budget && c.budget > 0);
  const variable = categories.filter((c) => c.expense_type === "variable" && c.budget && c.budget > 0);

  if (fixed.length === 0 && variable.length === 0) return null;

  const fixedBudget = fixed.reduce((s, c) => s + (c.budget ?? 0), 0);
  const fixedSpent = fixed.reduce((s, c) => s + c.spent, 0);
  const varBudget = variable.reduce((s, c) => s + (c.budget ?? 0), 0);
  const varSpent = variable.reduce((s, c) => s + c.spent, 0);

  const fixedPct = fixedBudget > 0 ? Math.round((fixedSpent / fixedBudget) * 100) : 0;
  const varPct = varBudget > 0 ? Math.round((varSpent / varBudget) * 100) : 0;
  const varRemaining = Math.max(0, varBudget - varSpent);

  return (
    <Card style={{
      borderColor: "color-mix(in srgb, var(--z-alert) 30%, transparent)",
      backgroundColor: "color-mix(in srgb, var(--z-alert) 8%, transparent)",
    }}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-z-alert shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Resumen del mes</p>
            <p className="text-xs text-muted-foreground">
              {fixedBudget > 0 && `Gastaste ${fixedPct}% de lo fijo. `}
              {varBudget > 0 && varSpent <= varBudget
                ? `Tu gasto variable tiene margen de ${formatCurrency(varRemaining)}.`
                : varBudget > 0
                  ? `Gastaste ${formatCurrency(varSpent - varBudget)} mas de lo planeado en gastos variables.`
                  : ""}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wire into categories page**

In `webapp/src/app/(dashboard)/categories/page.tsx`, add import:
```typescript
import { MonthEndInsight } from "@/components/budget/month-end-insight";
```

Add the component after `BudgetSummaryBar` in the desktop view:
```tsx
<BudgetSummaryBar ... />
<MonthEndInsight categories={outflowCategories} daysRemaining={daysRemaining} />
```

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/budget/month-end-insight.tsx "webapp/src/app/(dashboard)/categories/page.tsx"
git commit -m "feat: add month-end budget insight card"
```

---

## Task 6: Monthly planning flow

**Files:**
- Create: `webapp/src/components/budget/month-planner.tsx`
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx`

- [ ] **Step 1: Create month planner component**

Create `webapp/src/components/budget/month-planner.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, ArrowRight } from "lucide-react";
import { upsertBudget } from "@/actions/budgets";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData } from "@/types/domain";

interface Props {
  categories: CategoryBudgetData[];
}

export function MonthPlanner({ categories }: Props) {
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    // Pre-fill with current budgets
    const initial: Record<string, string> = {};
    for (const cat of categories) {
      if (cat.budget && cat.budget > 0) {
        initial[cat.id] = cat.budget.toString();
      }
    }
    setAmounts(initial);
    setOpen(true);
  }

  function useLastMonth(catId: string, average3m: number) {
    setAmounts((prev) => ({ ...prev, [catId]: Math.round(average3m).toString() }));
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      const entries = Object.entries(amounts).filter(([, v]) => v && parseFloat(v) > 0);
      await Promise.all(
        entries.map(([catId, amt]) => {
          const fd = new FormData();
          fd.append("category_id", catId);
          fd.append("amount", amt);
          fd.append("period", "monthly");
          return upsertBudget({ success: false, error: "" }, fd);
        })
      );
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={handleOpen} className="gap-1.5">
        <CalendarCheck className="h-4 w-4" />
        Planificar mes
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          Planificar presupuesto del mes
        </CardTitle>
        <CardDescription>
          Revisa el gasto real del mes pasado y ajusta tus metas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories
          .filter((c) => c.direction === "OUTFLOW")
          .map((cat) => (
            <div key={cat.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {cat.name_es ?? cat.name}
                  </span>
                  {cat.expense_type && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {cat.expense_type === "fixed" ? "Fijo" : "Var"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gastaste {formatCurrency(cat.spent)} · Promedio: {formatCurrency(cat.average3m)}
                </p>
              </div>
              <CurrencyInput
                className="w-32"
                value={amounts[cat.id] ?? ""}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }))
                }
                placeholder="0"
              />
              {cat.average3m > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs shrink-0"
                  onClick={() => useLastMonth(cat.id, cat.average3m)}
                >
                  Usar promedio
                </Button>
              )}
            </div>
          ))}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={saving || isPending} className="gap-1">
            {saving ? "Guardando..." : "Guardar todo"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wire into categories page**

In `webapp/src/app/(dashboard)/categories/page.tsx`, add import:
```typescript
import { MonthPlanner } from "@/components/budget/month-planner";
```

Add the planner button next to the MonthSelector in the header:
```tsx
<div className="flex flex-wrap items-start justify-between gap-2">
  <div>
    <h1 className="text-2xl font-bold">Presupuesto</h1>
    <p className="text-muted-foreground">¿Cómo vas este mes?</p>
  </div>
  <div className="flex items-center gap-2">
    <MonthPlanner categories={outflowCategories} />
    <MonthSelector />
  </div>
</div>
```

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/budget/month-planner.tsx "webapp/src/app/(dashboard)/categories/page.tsx"
git commit -m "feat: add monthly budget planning flow"
```

---

## Final Verification

- [ ] **Run full build**

```bash
cd webapp && pnpm build
```
