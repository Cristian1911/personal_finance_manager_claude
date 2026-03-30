# Budget Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone `/presupuesto` page with a setup wizard and dual-mode budget management (per-category limits and YNAB-style zero-based budgeting).

**Architecture:** New route `/presupuesto` with a server component page that checks `profiles.budget_mode`. If null, renders the setup wizard. Otherwise renders the budget view in the user's chosen mode. Both modes share the existing `budgets` table — only the UI presentation differs. A new `budget_mode` column on `profiles` stores the preference. Budget CRUD uses a new `upsertBudget` server action. The wizard is a 3-step client component.

**Tech Stack:** Supabase (migration), Next.js 15 (Server Actions, App Router), TypeScript, Tailwind v4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-29-destinatarios-budget-redesign.md` (Part 2)

---

## Task 1: Migration — Add `budget_mode` to Profiles

**Files:**
- Create: `supabase/migrations/[timestamp]_add_budget_mode.sql`

- [ ] **Step 1: Create migration**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
npx supabase migration new add_budget_mode
```

- [ ] **Step 2: Write migration SQL**

```sql
ALTER TABLE public.profiles
ADD COLUMN budget_mode TEXT
  CHECK (budget_mode IN ('per_category', 'zero_based'));
```

- [ ] **Step 3: Push and regenerate types**

```bash
npx supabase db push
cd webapp
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts.tmp
head -1 src/types/database.ts.tmp
mv src/types/database.ts.tmp src/types/database.ts
```

- [ ] **Step 4: Build to verify**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat(budget): add budget_mode column to profiles

Supports 'per_category' and 'zero_based' modes. NULL = wizard not completed."
```

---

## Task 2: Budget Server Actions

**Files:**
- Create: `webapp/src/actions/budget.ts`

- [ ] **Step 1: Create budget actions**

```typescript
"use server";

import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { ActionResult } from "@/types/actions";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

// ── Get budget mode ──────────────────────────────────────

export async function getBudgetMode(): Promise<ActionResult<string | null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("profiles")
    .select("budget_mode")
    .eq("id", user.id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data.budget_mode };
}

// ── Set budget mode ──────────────────────────────────────

export async function setBudgetMode(
  mode: "per_category" | "zero_based",
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("profiles")
    .update({ budget_mode: mode })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("budgets", "zeta");
  return { success: true, data: null };
}

// ── Upsert budget for a category ─────────────────────────

export async function upsertBudget(
  categoryId: string,
  amount: number,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("budgets")
    .upsert(
      {
        user_id: user.id,
        category_id: categoryId,
        amount,
        period: "monthly",
      },
      { onConflict: "user_id,category_id,period" },
    );

  if (error) return { success: false, error: error.message };

  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  return { success: true, data: null };
}

// ── Bulk upsert budgets (wizard completion) ──────────────

export async function bulkUpsertBudgets(
  budgets: { category_id: string; amount: number }[],
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const rows = budgets
    .filter((b) => b.amount > 0)
    .map((b) => ({
      user_id: user.id,
      category_id: b.category_id,
      amount: b.amount,
      period: "monthly" as const,
    }));

  if (rows.length === 0) return { success: true, data: null };

  const { error } = await supabase
    .from("budgets")
    .upsert(rows, { onConflict: "user_id,category_id,period" });

  if (error) return { success: false, error: error.message };

  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  return { success: true, data: null };
}

// ── Get estimated income ─────────────────────────────────

export async function getEstimatedIncome(): Promise<ActionResult<number>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Check profile first
  const { data: profile } = await supabase
    .from("profiles")
    .select("estimated_monthly_income, monthly_salary")
    .eq("id", user.id)
    .single();

  if (profile?.monthly_salary) return { success: true, data: profile.monthly_salary };
  if (profile?.estimated_monthly_income) return { success: true, data: profile.estimated_monthly_income };

  // Fallback: average last 3 months INFLOW
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: inflows } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id)
    .eq("direction", "INFLOW")
    .eq("is_excluded", false)
    .gte("transaction_date", threeMonthsAgo.toISOString().split("T")[0]);

  const total = (inflows ?? []).reduce((sum, tx) => sum + tx.amount, 0);
  return { success: true, data: Math.round(total / 3) };
}

// ── Update income in profile ─────────────────────────────

