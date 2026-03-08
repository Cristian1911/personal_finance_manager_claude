# Categories & Budget Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace 17 flat seed categories with 8 ADHD-friendly parents (6 outflow + 2 inflow), redesign `/categories` as a visual budget dashboard with 3 tabs (Presupuesto, Tendencias, Gestionar).

**Architecture:** New DB migration swaps seed categories, nullifies old transaction links, deletes stale budgets. Enhanced server action computes spent + 3-month averages per parent. New tab-based page with stacked progress bars replaces the current sortable list UI.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres), React Server Components, shadcn/ui (Tabs, Card, Progress), Tailwind v4, Lucide icons.

**Design Doc:** `docs/plans/2026-03-08-categories-budget-redesign.md`

---

## Task 1: Database Migration — Replace Seed Categories

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_replace_seed_categories.sql`

**Step 1: Create the migration file**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
npx supabase migration new replace_seed_categories
```

**Step 2: Write the migration SQL**

```sql
-- 1. Nullify category_id on all transactions referencing system categories
UPDATE public.transactions
SET category_id = NULL
WHERE category_id IN (
  SELECT id FROM public.categories WHERE is_system = true
);

-- 2. Delete budgets referencing system categories
DELETE FROM public.budgets
WHERE category_id IN (
  SELECT id FROM public.categories WHERE is_system = true
);

-- 3. Delete all system categories
DELETE FROM public.categories WHERE is_system = true;

-- 4. Insert new parent categories (6 outflow + 2 inflow)
INSERT INTO public.categories (id, name, name_es, slug, icon, color, direction, is_system, is_essential, display_order, parent_id, user_id)
VALUES
  -- OUTFLOW parents
  ('b0000001-0001-4000-8000-000000000001', 'Home', 'Hogar', 'hogar', 'home', '#6366f1', 'OUTFLOW', true, true, 1, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000002', 'Food', 'Alimentación', 'alimentacion', 'utensils', '#10b981', 'OUTFLOW', true, true, 2, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000003', 'Transport', 'Transporte', 'transporte', 'car', '#f59e0b', 'OUTFLOW', true, true, 3, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000004', 'Health', 'Salud', 'salud', 'heart-pulse', '#ef4444', 'OUTFLOW', true, true, 4, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000005', 'Lifestyle', 'Estilo de vida', 'estilo-de-vida', 'sparkles', '#ec4899', 'OUTFLOW', true, false, 5, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000006', 'Obligations', 'Obligaciones', 'obligaciones', 'shield', '#64748b', 'OUTFLOW', true, true, 6, NULL, NULL),
  -- INFLOW parents
  ('b0000001-0001-4000-8000-000000000007', 'Income', 'Ingresos', 'ingresos', 'briefcase', '#22c55e', 'INFLOW', true, false, 1, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000008', 'Other Income', 'Otros ingresos', 'otros-ingresos', 'plus-circle', '#64748b', 'INFLOW', true, false, 2, NULL, NULL);
```

**Step 3: Push migration to remote DB**

```bash
npx supabase db push
```

Expected: Migration applies cleanly. Old categories gone, 8 new ones present.

**Step 4: Regenerate TypeScript types**

```bash
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts
```

Verify: `export type Json =` header is intact in the output file.

**Step 5: Commit**

```bash
git add supabase/migrations/*replace_seed_categories* webapp/src/types/database.ts
git commit -m "feat: replace 17 seed categories with 8 ADHD-friendly parents"
```

---

## Task 2: Update Auto-Categorization Engine

**Files:**
- Modify: `webapp/src/lib/utils/auto-categorize.ts`

**Step 1: Replace the CAT object with new UUIDs**

Old CAT has 21 entries mapping to `a0000001-*` UUIDs. Replace with 8 entries mapping to `b0000001-*`:

```typescript
const CAT = {
  HOGAR: "b0000001-0001-4000-8000-000000000001",
  ALIMENTACION: "b0000001-0001-4000-8000-000000000002",
  TRANSPORTE: "b0000001-0001-4000-8000-000000000003",
  SALUD: "b0000001-0001-4000-8000-000000000004",
  ESTILO_DE_VIDA: "b0000001-0001-4000-8000-000000000005",
  OBLIGACIONES: "b0000001-0001-4000-8000-000000000006",
  INGRESOS: "b0000001-0001-4000-8000-000000000007",
  OTROS_INGRESOS: "b0000001-0001-4000-8000-000000000008",
} as const;
```

