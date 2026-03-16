# UI Polish Bundle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 independent UI improvements — vaul bottom sheet, KPIWidget, page transitions, and large amount input.

**Architecture:** Each feature is a self-contained component added to the UI toolkit, then wired into existing pages. No database changes. All features are independent and can be committed separately.

**Tech Stack:** vaul (new dep), framer-motion (existing), shadcn/ui patterns, Tailwind v4, Zeta brand tokens.

---

## Task 1: Vaul Bottom Sheet

**Files:**
- Modify: `webapp/package.json` (add vaul)
- Create: `webapp/src/components/ui/drawer.tsx`
- Modify: `webapp/src/components/mobile/fab-menu.tsx`
- Modify: `webapp/src/components/mobile/mobile-sheet-provider.tsx`

- [ ] **Step 1: Install vaul**

```bash
cd webapp && pnpm add vaul
```

- [ ] **Step 2: Create drawer component**

Create `webapp/src/components/ui/drawer.tsx` following shadcn drawer pattern. Vaul's `Drawer` component with Zeta styling:

```tsx
"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn("fixed inset-0 z-50 bg-black/50", className)}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-2xl border-t",
          className
        )}
        {...props}
      >
        {/* Drag handle */}
        <div className="mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 px-4 pb-2", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerOverlay,
  DrawerPortal,
};
```

- [ ] **Step 3: Migrate FAB bottom sheet to vaul**

In `webapp/src/components/mobile/fab-menu.tsx`:
- Remove the custom bottom sheet implementation (backdrop, fixed bottom sheet div, animations)
- Replace with `Drawer` from the new component
- Keep the FAB button as-is (hidden when drawer is open)
- The drawer handles: drag-to-dismiss, backdrop, snap points, animation

Key changes:
- `open` state drives `Drawer`'s `open` prop
- Remove `pb-[env(safe-area-inset-bottom)]` and custom `style={{ bottom: "calc(3.5rem + ...)" }}` — vaul handles positioning
- Keep the primary/context action content as drawer children
- Add `snapPoints={[0.4, 0.7]}` for multi-height: short (just quick actions) and tall (with context actions)

- [ ] **Step 4: Migrate mobile sheet provider to vaul**

In `webapp/src/components/mobile/mobile-sheet-provider.tsx`:
- Replace `Sheet`/`SheetContent` (side="bottom") with `Drawer`/`DrawerContent`
- Keep `Sheet` import available for any desktop-only usage
- `DrawerContent` replaces the `max-h-[85vh] overflow-y-auto rounded-t-2xl` classes (vaul handles these)

```tsx
// Before
<Sheet open={activeSheet !== null} onOpenChange={...}>
  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
    ...
  </SheetContent>
</Sheet>

// After
<Drawer open={activeSheet !== null} onOpenChange={...}>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>{activeSheet ? getSheetTitle(activeSheet) : ""}</DrawerTitle>
    </DrawerHeader>
    <div className="overflow-y-auto px-4 pb-4">
      {/* same form content */}
    </div>
  </DrawerContent>
</Drawer>
```

- [ ] **Step 5: Verify and commit**

```bash
cd webapp && pnpm build
git add webapp/package.json webapp/pnpm-lock.yaml webapp/src/components/ui/drawer.tsx webapp/src/components/mobile/fab-menu.tsx webapp/src/components/mobile/mobile-sheet-provider.tsx
git commit -m "feat: migrate mobile bottom sheets to vaul drawer"
```

---

## Task 2: KPIWidget Component

**Files:**
- Create: `webapp/src/components/ui/kpi-widget.tsx`
- Modify: `webapp/src/components/dashboard/dashboard-hero.tsx`

- [ ] **Step 1: Create KPIWidget component**

Create `webapp/src/components/ui/kpi-widget.tsx`:

```tsx
import { cn } from "@/lib/utils";

type SemanticColor = "income" | "expense" | "debt" | "alert" | "neutral";

interface KPIWidgetProps {
  label: string;
  value: string;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  icon?: React.ReactNode;
  semanticColor?: SemanticColor;
  className?: string;
}

const colorMap: Record<SemanticColor, { icon: string; trend: Record<string, string> }> = {
  income: { icon: "bg-z-income/10 text-z-income", trend: { up: "text-z-income", down: "text-z-debt" } },
  expense: { icon: "bg-z-expense/10 text-z-expense", trend: { up: "text-z-debt", down: "text-z-income" } },
  debt: { icon: "bg-z-debt/10 text-z-debt", trend: { up: "text-z-debt", down: "text-z-income" } },
  alert: { icon: "bg-z-alert/10 text-z-alert", trend: { up: "text-z-alert", down: "text-z-income" } },
  neutral: { icon: "bg-muted text-muted-foreground", trend: { up: "text-z-income", down: "text-z-debt" } },
};

export function KPIWidget({ label, value, trend, icon, semanticColor = "neutral", className }: KPIWidgetProps) {
  const colors = colorMap[semanticColor];
  const trendColor = trend ? (colors.trend[trend.direction] ?? "text-muted-foreground") : "";
  const trendArrow = trend?.direction === "up" ? "\u2191" : trend?.direction === "down" ? "\u2193" : "\u2192";

  return (
    <div className={cn("flex items-start justify-between rounded-[14px] bg-z-surface-2 p-4", className)}>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight">{value}</p>
        {trend && (
          <p className={cn("mt-0.5 text-[11px]", trendColor)}>
            {trendArrow} {trend.text}
          </p>
        )}
      </div>
      {icon && (
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", colors.icon)}>
          {icon}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Apply KPIWidget to dashboard hero sub-cards**

In `webapp/src/components/dashboard/dashboard-hero.tsx`, replace the 3 manual `Card > CardContent` sub-cards (Saldo total, Fijos pendientes, Libre) with `KPIWidget`:

```tsx
import { KPIWidget } from "@/components/ui/kpi-widget";

