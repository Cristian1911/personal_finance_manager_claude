# Mobile Web UX Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile web experience (< 1024px) with a clean, card-contained design: new tab bar (4 tabs + center "+"), Focus/Digest dashboard modes, hub-pattern Plan and Deudas pages, and balanced brass/semantic color hierarchy.

**Architecture:** The mobile layout uses `lg:hidden` / `hidden lg:block` to split mobile and desktop rendering. We replace the mobile-only components inside these boundaries — desktop is untouched. New mobile components use a shared card container system (`m-card`, `m-card-tight`) and the color rules from the spec. Navigation changes from `PRIMARY_NAV` (4 items) to a new `MOBILE_NAV` (4 tabs + center "+").

**Tech Stack:** Next.js 15 App Router, Tailwind v4, shadcn/ui, Lucide icons, existing design tokens from `lib/constants/styles.ts`

**Spec:** `docs/superpowers/specs/2026-04-04-mobile-web-ux-redesign.md`
**Mockups:** `.superpowers/brainstorm/52480-1775340022/content/color-balanced.html` (final approved)

---

## File Structure

### New files
- `webapp/src/components/mobile/v2/mobile-card.tsx` — shared card container primitives (`MCard`, `MCardTight`, `MCardGrid`)
- `webapp/src/components/mobile/v2/mobile-tab-bar.tsx` — new 4-tab + center "+" tab bar
- `webapp/src/components/mobile/v2/mobile-header.tsx` — unified mobile top bar (ZETA wordmark + avatar, or page title + action)
- `webapp/src/components/mobile/v2/mobile-avatar-menu.tsx` — avatar dropdown (profile, settings, "Ver todo")
- `webapp/src/components/mobile/v2/dashboard-focus.tsx` — Focus mode dashboard (health ring + 2x2 + last transaction)
- `webapp/src/components/mobile/v2/dashboard-digest.tsx` — Digest mode dashboard (balance + attention + metrics + recents)
- `webapp/src/components/mobile/v2/movimientos-mobile.tsx` — transactions page (summary card + date-grouped lists)
- `webapp/src/components/mobile/v2/plan-hub.tsx` — Plan hub page (budget status + hub entries + distribution)
- `webapp/src/components/mobile/v2/deudas-hub.tsx` — Deudas hub page (cuota hero + usage gauge + interest + nearest payoff + hub entries)
- `webapp/src/components/mobile/v2/hub-entry.tsx` — reusable hub entry row (icon + title + hint + arrow)
- `webapp/src/lib/constants/mobile-nav.ts` — mobile navigation config (4 tabs + center action)

### Modified files
- `webapp/src/app/(dashboard)/layout.tsx` — swap BottomTabBar → MobileTabBar, MobileTopbar → MobileHeader, remove MobileSheetProvider wrapping FAB
- `webapp/src/app/(dashboard)/dashboard/page.tsx` — swap MobileDashboardV2 → DashboardFocus/DashboardDigest based on user config
- `webapp/src/app/(dashboard)/transactions/page.tsx` — swap mobile section → MovimientosMobile
- `webapp/src/app/(dashboard)/presupuesto/page.tsx` — add mobile-specific PlanHub section with `lg:hidden`
- `webapp/src/app/(dashboard)/deudas/page.tsx` — add mobile-specific DeudasHub section with `lg:hidden`
- `webapp/src/lib/constants/styles.ts` — add mobile card container tokens

### Preserved (not modified)
- `webapp/src/hooks/use-keyboard-inset.tsx` — still needed for tab bar/sheet hiding
- `webapp/src/hooks/use-media-query.ts` — still used by components
- `webapp/src/components/mobile/mobile-sheet-provider.tsx` — preserved but FAB integration changes
- `webapp/src/components/mobile/mobile-transaction-form.tsx` — reused by new "+" flow
- Desktop components — completely untouched

---

## Task 1: Mobile Card Container Primitives

**Files:**
- Create: `webapp/src/components/mobile/v2/mobile-card.tsx`
- Modify: `webapp/src/lib/constants/styles.ts`

- [ ] **Step 1: Add mobile card tokens to styles.ts**

```ts
// Add to webapp/src/lib/constants/styles.ts after PANEL_INSET_INTERACTIVE_CLASS

/** Mobile v2 card: inset container with figure/ground contrast */
export const MOBILE_CARD_CLASS =
  "rounded-[14px] border border-white/5 bg-[#161816] p-3";

/** Mobile v2 tight card: no padding, overflow hidden, for list containers */
export const MOBILE_CARD_TIGHT_CLASS =
  "rounded-[14px] border border-white/5 bg-[#161816] overflow-hidden";

/** Mobile v2 page background — applied to phone screen container */
export const MOBILE_BG_CLASS = "bg-[#0e100e]";

/** Mobile v2 eyebrow label */
export const MOBILE_EYEBROW_CLASS =
  "text-[8px] font-semibold uppercase tracking-[0.18em] text-[#6b7a5e]";

/** Mobile v2 action button (brass ghost) */
export const MOBILE_ACTION_BUTTON_CLASS =
  "text-[10px] font-semibold text-z-brass bg-z-brass/10 border border-z-brass/15 px-2.5 py-1 rounded-lg";
```

- [ ] **Step 2: Create mobile card components**

