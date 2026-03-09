# Mobile UX Refinements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three UX improvements: tappable recurring rows, full budget view, context-aware FAB.

**Architecture:** All changes are in existing mobile components. Task 1 moves a click handler. Task 2 adds a second section to MobilePresupuesto. Task 3 expands the FAB type system and adds route-based logic to MobileSheetProvider.

**Tech Stack:** React, Next.js, Tailwind, usePathname(), existing form components.

---

### Task 1: Tappable Recurring Payment Rows

**Files:**
- Modify: `webapp/src/components/recurring/recurring-payment-timeline.tsx:164-209`

**Step 1: Move click handler from button to row**

Change the payment row container div (line 166) from a passive div to a clickable div with cursor-pointer. Move the `onClick` from the Button (line 203) to the row container. Keep the button as a visual indicator but remove its click handler.

```tsx
{/* Payment row — entire row is tappable */}
<div
  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
  onClick={() =>
    setExpandedKey(isExpanded ? null : item.key)
  }
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpandedKey(isExpanded ? null : item.key);
    }
  }}
>
  {/* Category icon */}
  <span
    className="flex size-7 shrink-0 items-center justify-center rounded-md"
    style={{ backgroundColor: item.categoryColor + "20" }}
  >
    <CategoryIcon
      icon={item.categoryIcon}
      className="size-3.5"
    />
  </span>

  {/* Merchant + account */}
  <div className="min-w-0 flex-1">
    <span className="truncate text-sm font-medium">
      {item.merchant}
    </span>
    <span className="ml-1.5 text-xs text-muted-foreground">
      {item.accountName}
      {item.accountLastFour &&
        ` ****${item.accountLastFour}`}
    </span>
  </div>

  {/* Amount */}
  <span className="shrink-0 text-sm font-medium tabular-nums">
    {formatCurrency(
      item.plannedAmount,
      item.currencyCode as CurrencyCode
    )}
  </span>

  {/* Visual indicator (not clickable separately) */}
  <span className="shrink-0 text-xs text-muted-foreground">
    {isExpanded ? "Cerrar" : "Confirmar ▸"}
  </span>
</div>
```

**Step 2: Verify in browser**

Run: `cd webapp && pnpm dev`
Navigate to `/recurrentes` on mobile viewport. Tap anywhere on a payment row — it should toggle the confirm panel. Verify the old "Confirmar ▸" button area also works (it's part of the row now).

**Step 3: Commit**

```bash
git add webapp/src/components/recurring/recurring-payment-timeline.tsx
git commit -m "fix: make entire recurring payment row tappable, not just the button"
```

---

### Task 2: Presupuesto Shows All Outflow Categories

**Files:**
- Modify: `webapp/src/components/mobile/mobile-presupuesto.tsx:55-127`

**Step 1: Add unbudgeted categories section**

After the `activeBudgets` filter (line 55), add a filter for categories with spending but no budget:

```tsx
const activeBudgets = budgetCategories.filter(
  (c) => c.budget !== null && c.budget > 0
);

const unbudgeted = budgetCategories.filter(
  (c) => (c.budget === null || c.budget === 0) && c.spent > 0
);
```

**Step 2: Add `UnbudgetedRow` component and "Sin presupuesto" section**

After the `{/* Budget Progress */}` section (after line 119), add:

```tsx
{/* Unbudgeted spending */}
{unbudgeted.length > 0 && (
  <div className="space-y-2">
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      Sin presupuesto
    </h3>
    <div className="space-y-3">
      {unbudgeted.map((cat) => (
        <UnbudgetedRow key={cat.id} category={cat} />
      ))}
    </div>
  </div>
)}
```

Add the component (after `BudgetRow`):

```tsx
function UnbudgetedRow({ category }: { category: CategoryBudgetData }) {
  const IconComp = ICON_MAP[category.icon] ?? Tag;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${category.color}20`, color: category.color }}
        >
          <IconComp className="size-3.5" />
        </span>
        <span className="text-sm font-medium truncate">
          {category.name_es ?? category.name}
        </span>
      </div>
      <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap ml-2">
        {formatCurrency(category.spent)}
      </span>
    </div>
  );
}
```

**Step 3: Update empty state**

Change the empty state condition (line 121) to account for unbudgeted too:

```tsx
{activeBudgets.length === 0 && unbudgeted.length === 0 && visibleInbox.length === 0 && (
  <p className="text-sm text-muted-foreground text-center py-8">
    No hay presupuestos configurados.
  </p>
)}
```

**Step 4: Verify in browser**

Navigate to Presupuesto on mobile viewport. Should see:
- Categorization inbox (if uncategorized txns exist)
- Budget progress cards (categories with budgets)
- "Sin presupuesto" section with categories that have spending but no budget

**Step 5: Commit**

```bash
git add webapp/src/components/mobile/mobile-presupuesto.tsx
git commit -m "feat: show unbudgeted categories with spending in mobile presupuesto"
```

---

### Task 3: Context-Aware FAB

This task has 3 sub-parts: expand the type, update FabMenu, update MobileSheetProvider.

#### Task 3a: Expand FabAction type and FabMenu

**Files:**
- Modify: `webapp/src/components/mobile/fab-menu.tsx`

**Step 1: Expand types and accept contextual actions**

```tsx
export type FabAction = "expense" | "income" | "transfer" | "new-recurring" | "new-account";

