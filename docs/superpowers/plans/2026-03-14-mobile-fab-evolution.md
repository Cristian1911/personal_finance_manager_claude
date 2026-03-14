# Mobile FAB Evolution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current speed-dial FAB with a bottom sheet that consolidates transaction actions and prominently features PDF import.

**Architecture:** Replace fab-menu.tsx with bottom sheet pattern. Update MobileSheetProvider to handle new action types. Add direction selector to MobileTransactionForm for "no preset" mode.

**Tech Stack:** Next.js 15, TypeScript, Tailwind v4, shadcn/ui Sheet component

**Spec:** `docs/superpowers/specs/2026-03-14-burn-rate-fab-salary-chart-design.md` (Feature 2)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `webapp/src/components/mobile/fab-menu.tsx` | Replace speed-dial with bottom sheet, new types |
| Modify | `webapp/src/components/mobile/mobile-sheet-provider.tsx` | Handle new action types, import-pdf routing, richer context actions |
| Modify | `webapp/src/components/mobile/mobile-transaction-form.tsx` | Add "no preset" mode with direction selector |
| Modify | `webapp/src/app/(dashboard)/layout.tsx` | No changes needed (already wires MobileSheetProvider correctly) |

---

## Chunk 1: Update FAB Component

### Task 1: Rewrite fab-menu.tsx with bottom sheet pattern

**Files:**
- Modify: `webapp/src/components/mobile/fab-menu.tsx`

- [ ] **Step 1: Replace the entire fab-menu.tsx with the new bottom sheet implementation**

The current file (117 lines) has:
- `FabAction` type: `"expense" | "income" | "transfer" | "new-recurring" | "new-account"`
- `ContextAction` interface: `{ id: FabAction; label: string; icon: typeof ArrowUpRight; bg: string }`
- `FabMenuProps`: `{ onAction: (action: FabAction) => void; contextActions?: ContextAction[] }`
- `SUB_ACTIONS` array with 3 transaction sub-buttons (expense, income, transfer)
- Speed-dial UI: backdrop + vertically stacked sub-action buttons + main FAB

Replace with:

```typescript
// webapp/src/components/mobile/fab-menu.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Plus,
  Receipt,
  FileUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- New types ---

export type PrimaryAction = "transaction" | "import-pdf";

export interface ContextAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
}

export interface FabMenuProps {
  onPrimaryAction: (action: PrimaryAction) => void;
  contextActions?: ContextAction[];
  onContextAction?: (id: string) => void;
}

// --- Primary action definitions ---

const PRIMARY_ACTIONS: {
  id: PrimaryAction;
  icon: typeof Receipt;
  label: string;
  description: string;
  bg: string;
}[] = [
  {
    id: "transaction",
    icon: Receipt,
    label: "Transacción",
    description: "Gasto o ingreso",
    bg: "bg-orange-500",
  },
  {
    id: "import-pdf",
    icon: FileUp,
    label: "Importar PDF",
    description: "Extracto bancario",
    bg: "bg-blue-500",
  },
];

export function FabMenu({
  onPrimaryAction,
  contextActions,
  onContextAction,
}: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  // Close on route change
  useEffect(() => setOpen(false), [pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handlePrimary = useCallback(
    (action: PrimaryAction) => {
      setOpen(false);
      onPrimaryAction(action);
    },
    [onPrimaryAction],
  );

  const handleContext = useCallback(
    (id: string) => {
      setOpen(false);
      onContextAction?.(id);
    },
    [onContextAction],
  );

  return (
    <div className="lg:hidden">
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet */}
      {open && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-background shadow-2xl",
            "animate-in slide-in-from-bottom duration-300",
            "pb-[env(safe-area-inset-bottom)]",
          )}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="px-4 pb-4">
            {/* Section 1: Acciones rápidas */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acciones rápidas
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PRIMARY_ACTIONS.map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handlePrimary(action.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4",
                    "transition-colors active:bg-accent",
                    "animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
                  )}
                  style={{
                    animationDelay: `${index * 40}ms`,
                    animationDuration: "200ms",
                  }}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full text-white",
                      action.bg,
                    )}
                  >
                    <action.icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="text-sm font-medium">{action.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {action.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Section 2: En esta página */}
            {contextActions && contextActions.length > 0 && (
              <>
                <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  En esta página
                </p>
                <div className="space-y-1">
                  {contextActions.map((action, index) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleContext(action.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-3",
                        "transition-colors active:bg-accent",
                        "animate-in fade-in slide-in-from-bottom-1 fill-mode-both",
                      )}
                      style={{
                        animationDelay: `${(PRIMARY_ACTIONS.length + index) * 40}ms`,
                        animationDuration: "200ms",
                      }}
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {action.icon}
                      </span>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {action.label}
                        </span>
                        {action.description && (
                          <span className="text-xs text-muted-foreground">
                            {action.description}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main FAB */}
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "fixed bottom-5 left-1/2 z-50 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 mb-[env(safe-area-inset-bottom)]",
          open && "rotate-45",
        )}
        aria-label={open ? "Cerrar menú" : "Abrir menu de acciones"}
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
```