```tsx
// webapp/src/components/mobile/v2/mobile-card.tsx
import { cn } from "@/lib/utils";
import { MOBILE_CARD_CLASS, MOBILE_CARD_TIGHT_CLASS } from "@/lib/constants/styles";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function MCard({ className, ...props }: CardProps) {
  return <div className={cn(MOBILE_CARD_CLASS, className)} {...props} />;
}

export function MCardTight({ className, ...props }: CardProps) {
  return <div className={cn(MOBILE_CARD_TIGHT_CLASS, className)} {...props} />;
}

/** 2x2 grid inside a tight card with internal dividers */
export function MCardGrid({ children, className }: CardProps) {
  return (
    <MCardTight className={className}>
      <div className="grid grid-cols-2 [&>*]:p-3 [&>*]:text-center [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b [&>*]:border-white/4">
        {children}
      </div>
    </MCardTight>
  );
}

/** Row inside a MCardTight — handles dividers between rows */
export function MListRow({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-3.5 py-2.5 [&+&]:border-t [&+&]:border-white/4",
        className
      )}
      {...props}
    />
  );
}

/** Eyebrow label inside a tight card (with padding) */
export function MCardHeader({ children, className }: CardProps) {
  return (
    <div className={cn("px-3.5 pt-2.5 pb-1.5", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: clean build, no errors

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/mobile-card.tsx webapp/src/lib/constants/styles.ts
git commit -m "feat(mobile-v2): add card container primitives and style tokens"
```

---

## Task 2: Mobile Navigation Config

**Files:**
- Create: `webapp/src/lib/constants/mobile-nav.ts`

- [ ] **Step 1: Create mobile navigation config**

```ts
// webapp/src/lib/constants/mobile-nav.ts
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export type MobileTab = {
  title: string;
  href: string;
  icon: LucideIcon;
  matchHrefs?: string[];
};

/** 4 tabs shown in the mobile bottom bar — the "+" button is handled separately */
export const MOBILE_TABS: MobileTab[] = [
  { title: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { title: "Movim.", href: "/transactions", icon: ArrowLeftRight },
  // center "+" gap is rendered by the tab bar component, not in this array
  {
    title: "Plan",
    href: "/plan",
    matchHrefs: ["/presupuesto", "/recurrentes", "/deseos"],
    icon: PiggyBank,
  },
  {
    title: "Deudas",
    href: "/deudas",
    matchHrefs: ["/deudas/planificador"],
    icon: Landmark,
  },
];

export function isMobileTabActive(pathname: string, tab: MobileTab): boolean {
  const hrefs = [tab.href, ...(tab.matchHrefs ?? [])];
  return hrefs.some((h) => pathname === h || pathname.startsWith(`${h}/`));
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add webapp/src/lib/constants/mobile-nav.ts
git commit -m "feat(mobile-v2): add mobile navigation config (4 tabs + center action)"
```

---

## Task 3: Mobile Tab Bar

**Files:**
- Create: `webapp/src/components/mobile/v2/mobile-tab-bar.tsx`

- [ ] **Step 1: Create the new tab bar**

```tsx
// webapp/src/components/mobile/v2/mobile-tab-bar.tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { MOBILE_TABS, isMobileTabActive } from "@/lib/constants/mobile-nav";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { MobileTransactionForm } from "@/components/mobile/mobile-transaction-form";
import { cn } from "@/lib/utils";

type MobileTabBarProps = {
  accounts: { id: string; name: string; currency_code: string }[];
  categories: { id: string; name: string; parent_id: string | null }[];
};

export function MobileTabBar({ accounts, categories }: MobileTabBarProps) {
  const pathname = usePathname();
  const keyboardInset = useKeyboardInset();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (keyboardInset > 0) return null;

  const leftTabs = MOBILE_TABS.slice(0, 2);
  const rightTabs = MOBILE_TABS.slice(2);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/4 bg-[#0e100e]/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {leftTabs.map((tab) => {
          const active = isMobileTabActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px]",
                active ? "text-z-brass" : "text-[#4a4f4a]"
              )}
            >
              <tab.icon className="size-4" />
              {tab.title}
            </Link>
          );
        })}

        {/* Center "+" button */}
        <button
          onClick={() => setSheetOpen(true)}
          className="flex size-[34px] -mt-3 items-center justify-center rounded-full bg-z-brass text-z-ink shadow-lg"
          aria-label="Nueva transaccion"
        >
          <Plus className="size-5" strokeWidth={2.5} />
        </button>

        {rightTabs.map((tab) => {
          const active = isMobileTabActive(pathname, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px]",
                active ? "text-z-brass" : "text-[#4a4f4a]"
              )}
            >
              <tab.icon className="size-4" />
              {tab.title}
            </Link>
          );
        })}
      </nav>

      {/* New transaction sheet */}
      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>Nueva transaccion</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <MobileTransactionForm
              accounts={accounts}
              categories={categories}
              onSuccess={() => setSheetOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: clean build. Note: `MobileTransactionForm` may need the `onSuccess` prop added — check its signature and adjust if needed.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/mobile-tab-bar.tsx
git commit -m "feat(mobile-v2): new tab bar — 4 tabs + center plus button with transaction sheet"
```

---

## Task 4: Mobile Header + Avatar Menu

**Files:**
- Create: `webapp/src/components/mobile/v2/mobile-header.tsx`
- Create: `webapp/src/components/mobile/v2/mobile-avatar-menu.tsx`

- [ ] **Step 1: Create the avatar menu**