// Replace the grid of 3 cards with:
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  <KPIWidget
    label="Saldo total"
    value={formatCurrency(totalLiquid, code)}
    icon={<Wallet className="size-4" />}
    semanticColor="neutral"
  />
  <KPIWidget
    label="Fijos pendientes"
    value={formatCurrency(totalPending, code)}
    icon={<Receipt className="size-4" />}
    semanticColor="expense"
  />
  <KPIWidget
    label="Libre"
    value={formatCurrency(availableToSpend, code)}
    icon={<Banknote className="size-4" />}
    semanticColor={availableToSpend < 0 ? "debt" : "income"}
  />
</div>
```

Keep the main "Disponible para gastar" number and freshness indicator as-is.

- [ ] **Step 3: Verify and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/ui/kpi-widget.tsx webapp/src/components/dashboard/dashboard-hero.tsx
git commit -m "feat: add KPIWidget component and apply to dashboard hero"
```

---

## Task 3: Page Transitions

**Files:**
- Create: `webapp/src/components/ui/page-transition.tsx`
- Modify: `webapp/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create PageTransition wrapper**

Create `webapp/src/components/ui/page-transition.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

No exit animation — keeps navigation feeling snappy. The subtle 6px slide-up + fade gives polish without delay.

- [ ] **Step 2: Wire into dashboard layout**

In `webapp/src/app/(dashboard)/layout.tsx`, wrap `{children}` with PageTransition:

```tsx
import { PageTransition } from "@/components/ui/page-transition";

// In the return, around the children:
<main className="flex-1 overflow-x-hidden p-4 lg:p-6 pb-20 lg:pb-6">
  <MobileSheetProvider accounts={accounts} categories={categories}>
    <PageTransition>
      {children}
    </PageTransition>
  </MobileSheetProvider>
</main>
```

- [ ] **Step 3: Verify and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/ui/page-transition.tsx "webapp/src/app/(dashboard)/layout.tsx"
git commit -m "feat: add subtle page transitions with framer-motion"
```

---

## Task 4: Large Amount Input

**Files:**
- Create: `webapp/src/components/ui/amount-input.tsx`
- Modify: `webapp/src/components/mobile/mobile-transaction-form.tsx`

- [ ] **Step 1: Create AmountInput component**

Create `webapp/src/components/ui/amount-input.tsx`. This wraps `CurrencyInput` with a large, centered mobile-optimized display:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { CurrencyInput } from "./currency-input";
import type { CurrencyCode } from "@zeta/shared";

interface AmountInputProps {
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currency?: CurrencyCode;
  autoFocus?: boolean;
  className?: string;
}

export function AmountInput({
  name,
  value,
  defaultValue,
  onChange,
  currency = "COP",
  autoFocus,
  className,
}: AmountInputProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-sm text-muted-foreground">{currency}</span>
      <CurrencyInput
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        autoFocus={autoFocus}
        placeholder="0"
        className={cn(
          "border-none bg-transparent text-center shadow-none",
          "text-[32px] font-extrabold tracking-tight",
          "h-auto py-2",
          "focus-visible:ring-0 focus-visible:border-none",
          "placeholder:text-muted-foreground/30",
        )}
        inputMode="decimal"
      />
    </div>
  );
}
```

- [ ] **Step 2: Apply to mobile transaction form**

In `webapp/src/components/mobile/mobile-transaction-form.tsx`:
- Import `AmountInput`
- Replace the amount `CurrencyInput` field with `AmountInput` at the top of the form
- This makes the amount the hero element — large, centered, auto-focused

Read the file first, find the amount input section, and replace:
```tsx
// Before: standard CurrencyInput in a form row
<CurrencyInput name="amount" ... />

// After: AmountInput as the hero element at top of form
<AmountInput
  name="amount"
  value={amount}
  onChange={handleAmountChange}
  currency={selectedCurrency}
  autoFocus
/>
```

Keep all existing validation and form state logic. Only the visual presentation changes.

- [ ] **Step 3: Verify and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/ui/amount-input.tsx webapp/src/components/mobile/mobile-transaction-form.tsx
git commit -m "feat: add large AmountInput for mobile transaction form"
```

---

## Final Verification

- [ ] **Run full build**

```bash
cd webapp && pnpm build
```

All 4 features should build cleanly since they touch independent files.