Key changes from current implementation:
- **Types:** `FabAction` replaced by `PrimaryAction` ("transaction" | "import-pdf"). Old `ContextAction` (using `FabAction` id + Lucide icon component) replaced with new `ContextAction` (string id + `React.ReactNode` icon + optional description).
- **Props:** `onAction` split into `onPrimaryAction` + `onContextAction`. Context actions are now passed with their handlers separated.
- **UI:** Speed-dial sub-buttons replaced with a bottom sheet containing a 2-column grid ("Acciones rápidas") + a list ("En esta página").
- **Removed:** `SUB_ACTIONS` array (expense/income/transfer sub-buttons).
- **Kept:** Same FAB position, Plus-to-X rotation (45deg), `lg:hidden`, safe-area awareness, close on route change / Escape / backdrop tap.

- [ ] **Step 2: Verify no type errors in the component itself**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: Errors in `mobile-sheet-provider.tsx` (it still references old types) but NOT in `fab-menu.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/fab-menu.tsx
git commit -m "feat: replace FAB speed-dial with bottom sheet pattern

New bottom sheet with 2-col grid for primary actions (transaction + import PDF)
and a list section for contextual page-specific actions."
```

---

## Chunk 2: Update MobileSheetProvider

### Task 2: Update MobileSheetProvider to handle new action types

**Files:**
- Modify: `webapp/src/components/mobile/mobile-sheet-provider.tsx`

The current file (115 lines) has:
- Imports: `FabMenu`, `FabAction`, `ContextAction` from `./fab-menu`
- `TRANSACTION_ACTIONS` record keyed by `"expense" | "income" | "transfer"` mapping to `{ title, direction }`
- `getContextActions(pathname)` returning old-style `ContextAction[]` with `FabAction` id, Lucide icon component, bg color
- `getSheetTitle(action)` resolving sheet title from action
- Single `activeAction` state of type `FabAction | null`
- Sheet renders `MobileTransactionForm` (for expense/income/transfer), `RecurringForm`, or `SpecializedAccountForm` based on `activeAction`

- [ ] **Step 1: Rewrite mobile-sheet-provider.tsx with new action handling**

