# Mobile UX Rebuild — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the mobile experience with a bottom tab bar, FAB quick-capture, and purpose-built mobile views for each section — while keeping the desktop sidebar layout unchanged.

**Architecture:** Parallel mobile shell. The existing `layout.tsx` adds mobile chrome (bottom tabs, FAB, mobile topbar) alongside the desktop chrome (sidebar, topbar). Both render the same `{children}` — each page uses CSS classes (`lg:hidden` / `hidden lg:block`) to show mobile vs desktop content. No JavaScript viewport detection needed.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4, shadcn/ui (Sheet, Popover), lucide-react, existing server actions and data layer.

**Design doc:** `docs/plans/2026-03-09-mobile-ux-rebuild-design.md`

---

## Phase 1: Mobile Shell

### Task 1: Bottom Tab Bar Component

**Files:**
- Create: `webapp/src/components/mobile/bottom-tab-bar.tsx`

**Step 1: Create bottom tab bar**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Repeat2, PiggyBank, Wrench } from "lucide-react";

interface BottomTabBarProps {
  uncategorizedCount?: number;
}

const TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { href: "/recurrentes", icon: Repeat2, label: "Recurrentes" },
  // [+] FAB goes in the center — handled by FabMenu, not a tab
  { href: "/categories", icon: PiggyBank, label: "Presupuesto" },
  { href: "/gestionar", icon: Wrench, label: "Gestionar" },
] as const;

export function BottomTabBar({ uncategorizedCount = 0 }: BottomTabBarProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab, i) => {
          const isActive = pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <>
              {/* Leave gap for FAB in center (after 2nd tab) */}
              {i === 2 && <div className="w-14" />}
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
                  {tab.href === "/categories" && uncategorizedCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {uncategorizedCount > 9 ? "9+" : uncategorizedCount}
                    </span>
                  )}
                </span>
                <span className="font-medium">{tab.label}</span>
              </Link>
            </>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build succeeds. Component not yet wired into layout.

**Step 3: Commit**

```bash
git add src/components/mobile/bottom-tab-bar.tsx
git commit -m "feat: bottom tab bar component for mobile navigation"
```

---

### Task 2: FAB Menu Component

**Files:**
- Create: `webapp/src/components/mobile/fab-menu.tsx`

**Step 1: Create FAB with sub-actions**

The FAB sits in the center gap of the bottom tab bar. Tap expands 3 sub-actions upward with a backdrop. Each sub-action opens a Sheet (handled by the parent via callbacks).

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

export type FabAction = "expense" | "income" | "transfer";

interface FabMenuProps {
  onAction: (action: FabAction) => void;
}

const SUB_ACTIONS = [
  { id: "transfer" as const, icon: ArrowLeftRight, label: "Transferencia", color: "bg-blue-500" },
  { id: "income" as const, icon: ArrowDownLeft, label: "Ingreso", color: "bg-green-500" },
  { id: "expense" as const, icon: ArrowUpRight, label: "Gasto rápido", color: "bg-orange-500" },
];