**Step 2: Consolidate KEYWORD_RULES to map to 8 parents**

Merge the 16 rule groups into 8. The mapping:

| Old rule group | New parent |
|---|---|
| Vivienda | HOGAR |
| Servicios | HOGAR |
| Alimentación | ALIMENTACION |
| Transporte | TRANSPORTE |
| Salud | SALUD |
| Cuidado Personal | SALUD |
| Educación | ESTILO_DE_VIDA |
| Entretenimiento | ESTILO_DE_VIDA |
| Compras | ESTILO_DE_VIDA |
| Suscripciones | ESTILO_DE_VIDA |
| Mascotas | ESTILO_DE_VIDA |
| Seguros | OBLIGACIONES |
| Impuestos | OBLIGACIONES |
| Pagos de Deuda | OBLIGACIONES |
| Transferencias | (remove — not a real category) |
| Ingresos (salario) | INGRESOS |
| Ingresos (inversiones) | OTROS_INGRESOS |

```typescript
const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
  {
    keywords: [
      // Alimentación
      "exito", "carulla", "jumbo", "d1", "ara", "olimpica", "surtimax",
      "mercado", "fruver", "panaderia", "restaurante", "comida", "rappi",
      "ifood", "domicilios", "mcdonalds", "burger", "subway", "crepes",
      "pollo", "pizza", "sushi", "cafe", "starbucks", "juan valdez", "tostao",
      "panadero",
    ],
    categoryId: CAT.ALIMENTACION,
  },
  {
    keywords: [
      // Transporte
      "uber", "didi", "beat", "indriver", "cabify", "taxi", "gasolina",
      "terpel", "primax", "texaco", "biomax", "peaje", "parqueadero",
      "estacionamiento", "soat", "metro", "transmilenio", "sitp", "mio",
    ],
    categoryId: CAT.TRANSPORTE,
  },
  {
    keywords: [
      // Hogar (vivienda + servicios)
      "arriendo", "alquiler", "hipoteca", "administracion", "inmobiliaria",
      "propiedad", "conjunto", "epm", "codensa", "vanti", "acueducto",
      "energia", "gas natural", "claro", "movistar", "tigo", "wom", "etb",
      "internet", "celular", "telefon",
    ],
    categoryId: CAT.HOGAR,
  },
  {
    keywords: [
      // Salud (salud + cuidado personal)
      "drogueria", "farmacia", "eps", "medic", "clinica", "hospital",
      "laboratorio", "optica", "dental", "salud", "cruz verde", "farmatodo",
      "locatel", "colmedica", "sura eps", "peluqueria", "barberia", "salon",
      "spa", "manicure", "pedicure", "estetica", "cosmetico", "perfumeria",
    ],
    categoryId: CAT.SALUD,
  },
  {
    keywords: [
      // Estilo de vida (educación + entretenimiento + compras + suscripciones + mascotas)
      "universidad", "colegio", "escuela", "curso", "udemy", "coursera",
      "platzi", "educacion", "matricula", "semestre", "libreria", "papeleria",
      "netflix", "spotify", "disney", "hbo", "amazon prime", "youtube",
      "apple", "google storage", "icloud", "chatgpt", "notion", "figma",
      "github", "suscripcion", "cine", "cinecolombia", "procinal", "teatro",
      "concierto", "boleta", "parque", "museo", "bar", "discoteca", "juego",
      "steam", "playstation", "xbox", "falabella", "homecenter", "alkosto",
      "ktronix", "zara", "h&m", "nike", "adidas", "tienda", "mercadolibre",
      "amazon", "linio", "dafiti", "veterinar", "mascota", "pet", "laika",
      "gabrica", "concentrado", "perro", "gato",
    ],
    categoryId: CAT.ESTILO_DE_VIDA,
  },
  {
    keywords: [
      // Obligaciones (seguros + impuestos + pagos deuda)
      "seguro", "poliza", "sura", "bolivar", "allianz", "liberty", "mapfre",
      "axa", "impuesto", "dian", "predial", "retencion", "iva", "declaracion",
      "pago tarjeta", "pago credito", "cuota credito", "abono capital",
      "pago obligacion", "pago prestamo",
    ],
    categoryId: CAT.OBLIGACIONES,
  },
  {
    keywords: [
      // Ingresos
      "nomina", "salario", "sueldo", "pago mensual",
    ],
    categoryId: CAT.INGRESOS,
  },
  {
    keywords: [
      // Otros ingresos
      "rendimiento", "dividendo", "interes ganado", "cdts",
    ],
    categoryId: CAT.OTROS_INGRESOS,
  },
];
```