```typescript
// webapp/src/components/mobile/mobile-sheet-provider.tsx
"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarPlus, Landmark } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FabMenu,
  type PrimaryAction,
  type ContextAction,
} from "./fab-menu";
import { MobileTransactionForm } from "./mobile-transaction-form";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { SpecializedAccountForm } from "@/components/accounts/specialized-account-form";
import type {
  Account,
  CategoryWithChildren,
} from "@/types/domain";

interface MobileSheetProviderProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  children: React.ReactNode;
}

// Active sheet can be a primary action that opens a sheet, or a context action
type ActiveSheet = "transaction" | "new-recurring" | "new-account" | null;

function getSheetTitle(sheet: ActiveSheet): string {
  switch (sheet) {
    case "transaction":
      return "Nueva transacción";
    case "new-recurring":
      return "Nueva transacción recurrente";
    case "new-account":
      return "Nueva cuenta";
    default:
      return "";
  }
}

function getContextActions(pathname: string): ContextAction[] {
  if (pathname.startsWith("/recurrentes")) {
    return [
      {
        id: "new-recurring",
        icon: <CalendarPlus className="size-4" />,
        label: "Nuevo recurrente",
        description: "Plantilla de gasto o ingreso fijo",
      },
    ];
  }
  if (pathname === "/accounts") {
    return [
      {
        id: "new-account",
        icon: <Landmark className="size-4" />,
        label: "Nueva cuenta",
        description: "Cuenta bancaria o tarjeta",
      },
    ];
  }
  return [];
}

export function MobileSheetProvider({
  accounts,
  categories,
  children,
}: MobileSheetProviderProps) {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const pathname = usePathname();
  const router = useRouter();

  const contextActions = getContextActions(pathname);

  function handlePrimaryAction(action: PrimaryAction) {
    if (action === "transaction") {
      setActiveSheet("transaction");
    } else if (action === "import-pdf") {
      // Navigate to import page — no sheet needed
      router.push("/import");
    }
  }

  function handleContextAction(id: string) {
    if (id === "new-recurring" || id === "new-account") {
      setActiveSheet(id);
    }
  }

  return (
    <>
      {children}

      <FabMenu
        onPrimaryAction={handlePrimaryAction}
        contextActions={contextActions}
        onContextAction={handleContextAction}
      />

      <Sheet
        open={activeSheet !== null}
        onOpenChange={(open) => {
          if (!open) setActiveSheet(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>
              {activeSheet ? getSheetTitle(activeSheet) : ""}
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-4">
            {activeSheet === "transaction" && (
              <MobileTransactionForm
                key="transaction"
                accounts={accounts}
                categories={categories}
                onSuccess={() => setActiveSheet(null)}
              />
            )}

            {activeSheet === "new-recurring" && (
              <RecurringForm
                accounts={accounts}
                categories={categories}
                onSuccess={() => setActiveSheet(null)}
              />
            )}

            {activeSheet === "new-account" && (
              <SpecializedAccountForm
                onSuccess={() => setActiveSheet(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

Key changes from current implementation:
- **Imports:** `FabAction` and old `ContextAction` replaced with `PrimaryAction` and new `ContextAction` from `./fab-menu`.
- **`TRANSACTION_ACTIONS` record removed.** No longer mapping expense/income/transfer to direction. The single "transaction" action opens the form without a preset direction.
- **`ActiveSheet` type:** Replaces `FabAction | null`. Only includes actions that open a sheet ("transaction", "new-recurring", "new-account"). `"import-pdf"` does NOT open a sheet — it navigates.
- **`handlePrimaryAction`:** Routes "transaction" to sheet, "import-pdf" to `router.push("/import")`.
- **`handleContextAction`:** Maps context action IDs to sheets.
- **`getContextActions`:** Returns new `ContextAction` objects with `React.ReactNode` icons (rendered JSX) and optional `description`.
- **`MobileTransactionForm` call:** No longer passes `defaultDirection` or `isTransfer` — the form will handle direction selection internally (Chunk 3).
- **`getSheetTitle`:** Simplified switch on `ActiveSheet`. "transaction" shows "Nueva transacción" (generic, since direction is chosen in form).

- [ ] **Step 2: Verify types compile (expect errors in MobileTransactionForm until Chunk 3)**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: Error in `mobile-sheet-provider.tsx` because `MobileTransactionForm` still requires `defaultDirection` prop. This will be fixed in Chunk 3.

- [ ] **Step 3: Commit both provider and form together (atomic — avoids intermediate broken state)**

Do NOT commit yet — continue to Chunk 3 first. The provider references the updated form props, so both must be committed together. After Chunk 3 Step 1, commit both files:

```bash
git add webapp/src/components/mobile/mobile-sheet-provider.tsx webapp/src/components/mobile/mobile-transaction-form.tsx
git commit -m "feat: update MobileSheetProvider and TransactionForm for new FAB actions

- Handle 'transaction' (opens sheet) and 'import-pdf' (navigates to /import)
- Context actions use React.ReactNode icons with descriptions
- Remove old TRANSACTION_ACTIONS mapping
- Add direction selector to form for no-preset mode"
```

---

## Chunk 3: Update MobileTransactionForm

### Task 3: Add "no preset" mode with direction selector

**Files:**
- Modify: `webapp/src/components/mobile/mobile-transaction-form.tsx`

The current file (162 lines) has:
- `MobileTransactionFormProps`: requires `defaultDirection: TransactionDirection` and optional `isTransfer?: boolean`
- Hidden `<input name="direction" value={defaultDirection} />` on line 85
- `CategoryCombobox` receives `direction={defaultDirection}` on line 140
- Submit button text depends on `isTransfer` / `defaultDirection` (lines 152-158)

Changes needed:
1. Make `defaultDirection` optional in props
2. When no `defaultDirection` is provided, show a direction selector (Gasto / Ingreso / Transferencia) at the top of the form
3. The hidden `direction` input should use the selected direction state
4. `CategoryCombobox` should filter by the selected direction
5. Submit button text should reflect the selected direction

- [ ] **Step 1: Update the MobileTransactionForm with direction selector**

```typescript
// webapp/src/components/mobile/mobile-transaction-form.tsx
"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import {
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
} from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types/actions";
import type {
  Account,
  CategoryWithChildren,
  Transaction,
  TransactionDirection,
} from "@/types/domain";