```tsx
// webapp/src/components/mobile/v2/mobile-avatar-menu.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, FileUp, Menu } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type AvatarMenuProps = {
  initials: string;
  fullName: string;
  email?: string;
};

export function MobileAvatarMenu({ initials, fullName, email }: AvatarMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex size-7 items-center justify-center rounded-full border border-z-brass/20 bg-[#161816] text-[10px] font-semibold text-z-brass"
          aria-label="Menu"
        >
          {initials}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-xl border border-z-brass/15 bg-[#161816] p-1.5 shadow-xl"
      >
        {/* Profile */}
        <div className="flex items-center gap-2.5 rounded-lg bg-z-brass/5 p-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-z-brass/15 text-[10px] font-bold text-z-brass">
            {initials}
          </div>
          <div>
            <div className="text-xs font-semibold text-[#e8e4dc]">{fullName}</div>
            {email && <div className="text-[9px] text-[#6b7a5e]">{email}</div>}
          </div>
        </div>

        <div className="my-1.5 h-px bg-white/4" />

        {/* Quick links */}
        <MenuLink href="/settings" icon={Settings} label="Ajustes" onNavigate={() => setOpen(false)} />
        <MenuLink href="/import" icon={FileUp} label="Importar extracto" onNavigate={() => setOpen(false)} />

        <div className="my-1.5 h-px bg-white/4" />

        {/* Ver todo */}
        <Link
          href="/menu"
          onClick={() => setOpen(false)}
          className="flex items-center justify-between rounded-lg p-2.5 hover:bg-white/3"
        >
          <div className="flex items-center gap-2.5">
            <Menu className="size-3.5 text-z-brass" />
            <span className="text-xs font-semibold text-z-brass">Ver todo</span>
          </div>
          <span className="text-xs text-[#4a4f4a]">›</span>
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-white/3"
    >
      <Icon className="size-3.5 text-[#6b7a5e]" />
      <span className="text-xs text-[#e8e4dc]">{label}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Create the mobile header**

```tsx
// webapp/src/components/mobile/v2/mobile-header.tsx
import { MobileAvatarMenu } from "./mobile-avatar-menu";

type MobileHeaderProps = {
  /** Show ZETA wordmark (dashboard) or page title (other pages) */
  variant: "dashboard" | "page";
  title?: string;
  subtitle?: string;
  /** Rendered on the right side — action button for page variant, avatar for dashboard */
  action?: React.ReactNode;
  /** Profile data for avatar menu (dashboard variant) */
  profile?: { initials: string; fullName: string; email?: string };
};

export function MobileHeader({ variant, title, subtitle, action, profile }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between px-4 lg:hidden">
      {variant === "dashboard" ? (
        <>
          <span className="text-xs font-bold tracking-[0.05em] text-[#6b7a5e]">ZETA</span>
          {profile && (
            <MobileAvatarMenu
              initials={profile.initials}
              fullName={profile.fullName}
              email={profile.email}
            />
          )}
        </>
      ) : (
        <>
          <div>
            <div className="text-[17px] font-bold text-[#e8e4dc]">{title}</div>
            {subtitle && <div className="text-[10px] text-[#6b7a5e]">{subtitle}</div>}
          </div>
          {action}
        </>
      )}
    </header>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/mobile-header.tsx webapp/src/components/mobile/v2/mobile-avatar-menu.tsx
git commit -m "feat(mobile-v2): mobile header with ZETA wordmark + avatar dropdown menu"
```

---

## Task 5: Hub Entry Component

**Files:**
- Create: `webapp/src/components/mobile/v2/hub-entry.tsx`

- [ ] **Step 1: Create the hub entry component**

```tsx
// webapp/src/components/mobile/v2/hub-entry.tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type HubEntryProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  hint: React.ReactNode;
  className?: string;
};

export function HubEntry({ href, icon: Icon, title, hint, className }: HubEntryProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center rounded-[14px] border border-white/5 bg-[#161816] p-3.5",
        className
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-z-brass/10">
        <Icon className="size-4 text-z-brass" />
      </div>
      <div className="ml-2.5 flex-1">
        <div className="text-[13px] font-semibold text-[#e8e4dc]">{title}</div>
        <div className="mt-0.5 text-[10px] text-[#6b7a5e]">{hint}</div>
      </div>
      <span className="text-sm text-[#4a4f4a]">›</span>
    </Link>
  );
}
```

- [ ] **Step 2: Verify build and commit**

Run: `cd webapp && pnpm build`

```bash
git add webapp/src/components/mobile/v2/hub-entry.tsx
git commit -m "feat(mobile-v2): reusable hub entry component for Plan and Deudas"
```

---

## Task 6: Dashboard Focus Mode

**Files:**
- Create: `webapp/src/components/mobile/v2/dashboard-focus.tsx`

- [ ] **Step 1: Create Focus mode dashboard**

```tsx
// webapp/src/components/mobile/v2/dashboard-focus.tsx
import { MCard, MCardGrid, MListRow, MCardTight } from "./mobile-card";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

type FocusProps = {
  healthScore: number;
  availableToSpend: number;
  budgetPercent: number;
  pendingCount: number;
  debtFreeMonths: number | null;
  lastTransaction: { description: string; amount: number } | null;
  currency: string;
};