export interface ContextAction {
  id: FabAction;
  label: string;
  icon: typeof ArrowUpRight;
  bg: string;
}

interface FabMenuProps {
  onAction: (action: FabAction) => void;
  contextActions?: ContextAction[];
}
```

**Step 2: Render contextual actions before defaults**

In the sub-actions section, combine `contextActions` with `SUB_ACTIONS`:

```tsx
const allActions = [...(contextActions ?? []), ...SUB_ACTIONS];
```

Then render `allActions` instead of `SUB_ACTIONS` in the map. Import `CalendarPlus` and `Landmark` from lucide-react (needed by the provider, not here, but good for the type).

Full updated component:

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type FabAction = "expense" | "income" | "transfer" | "new-recurring" | "new-account";

export interface ContextAction {
  id: FabAction;
  label: string;
  icon: typeof ArrowUpRight;
  bg: string;
}

interface FabMenuProps {
  onAction: (action: FabAction) => void;
  contextActions?: ContextAction[];
}

const SUB_ACTIONS: ContextAction[] = [
  { id: "expense", label: "Gasto rápido", icon: ArrowUpRight, bg: "bg-orange-500" },
  { id: "income", label: "Ingreso", icon: ArrowDownLeft, bg: "bg-green-500" },
  { id: "transfer", label: "Transferencia", icon: ArrowLeftRight, bg: "bg-blue-500" },
];

export function FabMenu({ onAction, contextActions }: FabMenuProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleAction = useCallback(
    (action: FabAction) => {
      setOpen(false);
      onAction(action);
    },
    [onAction],
  );

  const allActions = [...(contextActions ?? []), ...SUB_ACTIONS];

  return (
    <div className="lg:hidden">
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div
          className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)]"
        >
          {allActions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              aria-label={action.label}
              onClick={() => handleAction(action.id)}
              className={cn(
                "flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in fill-mode-both",
              )}
              style={{
                animationDelay: `${index * 60}ms`,
                animationDuration: "200ms",
              }}
            >
              <span className="rounded-full bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
                {action.label}
              </span>
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-white shadow-lg",
                  action.bg,
                )}
              >
                <action.icon className="size-5" strokeWidth={2} />
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        className={cn(
          "fixed bottom-5 left-1/2 z-50 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 mb-[env(safe-area-inset-bottom)]",
          open && "rotate-45",
        )}
        aria-label={open ? "Cerrar menú" : "Abrir menú de acciones"}
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add webapp/src/components/mobile/fab-menu.tsx
git commit -m "feat: expand FabMenu to accept contextual actions"
```

#### Task 3b: Update MobileSheetProvider with route detection