**Step 3: Update CATEGORY_NAMES map**

Replace the old name map with:

```typescript
const CATEGORY_NAMES: Record<string, string> = {
  [CAT.HOGAR]: "Hogar",
  [CAT.ALIMENTACION]: "Alimentación",
  [CAT.TRANSPORTE]: "Transporte",
  [CAT.SALUD]: "Salud",
  [CAT.ESTILO_DE_VIDA]: "Estilo de vida",
  [CAT.OBLIGACIONES]: "Obligaciones",
  [CAT.INGRESOS]: "Ingresos",
  [CAT.OTROS_INGRESOS]: "Otros ingresos",
};
```

**Step 4: Verify build passes**

```bash
cd webapp && pnpm build
```

Expected: Clean build, no type errors.

**Step 5: Commit**

```bash
git add webapp/src/lib/utils/auto-categorize.ts
git commit -m "feat: consolidate auto-categorize rules to 8 parent categories"
```

---

## Task 3: Add Domain Types + Enhanced Server Action

**Files:**
- Modify: `webapp/src/types/domain.ts`
- Modify: `webapp/src/actions/categories.ts`

**Step 1: Add `CategoryBudgetData` type**

In `webapp/src/types/domain.ts`, add after existing category types:

```typescript
export type CategoryBudgetData = {
  id: string;
  name: string;
  name_es: string | null;
  slug: string;
  icon: string;
  color: string;
  is_essential: boolean;
  direction: TransactionDirection;
  budget: number | null;
  spent: number;
  percentUsed: number;
  average3m: number;
  children: CategoryWithChildren[];
};
```

**Step 2: Create `getCategoriesWithBudgetData` in categories.ts**

Add new function in `webapp/src/actions/categories.ts`:

```typescript
import { parseMonth, monthStartStr, monthEndStr } from "@/lib/utils/date";
import type { CategoryBudgetData } from "@/types/domain";

export async function getCategoriesWithBudgetData(
  month?: string
): Promise<ActionResult<CategoryBudgetData[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const target = parseMonth(month);

  // Calculate 3-month window for rolling average
  const threeMonthsAgo = new Date(target.getFullYear(), target.getMonth() - 2, 1);

  const [catRes, budgetRes, spentRes, avgRes] = await Promise.all([
    // 1. Categories (parents only — no parent_id)
    supabase
      .from("categories")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .eq("is_active", true)
      .is("parent_id", null)
      .order("display_order", { ascending: true }),

    // 2. Budgets
    supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("user_id", user.id)
      .eq("period", "monthly"),

    // 3. This month's spending per category
    executeVisibleTransactionQuery(() =>
      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
        .gte("transaction_date", monthStartStr(target))
        .lte("transaction_date", monthEndStr(target))
    ),

    // 4. Last 3 months spending for averages
    executeVisibleTransactionQuery(() =>
      supabase
        .from("transactions")
        .select("amount, category_id, transaction_date")
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
        .gte("transaction_date", monthStartStr(threeMonthsAgo))
        .lt("transaction_date", monthStartStr(target))
    ),
  ]);

  if (catRes.error) return { success: false, error: catRes.error.message };

  // Build budget map
  const budgetMap = new Map<string, number>();
  for (const b of budgetRes.data ?? []) {
    budgetMap.set(b.category_id, Number(b.amount));
  }

  // Build spent map (this month)
  const spentMap = new Map<string, number>();
  for (const tx of spentRes.data ?? []) {
    if (tx.category_id) {
      spentMap.set(tx.category_id, (spentMap.get(tx.category_id) ?? 0) + tx.amount);
    }
  }

  // Build 3-month average map
  const avgMap = new Map<string, number>();
  for (const tx of avgRes.data ?? []) {
    if (tx.category_id) {
      avgMap.set(tx.category_id, (avgMap.get(tx.category_id) ?? 0) + tx.amount);
    }
  }

  // Also fetch children for each parent
  const { data: allChildren } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .eq("is_active", true)
    .not("parent_id", "is", null)
    .order("display_order", { ascending: true });

  const childrenByParent = new Map<string, CategoryWithChildren[]>();
  for (const child of allChildren ?? []) {
    if (child.parent_id) {
      const arr = childrenByParent.get(child.parent_id) ?? [];
      arr.push({ ...child, children: [] });
      childrenByParent.set(child.parent_id, arr);
    }
  }

  const categories = catRes.data ?? [];

  const result: CategoryBudgetData[] = categories.map((cat) => {
    const budget = budgetMap.get(cat.id) ?? null;
    const spent = spentMap.get(cat.id) ?? 0;
    const avg3mTotal = avgMap.get(cat.id) ?? 0;

    return {
      id: cat.id,
      name: cat.name,
      name_es: cat.name_es,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      is_essential: cat.is_essential ?? false,
      direction: cat.direction as TransactionDirection,
      budget,
      spent,
      percentUsed: budget && budget > 0 ? (spent / budget) * 100 : 0,
      average3m: avg3mTotal / 3,
      children: childrenByParent.get(cat.id) ?? [],
    };
  });

  return { success: true, data: result };
}
```