export function DashboardFocus({
  healthScore,
  availableToSpend,
  budgetPercent,
  pendingCount,
  debtFreeMonths,
  lastTransaction,
  currency,
}: FocusProps) {
  const budgetColor = budgetPercent >= 100 ? "text-red-500" : budgetPercent >= 75 ? "text-amber-400" : "text-emerald-500";

  return (
    <div className="flex flex-col gap-2 px-1">
      {/* Health ring */}
      <MCard className="flex items-center justify-center py-5">
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r="46" fill="none" stroke="#1a1c1a" strokeWidth="6" />
          <circle
            cx="55" cy="55" r="46" fill="none"
            stroke="#c4a94d" strokeWidth="6"
            strokeDasharray={289}
            strokeDashoffset={289 - (289 * healthScore) / 100}
            strokeLinecap="round"
            transform="rotate(-90 55 55)"
            opacity="0.8"
          />
          <text x="55" y="52" textAnchor="middle" fill="#e8e4dc" fontSize="28" fontWeight="800">
            {healthScore}
          </text>
          <text x="55" y="66" textAnchor="middle" fill="#6b7a5e" fontSize="8" letterSpacing="0.1em">
            DE 100
          </text>
        </svg>
      </MCard>

      {/* 2x2 metrics */}
      <MCardGrid>
        <div>
          <div className="text-[17px] font-bold tabular-nums text-[#e8e4dc]">
            {formatCurrency(availableToSpend, currency, { compact: true })}
          </div>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>Disponible</div>
        </div>
        <div>
          <div className={cn("text-[17px] font-bold tabular-nums", budgetColor)}>
            {budgetPercent}%
          </div>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>Plan</div>
        </div>
        <div className="relative">
          {pendingCount > 0 && (
            <div className="absolute right-2 top-2 size-[5px] rounded-full bg-z-brass" />
          )}
          <div className="text-[17px] font-bold tabular-nums text-[#e8e4dc]">{pendingCount}</div>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>Pendientes</div>
        </div>
        <div>
          <div className="text-[17px] font-bold tabular-nums text-[#e8e4dc]">
            {debtFreeMonths != null ? `${debtFreeMonths}m` : "—"}
          </div>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>Libre deuda</div>
        </div>
      </MCardGrid>

      {/* Last transaction */}
      {lastTransaction && (
        <MCard>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mb-1")}>ULTIMO</div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#e8e4dc]">{lastTransaction.description}</span>
            <span className="text-xs font-medium tabular-nums text-[#e8e4dc]">
              {formatCurrency(lastTransaction.amount, currency)}
            </span>
          </div>
        </MCard>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: clean build. If `formatCurrency` doesn't have a `compact` option, replace with the standard call and let the number display as-is (the component can be adjusted during integration).

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/dashboard-focus.tsx
git commit -m "feat(mobile-v2): Focus mode dashboard — health ring + 2x2 metrics + last transaction"
```

---

## Task 7: Dashboard Digest Mode

**Files:**
- Create: `webapp/src/components/mobile/v2/dashboard-digest.tsx`

- [ ] **Step 1: Create Digest mode dashboard**

```tsx
// webapp/src/components/mobile/v2/dashboard-digest.tsx
import { MCard, MCardTight, MListRow, MCardHeader } from "./mobile-card";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

type AttentionItem = {
  id: string;
  label: string;
  href: string;
  priority: "action" | "suggestion";
};

type RecentTx = {
  id: string;
  description: string;
  amount: number;
};

type DigestProps = {
  firstName: string;
  availableToSpend: number;
  committedAmount: number;
  daysToNextPayment: number | null;
  attentionItems: AttentionItem[];
  budgetPercent: number;
  healthScore: number;
  debtFreeMonths: number | null;
  recentTransactions: RecentTx[];
  currency: string;
};

export function DashboardDigest({
  firstName,
  availableToSpend,
  committedAmount,
  daysToNextPayment,
  attentionItems,
  budgetPercent,
  healthScore,
  debtFreeMonths,
  recentTransactions,
  currency,
}: DigestProps) {
  return (
    <div className="flex flex-col gap-2 px-1">
      {/* Greeting */}
      <div className="px-1.5">
        <div className="text-[13px] text-[#6b7a5e]">Hola {firstName}</div>
      </div>

      {/* Hero balance */}
      <MCard className="py-5 text-center">
        <div className={cn(MOBILE_EYEBROW_CLASS, "mb-1.5")}>DISPONIBLE</div>
        <div className="text-[34px] font-extrabold tabular-nums text-[#e8e4dc]">
          {formatCurrency(availableToSpend, currency)}
        </div>
        <div className="mt-1 text-xs text-[#6b7a5e]">
          {formatCurrency(committedAmount, currency, { compact: true })} comprometidos
          {daysToNextPayment != null && ` · proximo pago en ${daysToNextPayment}d`}
        </div>
      </MCard>

      {/* Attention items */}
      {attentionItems.length > 0 && (
        <MCardTight>
          <MCardHeader>
            <span className={cn(MOBILE_EYEBROW_CLASS, "text-z-brass")}>ATENCION</span>
          </MCardHeader>
          {attentionItems.map((item) => (
            <MListRow key={item.id}>
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    item.priority === "action" ? "bg-z-brass" : "bg-red-500"
                  )}
                />
                <span className="text-[13px] text-[#e8e4dc]">{item.label}</span>
              </div>
              <span className="text-[13px] text-[#4a4f4a]">›</span>
            </MListRow>
          ))}
        </MCardTight>
      )}

      {/* Metrics strip */}
      <MCard className="flex items-center justify-around py-3.5">
        <MetricCell label="Plan" value={`${budgetPercent}%`} />
        <div className="h-8 w-px bg-white/6" />
        <MetricCell label="Salud" value={String(healthScore)} />
        <div className="h-8 w-px bg-white/6" />
        <MetricCell label="Libre" value={debtFreeMonths != null ? `${debtFreeMonths}m` : "—"} />
      </MCard>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <MCardTight>
          <MCardHeader>
            <span className={MOBILE_EYEBROW_CLASS}>RECIENTES</span>
          </MCardHeader>
          {recentTransactions.slice(0, 3).map((tx) => (
            <MListRow key={tx.id}>
              <span className="text-[13px] text-[#e8e4dc]">{tx.description}</span>
              <span className="text-[13px] font-medium tabular-nums text-[#e8e4dc]">
                {formatCurrency(tx.amount, currency)}
              </span>
            </MListRow>
          ))}
        </MCardTight>
      )}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold tabular-nums text-[#e8e4dc]">{value}</div>
      <div className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and commit**

Run: `cd webapp && pnpm build`

```bash
git add webapp/src/components/mobile/v2/dashboard-digest.tsx
git commit -m "feat(mobile-v2): Digest mode dashboard — balance hero + attention + metrics + recents"
```

---

## Task 8: Movimientos Mobile

**Files:**
- Create: `webapp/src/components/mobile/v2/movimientos-mobile.tsx`

- [ ] **Step 1: Create the transactions mobile view**

```tsx
// webapp/src/components/mobile/v2/movimientos-mobile.tsx
import { MCard, MCardTight, MListRow } from "./mobile-card";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

type Transaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  category_name?: string | null;
  is_income: boolean;
};

type MovimientosProps = {
  transactions: Transaction[];
  totalExpenses: number;
  totalIncome: number;
  totalCount: number;
  currency: string;
};

export function MovimientosMobile({
  transactions,
  totalExpenses,
  totalIncome,
  totalCount,
  currency,
}: MovimientosProps) {
  // Group transactions by date
  const grouped = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const dateKey = tx.date;
    const group = grouped.get(dateKey) ?? [];
    group.push(tx);
    grouped.set(dateKey, group);
  }

  return (
    <div className="flex flex-col gap-2 px-1">
      {/* Summary card */}
      <MCard className="flex items-center justify-around py-3">
        <div className="text-center">
          <div className="text-[13px] font-bold tabular-nums text-[#e8e4dc]">
            {formatCurrency(totalExpenses, currency, { compact: true })}
          </div>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>Gastos</div>
        </div>
        <div className="h-8 w-px bg-white/6" />
        <div className="text-center">
          <div className="text-[13px] font-bold tabular-nums text-emerald-500">
            {formatCurrency(totalIncome, currency, { compact: true })}
          </div>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>Ingresos</div>
        </div>
        <div className="h-8 w-px bg-white/6" />
        <div className="text-center">
          <div className="text-[13px] font-bold tabular-nums text-[#e8e4dc]">{totalCount}</div>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>Total</div>
        </div>
      </MCard>

      {/* Date-grouped lists */}
      {[...grouped.entries()].map(([dateKey, txs]) => (
        <div key={dateKey}>
          <div className={cn(MOBILE_EYEBROW_CLASS, "mb-1 px-1")}>
            {formatDate(new Date(dateKey), "short-weekday")}
          </div>
          <MCardTight>
            {txs.map((tx) => (
              <MListRow key={tx.id}>
                <div>
                  <div className="text-[11px] text-[#e8e4dc]">{tx.description}</div>
                  <div className={cn("text-[9px]", tx.category_name ? "text-[#6b7a5e]" : "text-z-brass")}>
                    {tx.category_name ?? "Sin categoria"}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    tx.is_income ? "text-emerald-500" : "text-[#e8e4dc]"
                  )}
                >
                  {tx.is_income ? "+" : ""}{formatCurrency(tx.amount, currency)}
                </span>
              </MListRow>
            ))}
          </MCardTight>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build and commit**

Run: `cd webapp && pnpm build`
Note: `formatDate` may need a `"short-weekday"` format — check the function signature and adjust the format string to match an existing option (likely `"short"` or `"EEE, dd MMM"`).

```bash
git add webapp/src/components/mobile/v2/movimientos-mobile.tsx
git commit -m "feat(mobile-v2): transactions mobile — summary card + date-grouped contained lists"
```

---

## Task 9: Plan Hub

**Files:**
- Create: `webapp/src/components/mobile/v2/plan-hub.tsx`

- [ ] **Step 1: Create Plan hub page**

```tsx
// webapp/src/components/mobile/v2/plan-hub.tsx
import { LayoutGrid, CalendarDays } from "lucide-react";
import { MCard } from "./mobile-card";
import { HubEntry } from "./hub-entry";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

type PlanHubProps = {
  budgetPercent: number;
  spent: number;
  total: number;
  dailyAvailable: number;
  daysRemaining: number;
  overBudgetCount: number;
  nextPaymentName: string | null;
  nextPaymentDays: number | null;
  /** Which allocation style the user configured */
  allocationStyle: "50_30_20" | "ynab" | "per_category";
  /** Distribution bars: [{ label, percent, color }] */
  distribution: { label: string; percent: number; color: string }[];
  currency: string;
};

export function PlanHub({
  budgetPercent,
  spent,
  total,
  dailyAvailable,
  daysRemaining,
  overBudgetCount,
  nextPaymentName,
  nextPaymentDays,
  allocationStyle,
  distribution,
  currency,
}: PlanHubProps) {
  const statusColor =
    budgetPercent >= 100
      ? "text-red-500"
      : budgetPercent >= 75
        ? "text-amber-400"
        : "text-emerald-500";
  const barColor =
    budgetPercent >= 100
      ? "bg-red-500"
      : budgetPercent >= 75
        ? "bg-amber-400"
        : "bg-emerald-500";
  const statusLabel =
    budgetPercent >= 100
      ? "Sobre el ritmo"
      : budgetPercent >= 75
        ? "Al limite"
        : "Holgado";

  const styleLabel =
    allocationStyle === "50_30_20"
      ? "50/30/20"
      : allocationStyle === "ynab"
        ? "Ritmo YNAB"
        : "Por categoria";

  return (
    <div className="flex flex-col gap-2 px-1">
      {/* Budget health */}
      <MCard className="p-3.5">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className={cn(MOBILE_EYEBROW_CLASS, "mb-1")}>GASTADO ESTE MES</div>
            <div className={cn("text-[26px] font-extrabold tabular-nums", statusColor)}>
              {budgetPercent}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-semibold tabular-nums text-[#e8e4dc]">
              {formatCurrency(spent, currency, { compact: true })}
            </div>
            <div className="text-[9px] text-[#6b7a5e]">
              de {formatCurrency(total, currency, { compact: true })}
            </div>
          </div>
        </div>
        <div className="h-[5px] w-full rounded-full bg-[#1a1c1a] overflow-hidden">
          <div
            className={cn("h-full rounded-full", barColor)}
            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[9px] text-[#6b7a5e]">
            {formatCurrency(dailyAvailable, currency, { compact: true })}/dia disponible
          </span>
          <span
            className={cn("text-[8px] font-semibold rounded-md px-1.5 py-0.5", {
              "bg-emerald-500/10 text-emerald-500": budgetPercent < 75,
              "bg-amber-400/10 text-amber-400": budgetPercent >= 75 && budgetPercent < 100,
              "bg-red-500/10 text-red-500": budgetPercent >= 100,
            })}
          >
            {statusLabel}
          </span>
        </div>
      </MCard>

      {/* Hub entries */}
      <HubEntry
        href="/presupuesto"
        icon={LayoutGrid}
        title="Presupuesto"
        hint={
          overBudgetCount > 0 ? (
            <><span className="text-red-500">{overBudgetCount} categorias</span> sobre el ritmo</>
          ) : (
            "Todas las categorias en buen ritmo"
          )
        }
      />
      <HubEntry
        href="/recurrentes"
        icon={CalendarDays}
        title="Pagos y compromisos"
        hint={
          nextPaymentName && nextPaymentDays != null
            ? `${nextPaymentName} en ${nextPaymentDays} dias`
            : "Sin pagos proximos"
        }
      />

      {/* Distribution */}
      <MCard className="mt-0.5">
        <div className="flex items-center justify-between mb-2">
          <span className={MOBILE_EYEBROW_CLASS}>DISTRIBUCION</span>
          <span className="text-[8px] font-semibold rounded-md bg-white/4 px-1.5 py-0.5 text-[#8a9a7b]">
            {styleLabel}
          </span>
        </div>
        {distribution.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5 py-1">
            <span className="w-12 text-right text-[9px] text-[#8a9a7b]">{d.label}</span>
            <div className="flex-1 h-3 rounded bg-[#1a1c1a] overflow-hidden">
              <div
                className="h-full rounded flex items-center justify-end pr-1"
                style={{ width: `${d.percent}%`, backgroundColor: d.color }}
              >
                {d.percent >= 12 && (
                  <span className="text-[7px] font-semibold text-[#121412]">{d.percent}%</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </MCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and commit**

Run: `cd webapp && pnpm build`

```bash
git add webapp/src/components/mobile/v2/plan-hub.tsx
git commit -m "feat(mobile-v2): Plan hub — budget health + hub entries + dynamic distribution"
```

---

## Task 10: Deudas Hub

**Files:**
- Create: `webapp/src/components/mobile/v2/deudas-hub.tsx`

- [ ] **Step 1: Create Deudas hub page**

```tsx
// webapp/src/components/mobile/v2/deudas-hub.tsx
import { LayoutGrid, BarChart3 } from "lucide-react";
import { MCard } from "./mobile-card";
import { HubEntry } from "./hub-entry";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

type DeudasHubProps = {
  monthlyPayment: number;
  monthlyInterest: number;
  cardUsagePercent: number;
  cardUsedAmount: number;
  cardTotalCupo: number;
  cardInterestMonthly: number;
  totalInterestMonthly: number;
  nearestPayoff: {
    name: string;
    remaining: number;
    months: number;
    progressPercent: number;
  } | null;
  accountCount: number;
  currency: string;
};

export function DeudasHub({
  monthlyPayment,
  monthlyInterest,
  cardUsagePercent,
  cardUsedAmount,
  cardTotalCupo,
  cardInterestMonthly,
  totalInterestMonthly,
  nearestPayoff,
  accountCount,
  currency,
}: DeudasHubProps) {
  const capitalAmount = monthlyPayment - monthlyInterest;
  const capitalPercent = monthlyPayment > 0 ? (capitalAmount / monthlyPayment) * 100 : 0;
  const cardInterestPercent =
    totalInterestMonthly > 0
      ? Math.round((cardInterestMonthly / totalInterestMonthly) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-2 px-1">
      {/* Monthly debt cost hero */}
      <MCard className="p-3.5">
        <div className="flex items-start justify-between">
          <div>
            <div className={cn(MOBILE_EYEBROW_CLASS, "mb-1")}>CUOTA MENSUAL</div>
            <div className="text-[28px] font-extrabold tabular-nums text-[#e8e4dc]">
              {formatCurrency(monthlyPayment, currency, { compact: true })}
            </div>
          </div>
          <div className="pt-3 text-right">
            <div className="text-base font-bold tabular-nums text-red-500">
              {formatCurrency(monthlyInterest, currency, { compact: true })}
            </div>
            <div className="text-[9px] text-red-500">intereses</div>
          </div>
        </div>
        <div className="mt-2 flex h-[5px] overflow-hidden rounded-full">
          <div className="rounded-l-full bg-[#e8e4dc]" style={{ width: `${capitalPercent}%` }} />
          <div className="rounded-r-full bg-red-500" style={{ width: `${100 - capitalPercent}%` }} />
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-[8px] text-[#6b7a5e]">
            {formatCurrency(capitalAmount, currency, { compact: true })} capital
          </span>
          <span className="text-[8px] text-red-500">
            {formatCurrency(monthlyInterest, currency, { compact: true })} intereses
          </span>
        </div>
      </MCard>

      {/* Card usage gauge */}
      <MCard>
        <div className="flex items-center justify-between mb-1.5">
          <span className={MOBILE_EYEBROW_CLASS}>USO DE TARJETAS</span>
          <span className="text-[11px] font-bold tabular-nums text-z-brass">
            {cardUsagePercent}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#1a1c1a]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(cardUsagePercent, 100)}%`,
              background: "linear-gradient(to right, #4ade80, #c4a94d, #ef4444)",
            }}
          />
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-[9px] tabular-nums text-[#e8e4dc]">
            {formatCurrency(cardUsedAmount, currency, { compact: true })}{" "}
            <span className="text-[#6b7a5e]">usado</span>
          </span>
          <span className="text-[9px] tabular-nums text-[#e8e4dc]">
            {formatCurrency(cardTotalCupo, currency, { compact: true })}{" "}
            <span className="text-[#6b7a5e]">cupo</span>
          </span>
        </div>
      </MCard>

      {/* Credit card interest */}
      <MCard>
        <div className="flex items-center justify-between">
          <div>
            <div className={cn(MOBILE_EYEBROW_CLASS, "mb-1")}>INTERESES TARJETAS / MES</div>
            <div className="text-lg font-bold tabular-nums text-red-500">
              {formatCurrency(cardInterestMonthly, currency, { compact: true })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#6b7a5e]">
              de {formatCurrency(totalInterestMonthly, currency, { compact: true })} total
            </div>
            <div className="text-[11px] font-semibold tabular-nums text-[#e8e4dc]">
              {cardInterestPercent}%
            </div>
          </div>
        </div>
      </MCard>

      {/* Nearest payoff */}
      {nearestPayoff && (
        <MCard className="border-emerald-500/10">
          <div className={cn(MOBILE_EYEBROW_CLASS, "mb-1 text-emerald-500")}>
            CREDITO MAS CERCANO A PAGAR
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-[#e8e4dc]">{nearestPayoff.name}</div>
              <div className="text-[10px] text-[#6b7a5e]">
                {formatCurrency(nearestPayoff.remaining, currency, { compact: true })} restante
              </div>
            </div>
            <div className="text-right">
              <div className="text-[15px] font-bold tabular-nums text-emerald-500">
                {nearestPayoff.months}m
              </div>
              <div className="text-[8px] text-[#6b7a5e]">para saldar</div>
            </div>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#1a1c1a]">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${nearestPayoff.progressPercent}%` }}
            />
          </div>
        </MCard>
      )}

      {/* Hub entries */}
      <HubEntry
        href="/deudas/detalle"
        icon={LayoutGrid}
        title="Ver todas las deudas"
        hint="Detalle por cuenta"
        className="mt-0.5"
      />
      <HubEntry
        href="/deudas/planificador"
        icon={BarChart3}
        title="Simular escenarios"
        hint="Avalancha, bola de nieve, extras"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build and commit**

Run: `cd webapp && pnpm build`

```bash
git add webapp/src/components/mobile/v2/deudas-hub.tsx
git commit -m "feat(mobile-v2): Deudas hub — cuota hero + card usage + interest + nearest payoff + hub entries"
```

---

## Task 11: Integrate Into Layout (Tab Bar + Header)

**Files:**
- Modify: `webapp/src/app/(dashboard)/layout.tsx`

This is the most critical integration step — swap the old mobile shell (topbar, tab bar, FAB) for the new v2 components.

- [ ] **Step 1: Read the current layout**

Run: Read `webapp/src/app/(dashboard)/layout.tsx` in full to understand the current structure before modifying.

- [ ] **Step 2: Replace mobile shell components**

In the layout file, make these changes:
1. Import `MobileTabBar` from `@/components/mobile/v2/mobile-tab-bar` instead of `BottomTabBar`
2. Import `MobileHeader` from `@/components/mobile/v2/mobile-header` instead of `MobileTopbar`
3. Replace the `<MobileTopbar>` usage with `<MobileHeader variant="dashboard" profile={...} />`
4. Replace the `<BottomTabBar>` usage with `<MobileTabBar accounts={accounts} categories={categories} />`
5. Keep `KeyboardInsetProvider` wrapping
6. Keep `MobileSheetProvider` but remove the FAB-related props if they exist (the "+" is now in the tab bar)

The exact edits depend on the current file structure — read first, then make surgical changes. Do NOT modify any `hidden lg:block` desktop sections.

- [ ] **Step 3: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: clean build. If there are prop mismatches, fix them.

- [ ] **Step 4: Test visually**

Run: `cd webapp && pnpm dev`, open browser at mobile width (375px), navigate between tabs. Verify:
- Tab bar shows 4 tabs + center "+"
- Tapping "+" opens transaction sheet
- ZETA wordmark + avatar appear on dashboard
- Page titles + action buttons appear on other pages
- Keyboard hides tab bar when focused on input

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/(dashboard)/layout.tsx
git commit -m "feat(mobile-v2): swap layout shell — new tab bar + header replacing old topbar + FAB"
```

---

## Task 12: Integrate Dashboard Page

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Read the current dashboard page**

Read the full file to understand how `MobileDashboardV2` is rendered and what data it receives.

- [ ] **Step 2: Replace mobile dashboard section**

Find the `<div className="lg:hidden">` section that renders `MobileDashboardV2`. Replace it with:

```tsx
<div className="lg:hidden">
  {dashboardConfig?.mobile_mode === "digest" ? (
    <DashboardDigest
      firstName={profile.full_name?.split(" ")[0] ?? ""}
      availableToSpend={availableToSpend}
      committedAmount={pendingFixed}
      daysToNextPayment={daysToNextPayment}
      attentionItems={attentionSignals.map(s => ({
        id: s.id,
        label: s.title,
        href: s.href,
        priority: s.priority,
      }))}
      budgetPercent={budgetPercent}
      healthScore={healthScore}
      debtFreeMonths={debtFreeMonths}
      recentTransactions={recentTransactions.map(tx => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
      }))}
      currency={currency}
    />
  ) : (
    <DashboardFocus
      healthScore={healthScore}
      availableToSpend={availableToSpend}
      budgetPercent={budgetPercent}
      pendingCount={attentionSignals.length}
      debtFreeMonths={debtFreeMonths}
      lastTransaction={recentTransactions[0] ? {
        description: recentTransactions[0].description,
        amount: recentTransactions[0].amount,
      } : null}
      currency={currency}
    />
  )}
</div>
```

Adjust prop names to match what the page already computes — the variable names above are approximate. Read the page data flow first.

- [ ] **Step 3: Verify build passes and test visually**

Run: `cd webapp && pnpm build`
Then dev server: verify Focus mode renders by default. Check the 2x2 grid, health ring, last transaction.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(mobile-v2): integrate Focus/Digest dashboard modes"
```

---

## Task 13: Integrate Transactions Page

**Files:**
- Modify: `webapp/src/app/(dashboard)/transactions/page.tsx`

- [ ] **Step 1: Read the current transactions page**

Understand the mobile section and what data `MobileMovimientos` receives.

- [ ] **Step 2: Replace mobile section**

Find the `<div className="... lg:hidden">` section. Replace `MobileMovimientos` (and the PageHero above it) with:

```tsx
<div className="lg:hidden">
  <MobileHeader
    variant="page"
    title="Movimientos"
    subtitle={`${monthLabel} ${year}`}
    action={<button className={MOBILE_ACTION_BUTTON_CLASS}>Filtros</button>}
  />
  <MovimientosMobile
    transactions={transactions.map(tx => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      category_name: tx.category_name,
      is_income: tx.amount > 0,
    }))}
    totalExpenses={totalExpenses}
    totalIncome={totalIncome}
    totalCount={transactions.length}
    currency={currency}
  />
</div>
```

Adjust to match actual data variable names from the page.

- [ ] **Step 3: Verify build, test visually, commit**

Run: `cd webapp && pnpm build`

```bash
git add webapp/src/app/(dashboard)/transactions/page.tsx
git commit -m "feat(mobile-v2): integrate contained transactions list"
```

---

## Task 14: Integrate Plan Hub

**Files:**
- Modify: `webapp/src/app/(dashboard)/presupuesto/page.tsx` or `webapp/src/app/(dashboard)/plan/page.tsx`

- [ ] **Step 1: Identify the correct Plan page**

The tab points to `/plan`. Check if `webapp/src/app/(dashboard)/plan/page.tsx` exists. If not, it may redirect to `/presupuesto`. Read the routing to understand where the Plan hub should live.

- [ ] **Step 2: Add mobile Plan hub section**

Add a `<div className="lg:hidden">` section that renders `<PlanHub>` with data fetched from the server component. If the page doesn't exist yet, create `webapp/src/app/(dashboard)/plan/page.tsx` as a server component that fetches budget data and renders PlanHub for mobile, existing desktop content for desktop.

The data needed:
- `budgetPercent`, `spent`, `total` — from budget actions
- `dailyAvailable`, `daysRemaining` — computed from budget data
- `overBudgetCount` — count of categories over 100%
- `nextPaymentName`, `nextPaymentDays` — from upcoming payments
- `allocationStyle` — from user's profile/budget config
- `distribution` — computed from allocation data

- [ ] **Step 3: Verify build, test visually, commit**

Run: `cd webapp && pnpm build`

```bash
git add webapp/src/app/(dashboard)/plan/page.tsx
git commit -m "feat(mobile-v2): integrate Plan hub with budget status + distribution"
```

---

## Task 15: Integrate Deudas Hub

**Files:**
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`

- [ ] **Step 1: Read the current deudas page**

Understand the data already being fetched (hero data, quick stats, account cards).

- [ ] **Step 2: Add mobile Deudas hub section**

Find where the mobile rendering starts (likely after `MobilePageHeader`). Wrap the existing mobile content in a `<div className="lg:hidden">` and replace with `<DeudasHub>`:

```tsx
<div className="lg:hidden">
  <MobileHeader variant="page" title="Deudas" subtitle={`${accountCount} cuentas activas`} />
  <DeudasHub
    monthlyPayment={monthlyPayment}
    monthlyInterest={monthlyInterest}
    cardUsagePercent={cardUtilization}
    cardUsedAmount={cardUsed}
    cardTotalCupo={cardTotal}
    cardInterestMonthly={cardInterest}
    totalInterestMonthly={totalInterest}
    nearestPayoff={nearestPayoff}
    accountCount={accountCount}
    currency={currency}
  />
</div>
```

Map the existing variables to the component props — the page already computes most of this data for the desktop view.

- [ ] **Step 3: Verify build, test visually, commit**

Run: `cd webapp && pnpm build`

```bash
git add webapp/src/app/(dashboard)/deudas/page.tsx
git commit -m "feat(mobile-v2): integrate Deudas hub with KPIs and hub entries"
```

---

## Task 16: Final Build Gate + Visual QA

- [ ] **Step 1: Run full build**

```bash
cd webapp && pnpm install && pnpm build
```
Must pass clean.

- [ ] **Step 2: Visual QA at mobile viewport**

Open dev server, set browser to 375x812. Walk through:
1. Dashboard (Focus mode) — health ring, 2x2, last tx
2. Movimientos — summary card, date-grouped lists in cards
3. Plan — budget health, hub entries, distribution bars
4. Deudas — cuota hero, card usage, interest, nearest payoff, hub entries
5. Tab bar — all 4 tabs navigate correctly, "+" opens sheet
6. Avatar menu — opens, links work, "Ver todo" navigates
7. Desktop at 1440px — verify NOTHING changed on desktop

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git commit -m "fix(mobile-v2): visual QA fixes"
```