export function FabMenu({ onAction }: FabMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 animate-in fade-in-0"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sub-actions */}
      <div
        className={cn(
          "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 transition-all duration-200 pb-[env(safe-area-inset-bottom)]",
          open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {SUB_ACTIONS.map((action, i) => (
          <button
            key={action.id}
            onClick={() => {
              setOpen(false);
              onAction(action.id);
            }}
            className="flex items-center gap-3 animate-in slide-in-from-bottom-2"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-sm font-medium text-white whitespace-nowrap bg-black/70 rounded-full px-3 py-1">
              {action.label}
            </span>
            <span className={cn("flex size-10 items-center justify-center rounded-full text-white shadow-lg", action.color)}>
              <action.icon className="size-5" />
            </span>
          </button>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 mb-[env(safe-area-inset-bottom)]",
          open && "rotate-45"
        )}
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/components/mobile/fab-menu.tsx
git commit -m "feat: FAB menu with sub-actions for quick transaction capture"
```

---

### Task 3: Mobile Topbar Component

**Files:**
- Create: `webapp/src/components/mobile/mobile-topbar.tsx`

**Step 1: Create mobile topbar**

Simplified topbar for mobile — greeting + avatar. No hamburger menu (bottom tabs handle nav).

```tsx
import { UserMenu } from "@/components/layout/user-menu";
import type { Profile } from "@/types/domain";

interface MobileTopbarProps {
  profile: Profile;
}

export function MobileTopbar({ profile }: MobileTopbarProps) {
  const firstName = profile.full_name?.split(" ")[0] ?? "Hola";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4 lg:hidden">
      <span className="text-sm font-medium text-muted-foreground">
        Hola, {firstName}
      </span>
      <UserMenu profile={profile} />
    </header>
  );
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/components/mobile/mobile-topbar.tsx
git commit -m "feat: simplified mobile topbar with greeting"
```

---

### Task 4: Integrate Mobile Shell into Dashboard Layout

**Files:**
- Modify: `webapp/src/app/(dashboard)/layout.tsx`

**Step 1: Read the current layout**

Read `webapp/src/app/(dashboard)/layout.tsx` to understand the exact current structure.

**Step 2: Add mobile chrome alongside desktop chrome**

The layout currently renders:
```
<div flex min-h-screen>
  <Sidebar />           ← hidden on mobile (lg:flex)
  <div flex-1 flex-col>
    <Topbar />           ← has MobileNav hamburger
    <main>{children}</main>
  </div>
</div>
```

Modify to add bottom tab bar, FAB, and mobile topbar. Keep existing desktop layout intact:

- Import new components: `BottomTabBar`, `FabMenu`, `MobileTopbar`, `MobileSheetProvider`
- Add `<MobileTopbar>` (lg:hidden) — the existing Topbar already has `MobileNav` which is `lg:hidden`, but we want to replace the hamburger with the simple greeting on mobile
- Add `<BottomTabBar>` after main content
- Add `<MobileSheetProvider>` wrapping children (handles FAB sheet state)
- Add bottom padding to main on mobile: `pb-20 lg:pb-6` (space for tab bar)
- The existing `<Topbar>` should be hidden on mobile: add `hidden lg:block` to it
- The `<MobileTopbar>` shows on mobile: already has `lg:hidden`

The layout should look like:

```tsx
<div className="flex min-h-screen">
  <Sidebar uncategorizedCount={uncategorizedCount} />

  <div className="flex flex-1 flex-col">
    {/* Desktop topbar */}
    <div className="hidden lg:block">
      <Topbar profile={profile} uncategorizedCount={uncategorizedCount} />
    </div>

    {/* Mobile topbar */}
    <MobileTopbar profile={profile} />

    <main className="flex-1 overflow-x-hidden p-4 lg:p-6 pb-20 lg:pb-6">
      <MobileSheetProvider accounts={accounts} categories={categories}>
        {children}
      </MobileSheetProvider>
    </main>

    {/* Mobile bottom navigation */}
    <BottomTabBar uncategorizedCount={uncategorizedCount} />
  </div>
</div>
```

Note: `MobileSheetProvider` is a client component created in Task 5 that manages FAB sheet state. The `accounts` and `categories` data are needed for the transaction forms inside the FAB sheets.

Fetch `accounts` and `categories` in the layout alongside existing data:

```tsx
const [uncategorizedCount, profile, accounts, categories] = await Promise.all([
  getUncategorizedCount(),
  getProfile(),      // already fetched
  getAccounts(),
  getCategories(),
]);
```

Reference existing imports: `getAccounts` from `@/actions/accounts`, `getCategories` from `@/actions/categories`.

**Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: May fail if `MobileSheetProvider` doesn't exist yet — that's OK, we create it in Task 5.

**Step 4: Commit (after Task 5)**

---

### Task 5: FAB Sheet Provider (Transaction Forms)

**Files:**
- Create: `webapp/src/components/mobile/mobile-sheet-provider.tsx`

**Step 1: Create the provider**

Client component wrapping children. Renders the FAB + Sheet forms for expense/income/transfer. When a FAB sub-action is tapped, opens the corresponding sheet.

```tsx
"use client";

import { useState, useActionState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FabMenu, type FabAction } from "./fab-menu";
import { MobileTransactionForm } from "./mobile-transaction-form";
import { createTransaction } from "@/actions/transactions";
import type { Account, CategoryWithChildren } from "@/types/domain";
import type { TransactionDirection } from "@/types/domain";

interface MobileSheetProviderProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  children: React.ReactNode;
}

const ACTION_CONFIG: Record<FabAction, { title: string; direction: TransactionDirection }> = {
  expense: { title: "Gasto rápido", direction: "OUTFLOW" },
  income: { title: "Ingreso", direction: "INFLOW" },
  transfer: { title: "Transferencia", direction: "OUTFLOW" },
};

export function MobileSheetProvider({ accounts, categories, children }: MobileSheetProviderProps) {
  const [activeAction, setActiveAction] = useState<FabAction | null>(null);

  const config = activeAction ? ACTION_CONFIG[activeAction] : null;

  return (
    <>
      {children}

      <FabMenu onAction={(action) => setActiveAction(action)} />

      <Sheet open={activeAction !== null} onOpenChange={(open) => !open && setActiveAction(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{config?.title ?? ""}</SheetTitle>
          </SheetHeader>
          {config && (
            <MobileTransactionForm
              accounts={accounts}
              categories={categories}
              defaultDirection={config.direction}
              isTransfer={activeAction === "transfer"}
              onSuccess={() => setActiveAction(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
```

**Step 2: Create mobile transaction form**

**Files:**
- Create: `webapp/src/components/mobile/mobile-transaction-form.tsx`

A compact form for the bottom sheet. Based on the existing `TransactionForm` (`webapp/src/components/transactions/transaction-form.tsx`) but simplified for mobile:

```tsx
"use client";

import { useActionState, useState } from "react";
import { createTransaction } from "@/actions/transactions";
import { CurrencyInput } from "@/components/ui/currency-input";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account, CategoryWithChildren, TransactionDirection } from "@/types/domain";
import type { ActionResult } from "@/types/actions";
import type { Transaction } from "@/types/domain";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface MobileTransactionFormProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  defaultDirection: TransactionDirection;
  isTransfer?: boolean;
  onSuccess?: () => void;
}

export function MobileTransactionForm({
  accounts,
  categories,
  defaultDirection,
  isTransfer = false,
  onSuccess,
}: MobileTransactionFormProps) {
  const [direction, setDirection] = useState<TransactionDirection>(defaultDirection);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState<ActionResult<Transaction>, FormData>(
    async (prevState, formData) => {
      const result = await createTransaction(prevState, formData);
      if (result.status === "success") {
        onSuccess?.();
      }
      return result;
    },
    { status: "idle" } as unknown as ActionResult<Transaction>
  );

  const defaultAccountId = (() => {
    if (typeof window === "undefined") return accounts[0]?.id ?? "";
    return localStorage.getItem("zeta:quick-capture-default-account") ?? accounts[0]?.id ?? "";
  })();

  return (
    <form action={formAction} className="space-y-4 pt-4">
      {/* Amount — most important, largest */}
      <div className="space-y-2">
        <Label htmlFor="mobile-amount">Monto</Label>
        <CurrencyInput
          name="amount"
          id="mobile-amount"
          placeholder="0"
          className="h-12 text-lg"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="mobile-desc">Descripción</Label>
        <Input
          name="merchant_name"
          id="mobile-desc"
          placeholder="Ej: Almuerzo, Uber, Arriendo..."
        />
      </div>

      {/* Account */}
      <div className="space-y-2">
        <Label>Cuenta</Label>
        <Select name="account_id" defaultValue={defaultAccountId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar cuenta" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
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
          triggerClassName="w-full"
        />
      </div>

      {/* Hidden fields */}
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="transaction_date" value={format(new Date(), "yyyy-MM-dd")} />
      <input type="hidden" name="currency_code" value={accounts.find(a => a.id === defaultAccountId)?.currency_code ?? "COP"} />

      {/* Error */}
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {/* Submit */}
      <Button type="submit" className="w-full h-12" disabled={pending}>
        {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
        Guardar
      </Button>
    </form>
  );
}
```

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Commit (together with Task 4)**

```bash
git add src/components/mobile/ src/app/\(dashboard\)/layout.tsx
git commit -m "feat: mobile shell — bottom tabs, FAB, transaction sheets, layout integration"
```

---

## Phase 2: Mobile Page Views

### Task 6: Gestionar Page

**Files:**
- Create: `webapp/src/app/(dashboard)/gestionar/page.tsx`

**Step 1: Create the gestionar page**

New page with a 2×2 grid of action cards. This page is mainly for mobile but works on desktop too.

```tsx
import Link from "next/link";
import { FileUp, Repeat2, Wallet, Settings } from "lucide-react";

const ACTIONS = [
  { href: "/import", icon: FileUp, label: "Importar PDF", description: "Subir extracto bancario" },
  { href: "/recurrentes", icon: Repeat2, label: "Recurrentes", description: "Plantillas y pagos fijos" },
  { href: "/accounts", icon: Wallet, label: "Cuentas", description: "Administrar cuentas" },
  { href: "/settings", icon: Settings, label: "Ajustes", description: "Configuración general" },
] as const;

export default function GestionarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Gestionar</h1>

      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-center transition-colors hover:bg-muted/50 active:bg-muted"
          >
            <action.icon className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-[11px] text-muted-foreground">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/gestionar/page.tsx
git commit -m "feat: gestionar page — action cards grid for admin tasks"
```

---

### Task 7: Mobile Dashboard View

**Files:**
- Create: `webapp/src/components/mobile/mobile-dashboard.tsx`
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create mobile dashboard component**

Client component receiving server-fetched data. Shows: hero → upcoming payments → recent activity. Widgets deferred to Phase 3.

```tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CalendarClock } from "lucide-react";
import type { DashboardHeroData } from "@/actions/dashboard";
import type { UpcomingRecurrence } from "@/types/domain";

interface MobileDashboardProps {
  heroData: DashboardHeroData;
  upcomingPayments: UpcomingRecurrence[];
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    currency_code: string;
    direction: "INFLOW" | "OUTFLOW";
    date: string;
    category_name?: string;
    category_icon?: string;
  }>;
}

export function MobileDashboard({ heroData, upcomingPayments, recentTransactions }: MobileDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Hero — available money */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Disponible para gastar</p>
        <p className={cn(
          "text-3xl font-bold tracking-tight mt-1",
          heroData.availableToSpend < 0 && "text-destructive"
        )}>
          {formatCurrency(heroData.availableToSpend, "COP")}
        </p>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span>Saldo: {formatCurrency(heroData.totalBalance, "COP")}</span>
          <span>Fijos: {formatCurrency(heroData.pendingFixed, "COP")}</span>
        </div>
      </div>

      {/* Upcoming payments */}
      {upcomingPayments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarClock className="size-4 text-muted-foreground" />
              Próximos pagos
            </h2>
            <Link href="/recurrentes" className="text-xs text-primary flex items-center gap-0.5">
              Ver todos <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingPayments.slice(0, 5).map((item) => (
              <div key={`${item.template.id}-${item.next_date}`} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.template.merchant_name ?? item.template.description ?? "Sin nombre"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.next_date)}</p>
                </div>
                <span className="text-sm font-semibold shrink-0">
                  {formatCurrency(item.template.amount, item.template.currency_code)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Actividad reciente</h2>
          <Link href="/transactions" className="text-xs text-primary flex items-center gap-0.5">
            Ver todos <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="space-y-1">
          {recentTransactions.slice(0, 5).map((tx) => (
            <Link key={tx.id} href={`/transactions/${tx.id}`}>
              <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50 transition-colors">
                <span className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  tx.direction === "INFLOW" ? "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400" : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                )}>
                  {tx.direction === "INFLOW" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(tx.date)}
                    {tx.category_name && ` · ${tx.category_name}`}
                  </p>
                </div>
                <span className={cn(
                  "text-sm font-semibold shrink-0",
                  tx.direction === "INFLOW" && "text-green-600 dark:text-green-400"
                )}>
                  {tx.direction === "OUTFLOW" ? "-" : "+"}
                  {formatCurrency(tx.amount, tx.currency_code)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
```

**Step 2: Modify dashboard page to render mobile view**

Read `webapp/src/app/(dashboard)/dashboard/page.tsx` first. Then wrap the existing desktop content with `hidden lg:block` and add the mobile view with `lg:hidden`.

The page already fetches `heroData` and recent transactions. Also fetch upcoming recurring payments for the mobile view:

```tsx
// Add import:
import { MobileDashboard } from "@/components/mobile/mobile-dashboard";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";

// In the data fetch Promise.all, add:
const upcoming = await getUpcomingRecurrences();
```

Then in the render:

```tsx
return (
  <div>
    {/* Mobile dashboard */}
    <div className="lg:hidden">
      <MobileDashboard
        heroData={heroData}
        upcomingPayments={upcoming}
        recentTransactions={recentTxRows}
      />
    </div>

    {/* Desktop dashboard (existing) */}
    <div className="hidden lg:block space-y-6">
      {/* ... existing desktop content unchanged ... */}
    </div>
  </div>
);
```

Note: Check if `getUpcomingRecurrences` exists in `@/actions/recurring-templates`. If not, create a simple server action that fetches the next 5 upcoming occurrences across all active templates. It should use `getOccurrencesBetween` from `@zeta/shared` to find the next occurrence date for each template, sort by date, and return the top 5.

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Commit**

```bash
git add src/components/mobile/mobile-dashboard.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: mobile dashboard — hero, upcoming payments, recent activity"
```

---

### Task 8: Mobile Presupuesto View

**Files:**
- Create: `webapp/src/components/mobile/mobile-presupuesto.tsx`
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx`

**Step 1: Create mobile presupuesto component**

Combines the categorization inbox (inline quick-assign) at the top with budget progress below.

```tsx
"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { categorizeTransaction } from "@/actions/categorize";
import { AlertTriangle, Check } from "lucide-react";
import type { CategoryBudgetData } from "@/types/domain";
import type { TransactionWithRelations, CategoryWithChildren } from "@/types/domain";
import { toast } from "sonner";

// Icon map — reuse from budget-category-card.tsx
import {
  Home, Utensils, Car, HeartPulse, Sparkles, Shield, Briefcase, Tag,
  Gamepad2, GraduationCap, Gift, Plane, Phone, Shirt, Dumbbell,
  Repeat, PiggyBank, Landmark,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home, utensils: Utensils, car: Car, "heart-pulse": HeartPulse,
  sparkles: Sparkles, shield: Shield, briefcase: Briefcase, tag: Tag,
  gamepad2: Gamepad2, "graduation-cap": GraduationCap, gift: Gift,
  plane: Plane, phone: Phone, shirt: Shirt, dumbbell: Dumbbell,
  repeat: Repeat, "piggy-bank": PiggyBank, landmark: Landmark,
};

interface MobilePresupuestoProps {
  uncategorized: TransactionWithRelations[];
  categories: CategoryWithChildren[];
  budgetCategories: CategoryBudgetData[];
}

export function MobilePresupuesto({ uncategorized, categories, budgetCategories }: MobilePresupuestoProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visibleUncategorized = uncategorized.filter((tx) => !dismissed.has(tx.id));

  const handleCategorize = (txId: string, categoryId: string) => {
    startTransition(async () => {
      const result = await categorizeTransaction(txId, categoryId);
      if (result.status === "success") {
        setDismissed((prev) => new Set([...prev, txId]));
        toast.success("Categorizado");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Categorization inbox */}
      {visibleUncategorized.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold">
              {visibleUncategorized.length} sin categoría
            </h2>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            {visibleUncategorized.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "Sin descripción"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatCurrency(tx.amount, tx.currency_code)}
                  </p>
                </div>
                <div className="shrink-0 w-36">
                  <CategoryCombobox
                    categories={categories}
                    value={null}
                    onValueChange={(id) => id && handleCategorize(tx.id, id)}
                    direction={tx.direction}
                    triggerClassName="w-full h-8 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Budget progress */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Presupuestos</h2>
        <div className="space-y-3">
          {budgetCategories.map((cat) => {
            if (!cat.budget_amount) return null;
            const pct = Math.min(Math.round((cat.spent / cat.budget_amount) * 100), 100);
            const IconComp = ICON_MAP[cat.icon ?? "tag"] ?? Tag;

            return (
              <div key={cat.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="flex size-7 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    <IconComp className="size-3.5" />
                  </span>
                  <span className="text-sm font-medium flex-1">{cat.name_es ?? cat.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(cat.spent, "COP")} / {formatCurrency(cat.budget_amount, "COP")}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pct < 70 ? "bg-green-500" : pct < 90 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```

**Step 2: Modify categories page**

Read `webapp/src/app/(dashboard)/categories/page.tsx` first. Wrap existing desktop content with `hidden lg:block`, add mobile view with `lg:hidden`.

The page already fetches budget data. Additionally fetch uncategorized transactions:

```tsx
import { MobilePresupuesto } from "@/components/mobile/mobile-presupuesto";
import { getUncategorizedTransactions } from "@/actions/categorize";

// Add to existing data fetch:
const uncategorized = await getUncategorizedTransactions();
```

Render both views:

```tsx
return (
  <div>
    <div className="lg:hidden">
      <MobilePresupuesto
        uncategorized={uncategorized}
        categories={categories}
        budgetCategories={outflowCategories}
      />
    </div>
    <div className="hidden lg:block">
      {/* ... existing desktop tabs content ... */}
    </div>
  </div>
);
```

**Step 3: Check `categorizeTransaction` action**

Verify `categorizeTransaction` exists in `@/actions/categorize`. It should accept `(txId: string, categoryId: string)` and update the transaction's category. If it doesn't exist by that name, find the equivalent action that assigns a category to a transaction and use that.

**Step 4: Verify build**

Run: `cd webapp && pnpm build`

**Step 5: Commit**

```bash
git add src/components/mobile/mobile-presupuesto.tsx src/app/\(dashboard\)/categories/page.tsx
git commit -m "feat: mobile presupuesto — inline categorization inbox + budget progress"
```

---

### Task 9: Mobile Movimientos View

**Files:**
- Create: `webapp/src/components/mobile/mobile-movimientos.tsx`
- Modify: `webapp/src/app/(dashboard)/transactions/page.tsx`

**Step 1: Create mobile movimientos component**

Summary header (gastos/ingresos + category chips) + date-grouped transaction feed.

```tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Transaction } from "@/types/domain";
import { useMemo } from "react";

interface MobileMovimientosProps {
  transactions: Transaction[];
  monthTotals: { inflow: number; outflow: number };
  categoryBreakdown: Array<{ id: string; name: string; icon: string; color: string; total: number }>;
}

export function MobileMovimientos({ transactions, monthTotals, categoryBreakdown }: MobileMovimientosProps) {
  // Group transactions by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const date = tx.transaction_date;
      const group = groups.get(date) ?? [];
      group.push(tx);
      groups.set(date, group);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* Month summary */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Gastos</p>
            <p className="font-semibold text-orange-600 dark:text-orange-400">
              {formatCurrency(monthTotals.outflow, "COP")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Ingresos</p>
            <p className="font-semibold text-green-600 dark:text-green-400">
              {formatCurrency(monthTotals.inflow, "COP")}
            </p>
          </div>
        </div>

        {/* Category chips */}
        {categoryBreakdown.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            {categoryBreakdown.slice(0, 6).map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                {formatCurrency(cat.total, "COP")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Date-grouped feed */}
      {groupedByDate.map(([date, txs]) => (
        <section key={date}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
            {formatDate(date)}
          </h3>
          <div className="space-y-1">
            {txs.map((tx) => (
              <Link key={tx.id} href={`/transactions/${tx.id}`}>
                <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50 transition-colors">
                  <span className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    tx.direction === "INFLOW"
                      ? "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
                      : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                  )}>
                    {tx.direction === "INFLOW" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "Sin descripción"}
                    </p>
                  </div>
                  <span className={cn(
                    "text-sm font-semibold shrink-0",
                    tx.direction === "INFLOW" && "text-green-600 dark:text-green-400"
                  )}>
                    {tx.direction === "OUTFLOW" ? "-" : "+"}
                    {formatCurrency(tx.amount, tx.currency_code)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {transactions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No hay movimientos este mes</p>
      )}
    </div>
  );
}
```

**Step 2: Modify transactions page**

Read `webapp/src/app/(dashboard)/transactions/page.tsx`. Wrap existing desktop content with `hidden lg:block`, add mobile view with `lg:hidden`.

The page already fetches transactions. Compute month totals and category breakdown from the transaction data:

```tsx
import { MobileMovimientos } from "@/components/mobile/mobile-movimientos";

// After fetching transactions, compute:
const monthTotals = {
  inflow: transactions.filter(t => t.direction === "INFLOW" && !t.is_excluded).reduce((s, t) => s + t.amount, 0),
  outflow: transactions.filter(t => t.direction === "OUTFLOW" && !t.is_excluded).reduce((s, t) => s + t.amount, 0),
};
```

For `categoryBreakdown`, aggregate spending by category from the transactions data. This logic may need a helper or could be done inline.

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Commit**

```bash
git add src/components/mobile/mobile-movimientos.tsx src/app/\(dashboard\)/transactions/page.tsx
git commit -m "feat: mobile movimientos — summary header + date-grouped feed"
```

---

## Phase 3: Sub-Page Navigation & Polish

### Task 10: Mobile Sub-Page Header

**Files:**
- Create: `webapp/src/components/mobile/mobile-page-header.tsx`

**Step 1: Create reusable back-arrow header**

For sub-pages (transaction detail, account detail, import wizard, settings) that are navigated to from the main tabs.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobilePageHeaderProps {
  title: string;
  backHref?: string;
  children?: React.ReactNode;
}

export function MobilePageHeader({ title, backHref, children }: MobilePageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 mb-4 lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => backHref ? router.push(backHref) : router.back()}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
      {children}
    </div>
  );
}
```

**Step 2: Apply to sub-pages**

Add `<MobilePageHeader>` to these pages (only visible on mobile, `lg:hidden`):

- `app/(dashboard)/accounts/[id]/page.tsx` — title: account name, back to `/accounts` or `/gestionar`
- `app/(dashboard)/transactions/[id]/page.tsx` — title: "Detalle", back to `/transactions`
- `app/(dashboard)/settings/page.tsx` — title: "Ajustes", back to `/gestionar`
- `app/(dashboard)/import/page.tsx` — title: "Importar Extracto", back to `/gestionar`
- `app/(dashboard)/accounts/page.tsx` — title: "Cuentas", back to `/gestionar`

Each page already has a desktop header. Add the mobile header before it, using `lg:hidden` on the mobile header and `hidden lg:block` (or `hidden lg:flex`) on the existing desktop header.

**Step 3: Verify build**

Run: `cd webapp && pnpm build`

**Step 4: Commit**

```bash
git add src/components/mobile/mobile-page-header.tsx src/app/
git commit -m "feat: mobile back-arrow headers for sub-pages"
```

---

### Task 11: Hide Desktop Headers on Mobile

**Files:**
- Modify: Multiple page files

**Step 1: Audit and fix desktop-only headers**

Several pages have header rows (title + buttons) that are designed for desktop. On mobile, these should either:
- Be hidden if the mobile view has its own header
- Be simplified (remove fixed widths, add `flex-wrap`)

Pages to check and update:
- `dashboard/page.tsx` — desktop header (title + month selector) should be `hidden lg:flex`
- `categories/page.tsx` — tabs header should be `hidden lg:block`
- `transactions/page.tsx` — header row should be `hidden lg:flex`, mobile gets a simpler view
- `recurrentes/page.tsx` — header should be `hidden lg:flex`, mobile already works via timeline view
- `deudas/page.tsx` — add `MobilePageHeader` with back to `/gestionar`

For each, add `hidden lg:flex` or `hidden lg:block` to the desktop header div, and if a `MobilePageHeader` is needed, add one.

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/app/
git commit -m "fix: hide desktop headers on mobile, show mobile page headers"
```

---

### Task 12: Update Navigation Constants

**Files:**
- Modify: `webapp/src/lib/constants/navigation.ts`

**Step 1: Add Gestionar to navigation**

Read the file first. Add the Gestionar route so it works with any navigation helpers:

```tsx
// Add to MAIN_NAV:
{ href: "/gestionar", label: "Gestionar", icon: Wrench },
```

Import `Wrench` from lucide-react.

**Step 2: Verify build**

Run: `cd webapp && pnpm build`

**Step 3: Commit**

```bash
git add src/lib/constants/navigation.ts
git commit -m "feat: add gestionar route to navigation constants"
```

---

### Task 13: Full Build Verification & Visual Check

**Step 1: Run full build**

```bash
cd webapp && pnpm build
```

Fix any type errors or missing imports.

**Step 2: Start dev server and test mobile**

```bash
cd webapp && pnpm dev
```

Open Chrome DevTools → Toggle device toolbar → iPhone 14 (390px) → test each tab:
1. `/dashboard` — hero + upcoming + recent activity
2. `/recurrentes` — timeline view
3. FAB [+] — tap, see sub-actions, open expense form
4. `/categories` — inbox + budget progress
5. `/gestionar` — 4 action cards
6. Navigate to `/transactions` from dashboard "Ver todos"
7. Navigate to sub-pages (account detail, settings) — back arrow works

**Step 3: Fix visual issues**

Address any overflow, spacing, or interaction issues found during testing.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: mobile UX polish from visual testing"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Shell | 1-5 | Bottom tabs, FAB with transaction sheets, layout integration |
| 2: Views | 6-9 | Gestionar page, mobile dashboard, presupuesto, movimientos |
| 3: Polish | 10-13 | Sub-page headers, header visibility, nav constants, verification |

**Future phases (separate plan):**
- Phase 4: Dashboard widget system + settings UI
- Phase 5: Animations and transitions (spring physics, haptics)
- Phase 6: PWA enhancements (manifest, splash, offline shell)