interface MobileTransactionFormProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  defaultDirection?: TransactionDirection;
  isTransfer?: boolean;
  onSuccess?: () => void;
}

type TransactionType = "expense" | "income" | "transfer";

function directionFromType(type: TransactionType): TransactionDirection {
  return type === "income" ? "INFLOW" : "OUTFLOW";
}

const TRANSACTION_TYPES: {
  id: TransactionType;
  label: string;
  icon: typeof ArrowUpRight;
}[] = [
  { id: "expense", label: "Gasto", icon: ArrowUpRight },
  { id: "income", label: "Ingreso", icon: ArrowDownLeft },
  { id: "transfer", label: "Transferencia", icon: ArrowLeftRight },
];

export function MobileTransactionForm({
  accounts,
  categories,
  defaultDirection,
  isTransfer,
  onSuccess,
}: MobileTransactionFormProps) {
  // Determine initial transaction type from props (backward compat)
  const initialType: TransactionType = isTransfer
    ? "transfer"
    : defaultDirection === "INFLOW"
      ? "income"
      : "expense";

  const [transactionType, setTransactionType] =
    useState<TransactionType>(initialType);

  // Whether to show the type selector (only when no preset direction)
  const showTypeSelector = !defaultDirection;

  const direction = defaultDirection ?? directionFromType(transactionType);

  const [state, formAction, pending] = useActionState<
    ActionResult<Transaction>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await createTransaction(prevState, formData);
      if (result.success) onSuccess?.();
      return result;
    },
    { success: false, error: "" },
  );

  const STORAGE_KEY = "zeta:quick-capture-account";
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (typeof window === "undefined") return accounts[0]?.id ?? "";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && accounts.some((a) => a.id === saved)) return saved;
    return accounts[0]?.id ?? "";
  });

  useEffect(() => {
    if (selectedAccountId) {
      localStorage.setItem(STORAGE_KEY, selectedAccountId);
    }
  }, [selectedAccountId]);

  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Reset category when direction changes (categories are direction-filtered)
  useEffect(() => {
    setCategoryId(null);
  }, [transactionType]);

  const currencyCode = useMemo(() => {
    const account = accounts.find((a) => a.id === selectedAccountId);
    return account?.currency_code ?? "COP";
  }, [accounts, selectedAccountId]);

  const today = new Date().toISOString().split("T")[0];

  const submitLabel =
    transactionType === "transfer"
      ? "Registrar transferencia"
      : transactionType === "income"
        ? "Registrar ingreso"
        : "Registrar gasto";

  return (
    <form action={formAction} className="space-y-4">
      {!state.success && state.error && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {/* Hidden fields */}
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="transaction_date" value={today} />
      <input type="hidden" name="currency_code" value={currencyCode} />

      {/* Direction selector — only shown when no preset */}
      {showTypeSelector && (
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTransactionType(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                transactionType === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="mobile-amount">Monto</Label>
        <CurrencyInput
          id="mobile-amount"
          name="amount"
          placeholder="0"
          required
          autoFocus={!showTypeSelector}
          className="h-12 text-lg"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="mobile-merchant">Descripción</Label>
        <Input
          id="mobile-merchant"
          name="merchant_name"
          placeholder="Ej: Almuerzo, Uber, Arriendo..."
        />
      </div>

      {/* Account */}
      <div className="space-y-2">
        <Label htmlFor="mobile-account">Cuenta</Label>
        <Select
          name="account_id"
          value={selectedAccountId}
          onValueChange={setSelectedAccountId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar cuenta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Categoría</Label>
        <CategoryCombobox
          categories={categories}
          value={categoryId}
          onValueChange={setCategoryId}
          direction={direction}
          name="category_id"
        />
      </div>

      {/* Submit */}
      <Button type="submit" className="h-12 w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Guardando...
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
```

Key changes from current implementation:
- **`defaultDirection` is now optional** in `MobileTransactionFormProps` (was required).
- **New `TransactionType`** type: `"expense" | "income" | "transfer"` — internal to the component, used for the selector.
- **`directionFromType()` helper:** Maps transaction type to `TransactionDirection` ("INFLOW" | "OUTFLOW").
- **`showTypeSelector`:** Computed from `!defaultDirection`. When `true`, renders a segmented control with Gasto/Ingreso/Transferencia.
- **Direction selector UI:** A pill-style segmented control using `bg-muted` container with `bg-background` active state — same pattern used in other toggles in the app.
- **`categoryId` resets** when `transactionType` changes, so stale category selections don't persist across direction switches.
- **`autoFocus`:** Only auto-focuses the amount input when the type selector is NOT shown (i.e., when a preset direction is given). When the type selector is shown, the user first picks a type.
- **Backward compatibility preserved:** When `defaultDirection` is provided (e.g., from desktop or future callers), the form behaves exactly as before — no type selector shown, direction is fixed.

- [ ] **Step 2: Verify the full project compiles**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: No type errors. The `MobileSheetProvider` no longer passes `defaultDirection` to `MobileTransactionForm`, and the prop is now optional, so this is valid.

- [ ] **Step 3: Commit (atomic with Chunk 2)**

This was already committed in Chunk 2, Step 3 (both files together). Skip if already done, otherwise:

```bash
git add webapp/src/components/mobile/mobile-sheet-provider.tsx webapp/src/components/mobile/mobile-transaction-form.tsx
git commit -m "feat: update MobileSheetProvider and TransactionForm for new FAB actions"
```

---

## Chunk 4: Integration & Cleanup

### Task 4: Verify integration, remove dead exports, build check

**Files:**
- Modify: `webapp/src/components/mobile/fab-menu.tsx` (if needed — verify old `FabAction` type is no longer exported)
- No other files import from `fab-menu.tsx` besides `mobile-sheet-provider.tsx`

- [ ] **Step 1: Verify no other files reference old types**

Use the Grep tool to search for `FabAction` in `webapp/src/` with glob `*.{ts,tsx}`.

Expected: No results. The old `FabAction` type is no longer exported from `fab-menu.tsx`, and the only consumer (`mobile-sheet-provider.tsx`) has been updated. If any hits appear in other source files, update them.

Note: Results in `docs/` (plan files) are fine — those are documentation, not source code.

- [ ] **Step 2: Verify full build passes**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -20`

Expected: Build succeeds with no errors. This is the primary verification gate — it catches type errors, missing imports, and broken references across the entire project.

- [ ] **Step 3: Manual test checklist**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm dev`

Open the app on mobile viewport (or Chrome DevTools mobile simulation). Verify:

1. **FAB appears** at bottom center, same position as before
2. **Tap FAB** — bottom sheet slides up with rounded corners and drag handle
3. **Plus icon rotates 45deg** to become X when open
4. **"Acciones rápidas" section** shows 2-column grid:
   - Left: "Transacción" with "Gasto o ingreso" subtitle
   - Right: "Importar PDF" with "Extracto bancario" subtitle
5. **Tap "Transacción"** — sheet closes, transaction form sheet opens with direction selector (Gasto/Ingreso/Transferencia)
6. **Direction selector** — tap between Gasto/Ingreso/Transferencia, verify category list updates
7. **Submit a test transaction** — verify form works end-to-end
8. **Tap "Importar PDF"** — sheet closes, navigates to `/import` page
9. **Navigate to /recurrentes** — FAB sheet shows "En esta página" section with "Nuevo recurrente"
10. **Navigate to /accounts** — FAB sheet shows "En esta página" section with "Nueva cuenta"
11. **Dismiss methods:** tap backdrop, press Escape, navigate to another page — all close the sheet
12. **Desktop viewport** — FAB is hidden (`lg:hidden`)

- [ ] **Step 4: Final commit**

If any stale references were fixed:

```bash
git add webapp/src/components/mobile/fab-menu.tsx
git commit -m "chore: remove stale FabAction references"
```

If no changes needed, skip this step.

---

## Summary of Type Changes

| Before | After | Notes |
|--------|-------|-------|
| `FabAction = "expense" \| "income" \| "transfer" \| "new-recurring" \| "new-account"` | `PrimaryAction = "transaction" \| "import-pdf"` | Consolidated 3 transaction types into 1; import is primary |
| `ContextAction.id: FabAction` | `ContextAction.id: string` | Context actions are generic, not tied to primary action enum |
| `ContextAction.icon: typeof ArrowUpRight` | `ContextAction.icon: React.ReactNode` | Allows rendered JSX instead of component reference |
| `ContextAction.bg: string` | Removed | Sheet uses consistent muted styling, not colored circles |
| `FabMenuProps.onAction` | `FabMenuProps.onPrimaryAction` + `FabMenuProps.onContextAction` | Split handlers for primary vs context actions |
| `MobileTransactionFormProps.defaultDirection: TransactionDirection` (required) | `defaultDirection?: TransactionDirection` (optional) | Enables "no preset" mode with direction selector |
| `TRANSACTION_ACTIONS` record in provider | Removed | Direction selection moved into the transaction form itself |