**Step 3: Add missing date utility helpers if needed**

Check if `monthStartStr` and `monthEndStr` exist in `webapp/src/lib/utils/date.ts`. They're already used in `charts.ts`, so they should exist. If not, they format a Date to `YYYY-MM-01` and `YYYY-MM-DD` (last day of month).

**Step 4: Verify build**

```bash
cd webapp && pnpm build
```

**Step 5: Commit**

```bash
git add webapp/src/types/domain.ts webapp/src/actions/categories.ts
git commit -m "feat: add CategoryBudgetData type and getCategoriesWithBudgetData action"
```

---

## Task 4: Update Navigation

**Files:**
- Modify: `webapp/src/lib/constants/navigation.ts`

**Step 1: Change "Categorías" to "Presupuesto" and update icon**

```typescript
// Old:
{ title: "Categorías", href: "/categories", icon: Tag },

// New:
{ title: "Presupuesto", href: "/categories", icon: PiggyBank },
```

Add `PiggyBank` to the lucide-react import. Remove `Tag` if unused elsewhere.

**Step 2: Verify build**

```bash
cd webapp && pnpm build
```

**Step 3: Commit**

```bash
git add webapp/src/lib/constants/navigation.ts
git commit -m "feat: rename nav item Categorías → Presupuesto"
```

---

## Task 5: BudgetSummaryBar Component

**Files:**
- Create: `webapp/src/components/budget/budget-summary-bar.tsx`

**Step 1: Create the component**

This is the top summary bar showing total budget, total spent, and a stacked horizontal progress bar where each category fills a colored segment.

```typescript
"use client";

import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData } from "@/types/domain";

interface BudgetSummaryBarProps {
  categories: CategoryBudgetData[];
  daysRemaining: number;
  monthLabel: string;
}

export function BudgetSummaryBar({
  categories,
  daysRemaining,
  monthLabel,
}: BudgetSummaryBarProps) {
  const totalBudget = categories.reduce((sum, c) => sum + (c.budget ?? 0), 0);
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
          <p className="text-2xl font-bold">
            {formatCurrency(totalSpent)} <span className="text-base font-normal text-muted-foreground">/ {formatCurrency(totalBudget)}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{daysRemaining} días restantes</p>
          <p className={`text-lg font-semibold ${overallPercent > 100 ? "text-red-500" : overallPercent > 80 ? "text-amber-500" : ""}`}>
            {Math.round(overallPercent)}%
          </p>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div className="h-3 rounded-full bg-muted overflow-hidden flex">
        {categories
          .filter((c) => c.spent > 0 && totalBudget > 0)
          .map((c) => {
            const widthPercent = (c.spent / totalBudget) * 100;
            return (
              <div
                key={c.id}
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(widthPercent, 100)}%`,
                  backgroundColor: c.color,
                }}
                title={`${c.name_es ?? c.name}: ${formatCurrency(c.spent)}`}
              />
            );
          })}
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {categories
          .filter((c) => c.spent > 0)
          .map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name_es ?? c.name}
            </div>
          ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd webapp && pnpm build