export async function updateEstimatedIncome(
  amount: number,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("profiles")
    .update({ estimated_monthly_income: amount })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/budget.ts
git commit -m "feat(budget): add budget server actions

- getBudgetMode, setBudgetMode
- upsertBudget, bulkUpsertBudgets
- getEstimatedIncome, updateEstimatedIncome"
```

---

## Task 3: Budget Setup Wizard Component

**Files:**
- Create: `webapp/src/components/budget/budget-wizard.tsx`

- [ ] **Step 1: Create the wizard component**

A 3-step wizard with local state. Step transitions are immediate (no page navigation).

```typescript
interface BudgetWizardProps {
  categories: CategoryBudgetData[];
  estimatedIncome: number;
  currency: CurrencyCode;
  onComplete: () => void;
}
```

**Step 1 — Mode selection:** Two large cards. Click selects, highlights with ring. "Continuar" button.

**Step 2 — Income confirmation:** CurrencyInput pre-filled with estimated income. "Continuar" button.

**Step 3 — Initial allocation:**
- If `per_category`: Grid of category rows with amount inputs. Summary shows total assigned vs income. No enforcement.
- If `zero_based`: Same category rows but with a sticky "Disponible" bar at top showing remaining. Color feedback.

"Finalizar" button calls `setBudgetMode()`, `updateEstimatedIncome()`, and `bulkUpsertBudgets()`, then calls `onComplete()`.

Use a `step` state (1/2/3) with animated transitions. Each step is a section that renders conditionally. Back button on steps 2 and 3.

For the initial amounts in step 3, pre-fill with 50/30/20 suggestions:
- Categories with `expense_type === 'fixed'` → 50% of income split proportionally
- Categories with `expense_type === 'variable'` or null → 30% of income split proportionally
- Categories under "Ahorro e Inversión" → 20% of income split proportionally

The implementer should read the current `CategoryBudgetData` type and existing `CurrencyInput` component to understand the exact interfaces.

- [ ] **Step 2: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/budget/budget-wizard.tsx
git commit -m "feat(budget): add 3-step budget setup wizard

- Step 1: choose mode (per_category / zero_based)
- Step 2: confirm monthly income
- Step 3: initial allocation with 50/30/20 suggestions"
```

---

## Task 4: Per-Category Budget View Component

**Files:**
- Create: `webapp/src/components/budget/budget-per-category.tsx`

- [ ] **Step 1: Create the component**

```typescript
interface BudgetPerCategoryProps {
  categories: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
}
```

Layout:
- **Summary bar:** 3 stat cards — Ingreso, Asignado (sum of budgets), Libre (income - assigned)
- **Category cards grid:** `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3`

Each category card:
- Zone-colored left border (4px)
- Category icon + name (name_es preferred)
- Budget amount: click-to-edit inline. Use a local state `editingId` to show input vs display.
- On blur/Enter: call `upsertBudget(categoryId, amount)` with `startTransition`
- Progress bar: `spent / budget` ratio. Colors: green (<75%), yellow (75-100%), red (>100%)
- Below bar: "$X gastado de $Y" in xs text
- If no budget set: shows "Sin presupuesto" with a "+" button to start editing

The summary bar updates optimistically when a budget is edited (keep local state of all amounts, sync with server in background).

- [ ] **Step 2: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/budget/budget-per-category.tsx
git commit -m "feat(budget): add per-category budget view with inline editing

- Summary bar (income, assigned, remaining)
- Category card grid with click-to-edit budget amounts
- Progress bars with color feedback"
```

---

## Task 5: Zero-Based Budget View Component

**Files:**
- Create: `webapp/src/components/budget/budget-zero-based.tsx`

- [ ] **Step 1: Create the component**

```typescript
interface BudgetZeroBasedProps {
  categories: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
}
```

Layout:
- **Assignment bar (sticky):** Full-width progress showing assigned/income. Right side: remaining in bold. Color: green (>10% left), yellow (1-10%), green checkmark (exactly 0), red (over-assigned).
- **Category list:** Single column. Each row: icon + name + inline amount input (right-aligned). Progress bar below (spent vs assigned). Unassigned categories show "$0" with "Sin asignar" muted text.

The assignment bar is `sticky top-0 z-10` with a background that matches the page.

Typing updates both local state AND the assignment bar immediately. Server sync via `upsertBudget` in `startTransition` on blur.

- [ ] **Step 2: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/budget/budget-zero-based.tsx
git commit -m "feat(budget): add zero-based budget view with assignment bar

- Sticky assignment bar with color feedback
- Single-column category list with inline amount inputs
- Optimistic updates to remaining amount"
```

---

## Task 6: Budget Page — Server Component + Mode Wrapper

**Files:**
- Create: `webapp/src/app/(dashboard)/presupuesto/page.tsx`
- Create: `webapp/src/components/budget/budget-page-client.tsx`

- [ ] **Step 1: Create the page server component**

The page fetches all data server-side and decides what to render:
- If `budget_mode` is null → render BudgetWizard
- Otherwise → render BudgetPageClient with the appropriate mode

```typescript
import { connection } from "next/server";
import { getBudgetMode, getEstimatedIncome } from "@/actions/budget";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { BudgetWizard } from "@/components/budget/budget-wizard";
import { BudgetPageClient } from "@/components/budget/budget-page-client";
import { parseMonth, formatMonthParam, formatMonthLabel } from "@/lib/utils/date";

export default async function PresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;

  const [modeResult, incomeResult, categoriesResult] = await Promise.all([
    getBudgetMode(),
    getEstimatedIncome(),
    getCategoriesWithBudgetData(month),
  ]);

  const budgetMode = modeResult.success ? modeResult.data : null;
  const income = incomeResult.success ? incomeResult.data : 0;
  const categories = categoriesResult.success ? categoriesResult.data : [];

  if (!budgetMode) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <BudgetWizard
          categories={categories}
          estimatedIncome={income}
          currency="COP"
          onComplete={() => {}}
        />
      </div>
    );
  }

  return (
    <BudgetPageClient
      mode={budgetMode as "per_category" | "zero_based"}
      categories={categories}
      income={income}
      currency="COP"
      monthLabel={formatMonthLabel(parseMonth(month))}
    />
  );
}
```

Note: The wizard's `onComplete` needs to trigger a page refresh. Since it's a server component rendering the wizard, the wizard should call `router.refresh()` after completing, which will re-render the server component and now show the budget view.

- [ ] **Step 2: Create BudgetPageClient wrapper**

Client component that renders the header (title, MonthSelector, mode settings popover) and conditionally renders either `BudgetPerCategory` or `BudgetZeroBased`.

```typescript
"use client";

interface BudgetPageClientProps {
  mode: "per_category" | "zero_based";
  categories: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
  monthLabel: string;
}
```

Header layout:
- Left: "Presupuesto" title + mode badge ("Por categoría" or "Base cero") + month label
- Right: MonthSelector + settings popover ("Cambiar modo", "Cambiar ingreso")

The settings popover uses a small `Popover` with two buttons. "Cambiar modo" calls `setBudgetMode` and `router.refresh()`. "Cambiar ingreso" shows an inline input.

- [ ] **Step 3: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/(dashboard)/presupuesto/ webapp/src/components/budget/budget-page-client.tsx
git commit -m "feat(budget): add /presupuesto page with wizard + dual mode

- Server component checks budget_mode
- Wizard shown on first visit
- BudgetPageClient renders per-category or zero-based view"
```

---

## Task 7: Navigation + Plan Page Updates

**Files:**
- Modify: `webapp/src/lib/constants/navigation.ts`
- Modify: `webapp/src/app/(dashboard)/gestionar/page.tsx`
- Modify: `webapp/src/components/plan/plan-budget-section.tsx`

- [ ] **Step 1: Add to navigation config**

In `webapp/src/lib/constants/navigation.ts`:

Add to `WORKSPACE_NAV` (after Cuentas):
```typescript
{ title: "Presupuesto", href: "/presupuesto", icon: PiggyBank },
```

Add `/presupuesto` to the `matchHrefs` array of the "Más" item in `PRIMARY_NAV`.

Import `PiggyBank` from lucide-react.

- [ ] **Step 2: Add to Gestionar page**

In `webapp/src/app/(dashboard)/gestionar/page.tsx`, add to `organizationActions` after the Categorías entry:

```typescript
{
  href: "/presupuesto",
  icon: PiggyBank,
  label: "Presupuesto",
  description: "Establece límites por categoría o asigna cada peso de tu ingreso.",
  accent: "olive",
},
```

Import `PiggyBank` from lucide-react.

- [ ] **Step 3: Update Plan page CTA**

In `webapp/src/components/plan/plan-budget-section.tsx`, find the "Ajustar presupuesto" button and change its href from `/categories` to `/presupuesto`. Also add a small mode badge next to the "Presupuesto" header.

Read the file to find the exact button text and location.

- [ ] **Step 4: Verify build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/constants/navigation.ts webapp/src/app/(dashboard)/gestionar/page.tsx webapp/src/components/plan/plan-budget-section.tsx
git commit -m "feat(budget): add /presupuesto to navigation and Plan CTA

- Added to WORKSPACE_NAV and Gestionar page
- Plan page 'Ajustar presupuesto' now links to /presupuesto"
```

---

## Task 8: Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm install
pnpm build
```

- [ ] **Step 2: Manual smoke test**

1. **First visit:** `/presupuesto` shows wizard → select mode → confirm income → allocate → lands on budget view
2. **Per-category mode:** Card grid with inline editing. Summary bar updates. Progress bars show spent/budget.
3. **Zero-based mode:** Sticky assignment bar. Type amounts. Bar color changes. Exact-zero celebration state.
4. **Mode switch:** Settings popover → "Cambiar modo" → view switches instantly
5. **Plan page:** "Gestionar presupuesto" button links to `/presupuesto`
6. **Navigation:** `/presupuesto` appears in Gestionar page and mobile nav
7. **Month selector:** Changing month loads different budget/spending data

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(budget): polish after smoke test"
```