**Files:**
- Modify: `webapp/src/components/mobile/mobile-sheet-provider.tsx`

**Step 1: Add route detection and contextual action mapping**

Import `usePathname` from `next/navigation`, `CalendarPlus` and `Landmark` from `lucide-react`, and the existing forms. Compute context actions based on pathname.

```tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarPlus, Landmark } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FabMenu, type FabAction, type ContextAction } from "./fab-menu";
import { MobileTransactionForm } from "./mobile-transaction-form";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { SpecializedAccountForm } from "@/components/accounts/specialized-account-form";
import type {
  Account,
  CategoryWithChildren,
  TransactionDirection,
} from "@/types/domain";

interface MobileSheetProviderProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  children: React.ReactNode;
}

const TRANSACTION_ACTIONS: Record<
  "expense" | "income" | "transfer",
  { title: string; direction: TransactionDirection }
> = {
  expense: { title: "Gasto rápido", direction: "OUTFLOW" },
  income: { title: "Ingreso", direction: "INFLOW" },
  transfer: { title: "Transferencia", direction: "OUTFLOW" },
};

function getContextActions(pathname: string): ContextAction[] {
  if (pathname.startsWith("/recurrentes")) {
    return [{ id: "new-recurring", label: "Nuevo recurrente", icon: CalendarPlus, bg: "bg-purple-500" }];
  }
  if (pathname === "/accounts") {
    return [{ id: "new-account", label: "Nueva cuenta", icon: Landmark, bg: "bg-cyan-500" }];
  }
  return [];
}

function getSheetTitle(action: FabAction): string {
  if (action === "new-recurring") return "Nueva transacción recurrente";
  if (action === "new-account") return "Nueva cuenta";
  return TRANSACTION_ACTIONS[action as keyof typeof TRANSACTION_ACTIONS]?.title ?? "";
}

export function MobileSheetProvider({
  accounts,
  categories,
  children,
}: MobileSheetProviderProps) {
  const [activeAction, setActiveAction] = useState<FabAction | null>(null);
  const pathname = usePathname();

  const contextActions = getContextActions(pathname);

  return (
    <>
      {children}

      <FabMenu onAction={setActiveAction} contextActions={contextActions} />

      <Sheet
        open={activeAction !== null}
        onOpenChange={(open) => {
          if (!open) setActiveAction(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>{activeAction ? getSheetTitle(activeAction) : ""}</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-4">
            {activeAction && activeAction in TRANSACTION_ACTIONS && (
              <MobileTransactionForm
                key={activeAction}
                accounts={accounts}
                categories={categories}
                defaultDirection={TRANSACTION_ACTIONS[activeAction as keyof typeof TRANSACTION_ACTIONS].direction}
                isTransfer={activeAction === "transfer"}
                onSuccess={() => setActiveAction(null)}
              />
            )}

            {activeAction === "new-recurring" && (
              <RecurringForm
                accounts={accounts}
                categories={categories}
                onSuccess={() => setActiveAction(null)}
              />
            )}

            {activeAction === "new-account" && (
              <SpecializedAccountForm
                onSuccess={() => setActiveAction(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

**Step 2: Verify in browser**

- Navigate to `/recurrentes` on mobile viewport → open FAB → should see "Nuevo recurrente" (purple) as first option, then the 3 defaults
- Navigate to `/accounts` → open FAB → should see "Nueva cuenta" (cyan) as first option
- Navigate to `/dashboard` → open FAB → should only see the 3 defaults
- Tap "Nuevo recurrente" → recurring form opens in sheet
- Tap "Nueva cuenta" → account form opens in sheet
- Tap any default action → transaction form opens as before

**Step 3: Commit**

```bash
git add webapp/src/components/mobile/mobile-sheet-provider.tsx
git commit -m "feat: context-aware FAB — route-based primary actions for recurrentes and accounts"
```

---

### Task 4: Build verification

**Step 1: Run build**

```bash
cd webapp && pnpm build
```

Expected: Clean build, no type errors.

**Step 2: Final commit if any fixes needed**

Fix any type errors, then commit fixes.