```

**Step 3: Commit**

```bash
git add webapp/src/components/budget/budget-summary-bar.tsx
git commit -m "feat: add BudgetSummaryBar with stacked progress bar"
```

---

## Task 6: BudgetCategoryCard Component

**Files:**
- Create: `webapp/src/components/budget/budget-category-card.tsx`

**Step 1: Create the component**

Each card shows: icon + name, horizontal progress bar, spent/budget amounts, percentage. Click expands to show subcategories. Turns amber at 80%, red at 100%+.

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { CategoryBudgetData } from "@/types/domain";
import * as LucideIcons from "lucide-react";

interface BudgetCategoryCardProps {
  category: CategoryBudgetData;
  onSetBudget: (categoryId: string) => void;
}

export function BudgetCategoryCard({ category, onSetBudget }: BudgetCategoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { budget, spent, percentUsed, color, icon, name_es, name, children } = category;
  const displayName = name_es ?? name;

  // Dynamic icon lookup
  const iconName = icon.split("-").map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s.charAt(0).toUpperCase() + s.slice(1)).join("");
  const IconComponent = (LucideIcons as Record<string, LucideIcons.LucideIcon>)[iconName] ?? LucideIcons.Tag;

  const barColor = percentUsed >= 100 ? "#ef4444" : percentUsed >= 80 ? "#f59e0b" : color;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent/50",
        !budget && "opacity-70"
      )}
      onClick={() => children.length > 0 && setExpanded(!expanded)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-md p-2" style={{ backgroundColor: `${color}15` }}>
            <IconComponent className="h-4 w-4" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{displayName}</p>
            {budget ? (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(spent)} / {formatCurrency(budget)} — {Math.round(percentUsed)}%
              </p>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onSetBudget(category.id); }}
                className="text-xs text-primary hover:underline"
              >
                Fijar presupuesto
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {budget ? (
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(percentUsed, 100)}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        ) : null}

        {/* Expanded subcategories */}
        {expanded && children.length > 0 && (
          <div className="pt-2 space-y-1 border-t">
            {children.map((child) => (
              <div key={child.id} className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
                <span>{child.name_es ?? child.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify build**

```bash
cd webapp && pnpm build
```

**Step 3: Commit**

```bash
git add webapp/src/components/budget/budget-category-card.tsx
git commit -m "feat: add BudgetCategoryCard with progress bar and expand"
```

---

## Task 7: BudgetCategoryGrid Component (Tab 1)

**Files:**
- Create: `webapp/src/components/budget/budget-category-grid.tsx`

**Step 1: Create the grid + inline budget popover**

2-col grid on desktop, 1-col on mobile. Includes a popover for setting budgets inline.

```typescript
"use client";

import { useState } from "react";
import { BudgetCategoryCard } from "./budget-category-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertBudget } from "@/actions/budgets";
import type { CategoryBudgetData } from "@/types/domain";

interface BudgetCategoryGridProps {
  categories: CategoryBudgetData[];
}

export function BudgetCategoryGrid({ categories }: BudgetCategoryGridProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!editingId || !amount) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("category_id", editingId);
    formData.set("amount", amount);
    formData.set("period", "monthly");
    await upsertBudget({ success: true, data: undefined }, formData);
    setSaving(false);
    setEditingId(null);
    setAmount("");
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((cat) => (
          <div key={cat.id}>
            {editingId === cat.id ? (
              <Popover open onOpenChange={(open) => { if (!open) setEditingId(null); }}>
                <PopoverTrigger asChild>
                  <div>
                    <BudgetCategoryCard category={cat} onSetBudget={setEditingId} />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 space-y-3">
                  <p className="text-sm font-medium">Presupuesto mensual</p>
                  <Input
                    type="number"
                    placeholder="Ej: 500000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <BudgetCategoryCard category={cat} onSetBudget={setEditingId} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}
```

**Step 2: Verify build**

```bash
cd webapp && pnpm build
```

**Step 3: Commit**

```bash
git add webapp/src/components/budget/budget-category-grid.tsx
git commit -m "feat: add BudgetCategoryGrid with inline budget editing"
```

---

## Task 8: TrendComparison Component (Tab 2)

**Files:**
- Create: `webapp/src/components/budget/trend-comparison.tsx`

**Step 1: Create the component**

Shows this month's spending vs 3-month rolling average per category. Highlights anomalies.

```typescript
"use client";

import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData } from "@/types/domain";

interface TrendComparisonProps {
  categories: CategoryBudgetData[];
}

export function TrendComparison({ categories }: TrendComparisonProps) {
  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const { spent, average3m, color, name_es, name } = cat;
        const displayName = name_es ?? name;
        const diff = average3m > 0 ? ((spent - average3m) / average3m) * 100 : 0;
        const maxVal = Math.max(spent, average3m, 1);
        const isAnomaly = Math.abs(diff) > 30;

        return (
          <div key={cat.id} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{displayName}</p>
              {isAnomaly && average3m > 0 && (
                <span className={`text-xs font-medium ${diff > 0 ? "text-red-500" : "text-green-500"}`}>
                  {diff > 0 ? "+" : ""}{Math.round(diff)}% vs promedio
                </span>
              )}
            </div>

            {/* This month bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Este mes</span>
                <span>{formatCurrency(spent)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(spent / maxVal) * 100}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>

            {/* Average bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Promedio 3 meses</span>
                <span>{formatCurrency(average3m)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all bg-muted-foreground/30"
                  style={{ width: `${(average3m / maxVal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {categories.every((c) => c.spent === 0 && c.average3m === 0) && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay datos de gasto aún para comparar tendencias.
        </p>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd webapp && pnpm build
```

**Step 3: Commit**

```bash
git add webapp/src/components/budget/trend-comparison.tsx
git commit -m "feat: add TrendComparison component for spending vs average"
```

---

## Task 9: CategoryManageList Component (Tab 3)

**Files:**
- Create: `webapp/src/components/budget/category-manage-list.tsx`

**Step 1: Create simplified management list**

Compact list of parents with their subcategories. Parents are not deletable (system). Users can add/edit/delete subcategories.

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createCategory, deleteCategory } from "@/actions/categories";
import type { CategoryBudgetData } from "@/types/domain";

interface CategoryManageListProps {
  categories: CategoryBudgetData[];
}

export function CategoryManageList({ categories }: CategoryManageListProps) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAddSubcategory(parentId: string) {
    if (!newName.trim()) return;
    setSaving(true);
    const parent = categories.find((c) => c.id === parentId);
    const formData = new FormData();
    formData.set("name", newName.trim());
    formData.set("name_es", newName.trim());
    formData.set("slug", newName.trim().toLowerCase().replace(/\s+/g, "-"));
    formData.set("icon", parent?.icon ?? "tag");
    formData.set("color", parent?.color ?? "#6b7280");
    formData.set("direction", parent?.direction ?? "OUTFLOW");
    formData.set("parent_id", parentId);
    await createCategory({ success: true, data: undefined as any }, formData);
    setSaving(false);
    setAddingTo(null);
    setNewName("");
  }

  async function handleDelete(id: string) {
    await deleteCategory(id);
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.id} className="rounded-lg border bg-card">
          {/* Parent header */}
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="font-medium text-sm">{cat.name_es ?? cat.name}</span>
              {cat.is_essential && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Esencial
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAddingTo(addingTo === cat.id ? null : cat.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Subcategoría
            </Button>
          </div>

          {/* Subcategories */}
          {cat.children.length > 0 && (
            <div className="divide-y">
              {cat.children.map((child) => (
                <div key={child.id} className="flex items-center justify-between px-3 py-2 pl-8">
                  <span className="text-sm text-muted-foreground">{child.name_es ?? child.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDelete(child.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add subcategory form */}
          {addingTo === cat.id && (
            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder="Nombre de subcategoría"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddSubcategory(cat.id)}
              />
              <Button size="sm" className="h-8" onClick={() => handleAddSubcategory(cat.id)} disabled={saving}>
                {saving ? "..." : "Agregar"}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd webapp && pnpm build
```

**Step 3: Commit**

```bash
git add webapp/src/components/budget/category-manage-list.tsx
git commit -m "feat: add CategoryManageList for simplified category CRUD"
```

---

## Task 10: Redesign /categories Page with 3 Tabs

**Files:**
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx`

**Step 1: Rewrite the page**

Replace current content with the 3-tab budget dashboard:

```typescript
import { Suspense } from "react";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { BudgetSummaryBar } from "@/components/budget/budget-summary-bar";
import { BudgetCategoryGrid } from "@/components/budget/budget-category-grid";
import { TrendComparison } from "@/components/budget/trend-comparison";
import { CategoryManageList } from "@/components/budget/category-manage-list";
import { MonthSelector } from "@/components/month-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  parseMonth,
  formatMonthLabel,
  getDaysRemainingInMonth,
} from "@/lib/utils/date";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const month = params.month;
  const target = parseMonth(month);
  const monthLabel = formatMonthLabel(target);
  const daysRemaining = getDaysRemainingInMonth(target);

  const result = await getCategoriesWithBudgetData(month);
  const categories = result.success ? result.data : [];
  const outflow = categories.filter((c) => c.direction === "OUTFLOW");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Presupuesto</h1>
          <p className="text-muted-foreground">¿Cómo vas este mes?</p>
        </div>
        <Suspense>
          <MonthSelector />
        </Suspense>
      </div>

      {/* Summary bar */}
      <BudgetSummaryBar
        categories={outflow}
        daysRemaining={daysRemaining}
        monthLabel={monthLabel}
      />

      {/* Tabs */}
      <Tabs defaultValue="presupuesto">
        <TabsList>
          <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
          <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
          <TabsTrigger value="gestionar">Gestionar</TabsTrigger>
        </TabsList>

        <TabsContent value="presupuesto" className="mt-4">
          <BudgetCategoryGrid categories={outflow} />
        </TabsContent>

        <TabsContent value="tendencias" className="mt-4">
          <TrendComparison categories={outflow} />
        </TabsContent>

        <TabsContent value="gestionar" className="mt-4">
          <CategoryManageList categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: Add `getDaysRemainingInMonth` to date utils if missing**

In `webapp/src/lib/utils/date.ts`, add:

```typescript
export function getDaysRemainingInMonth(date: Date): number {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const today = new Date();
  if (date.getMonth() !== today.getMonth() || date.getFullYear() !== today.getFullYear()) {
    return lastDay; // Not current month — show full days
  }
  return Math.max(0, lastDay - today.getDate());
}
```

**Step 3: Verify build**

```bash
cd webapp && pnpm build
```

**Step 4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/categories/page.tsx webapp/src/lib/utils/date.ts
git commit -m "feat: redesign /categories as 3-tab budget dashboard"
```

---

## Task 11: Dashboard Integration — Replace CategorySpendingChart

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`
- Create: `webapp/src/components/budget/dashboard-budget-bar.tsx`

**Step 1: Create a compact version of the summary bar for dashboard**

```typescript
import { formatCurrency } from "@/lib/utils/currency";
import type { CategorySpending } from "@/types/domain";
import Link from "next/link";

interface DashboardBudgetBarProps {
  data: CategorySpending[];
  monthLabel: string;
}

export function DashboardBudgetBar({ data, monthLabel }: DashboardBudgetBarProps) {
  const total = data.reduce((sum, c) => sum + c.amount, 0);

  return (
    <Link href="/categories" className="block">
      <div className="rounded-lg border bg-card p-4 space-y-3 hover:bg-accent/50 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Gasto por categoría</p>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
        </div>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
        ) : (
          <>
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              {data.map((c) => (
                <div
                  key={c.categoryId ?? c.name}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${c.percentage}%`,
                    backgroundColor: c.color,
                  }}
                  title={`${c.name}: ${formatCurrency(c.amount)}`}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {data.slice(0, 5).map((c) => (
                <div key={c.categoryId ?? c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
```

**Step 2: Replace CategorySpendingChart import in dashboard page**

In `webapp/src/app/(dashboard)/dashboard/page.tsx`:

```diff
- import { CategorySpendingChart } from "@/components/charts/category-spending-chart";
+ import { DashboardBudgetBar } from "@/components/budget/dashboard-budget-bar";
```

And in the JSX, replace:

```diff
- <CategorySpendingChart data={categoryData} monthLabel={monthLabel} />
+ <DashboardBudgetBar data={categoryData} monthLabel={monthLabel} />
```

**Step 3: Verify build**

```bash
cd webapp && pnpm build
```

**Step 4: Commit**

```bash
git add webapp/src/components/budget/dashboard-budget-bar.tsx webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: replace dashboard CategorySpendingChart with stacked budget bar"
```

---

## Task 12: Delete Old Components + Route

**Files:**
- Delete: `webapp/src/components/categories/sortable-category-list.tsx`
- Delete: `webapp/src/components/categories/category-list.tsx`
- Delete: `webapp/src/components/categories/category-manage-tree.tsx`
- Delete: `webapp/src/components/charts/category-spending-chart.tsx`
- Delete: `webapp/src/app/(dashboard)/categories/manage/page.tsx`

**Step 1: Verify no other imports exist for these components**

Search for imports of `SortableCategoryList`, `CategoryList`, `CategoryManageTree`, `CategorySpendingChart`:

```bash
cd webapp && grep -r "SortableCategoryList\|CategoryList\|CategoryManageTree\|CategorySpendingChart" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: Only the files being deleted and the files already updated. If other files import them, update those first.

**Step 2: Delete the files**

```bash
rm webapp/src/components/categories/sortable-category-list.tsx
rm webapp/src/components/categories/category-list.tsx
rm webapp/src/components/categories/category-manage-tree.tsx
rm webapp/src/components/charts/category-spending-chart.tsx
rm webapp/src/app/\(dashboard\)/categories/manage/page.tsx
```

**Step 3: Remove the manage route directory if empty**

```bash
rmdir webapp/src/app/\(dashboard\)/categories/manage/ 2>/dev/null || true
```

**Step 4: Clean up `reassignAndDeleteCategory` revalidation**

In `webapp/src/actions/categories.ts`, remove:

```diff
  revalidatePath("/categories");
- revalidatePath("/categories/manage");
```

**Step 5: Verify build**

```bash
cd webapp && pnpm build
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete old category/budget components and /categories/manage route"
```

---

## Task 13: Update Category Picker

**Files:**
- Find and modify the category picker/selector component used in transaction forms

**Step 1: Locate the category picker**

```bash
grep -r "category" webapp/src/components/ --include="*.tsx" -l | grep -i "picker\|select\|form"
```

The picker likely uses `getCategories()` which returns the tree — since we now have 8 parents instead of 17 flat categories, the picker should automatically show fewer options. Verify it works with the new hierarchy (parents with optional children).

**Step 2: Test manually**

```bash
cd webapp && pnpm dev
```

Navigate to a transaction form. Verify:
- Only 6 outflow + 2 inflow categories appear
- Categories display their Spanish names and icons
- Selecting a category works

**Step 3: If picker changes needed, update and commit**

If the picker has hardcoded references to old categories, update them. Otherwise, no changes needed — the picker reads from DB dynamically.

---

## Task 14: Final Verification

**Step 1: Full build**

```bash
cd webapp && pnpm build
```

Expected: Clean build, zero errors.

**Step 2: Dev server smoke test**

```bash
cd webapp && pnpm dev
```

Navigate to:
- `/categories` — should show budget dashboard with 3 tabs
- `/dashboard` — should show stacked budget bar instead of old chart
- Any transaction form — category picker should show 8 options

**Step 3: Verify no dead imports**

```bash
cd webapp && pnpm build 2>&1 | grep -i "error\|warning"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | DB migration: swap 17 → 8 categories | `supabase/migrations/*` |
| 2 | Auto-categorize: consolidate to 8 parents | `lib/utils/auto-categorize.ts` |
| 3 | Types + enhanced server action | `types/domain.ts`, `actions/categories.ts` |
| 4 | Navigation rename | `lib/constants/navigation.ts` |
| 5 | BudgetSummaryBar component | `components/budget/budget-summary-bar.tsx` |
| 6 | BudgetCategoryCard component | `components/budget/budget-category-card.tsx` |
| 7 | BudgetCategoryGrid (Tab 1) | `components/budget/budget-category-grid.tsx` |
| 8 | TrendComparison (Tab 2) | `components/budget/trend-comparison.tsx` |
| 9 | CategoryManageList (Tab 3) | `components/budget/category-manage-list.tsx` |
| 10 | Redesign /categories page | `app/(dashboard)/categories/page.tsx` |
| 11 | Dashboard integration | `app/(dashboard)/dashboard/page.tsx`, `components/budget/dashboard-budget-bar.tsx` |
| 12 | Delete old components + route | 5 files deleted |
| 13 | Verify category picker | smoke test |
| 14 | Final verification | build + dev test |
