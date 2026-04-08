# Mobile Plan Family Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create dedicated mobile views for Plan hub, Presupuesto, Recurrentes, and Periodo pages, plus fix mobile issues on Landing, Settings, Accounts, and Transactions.

**Architecture:** Existing `lg:hidden`/`hidden lg:block` split pattern. Mobile Plan hub gets a new cashflow-focused hero (net amount + stacked bar + expandable chart) with drill-down cards. Budget hero moves to Presupuesto sub-page. A reusable `useChartFocusMode` hook locks scroll when charts expand. Sub-pages are tab views within the existing `?tab=` routing.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, Recharts, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-08-mobile-plan-family-design.md`

---

## File Structure

### New Files
- `src/components/mobile/v2/plan/plan-net-hero.tsx` — Net cashflow hero card with stacked bar + expandable chart
- `src/components/mobile/v2/plan/plan-expandable-chips.tsx` — 2-chip grid (próximo ingreso / próximo pago) with expandable lists
- `src/components/mobile/v2/plan/plan-drill-cards.tsx` — "IR A" drill-down card list
- `src/components/mobile/v2/plan/mobile-recurrentes-view.tsx` — Full mobile recurrentes layout (hero + lists)
- `src/components/mobile/v2/plan/mobile-periodo-view.tsx` — Full mobile periodo layout (chart hero + cards)
- `src/hooks/use-chart-focus-mode.ts` — Scroll lock + overlay hook for expanded charts

### Modified Files
- `src/components/mobile/v2/plan/plan-root.tsx` — Replace budget hero with net hero, add chips + drill-cards
- `src/components/plan/tabs/plan-tab-recurrentes.tsx` — Add `lg:hidden` split for mobile recurrentes view
- `src/components/plan/tabs/plan-tab-periodo.tsx` — Add `lg:hidden` split for mobile periodo view
- `src/components/ui/summary-card.tsx:27` — Fix `grid-cols-3` to be responsive
- `src/components/marketing/landing-page.tsx:580` — Fix hero text overflow
- `src/app/(dashboard)/plan/page.tsx` — Pass recurring/periodo data to mobile components

### Already Fixed
- `src/actions/auth.ts` — `translateAuthError()` already added for Spanish error messages

---

### Task 1: `useChartFocusMode` Hook

**Files:**
- Create: `src/hooks/use-chart-focus-mode.ts`

This hook is used by any component with an expandable chart. It locks body scroll and manages an overlay when active.

- [ ] **Step 1: Create the hook**

```tsx
// src/hooks/use-chart-focus-mode.ts
"use client";

import { useEffect, useCallback, useState } from "react";

export function useChartFocusMode(isExpanded: boolean) {
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
      // Small delay so the expand animation starts first
      const timer = setTimeout(() => setOverlayVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "";
      setOverlayVisible(false);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  const handleOverlayClick = useCallback((onCollapse: () => void) => {
    return () => onCollapse();
  }, []);

  return { overlayVisible, handleOverlayClick };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && npx tsc --noEmit src/hooks/use-chart-focus-mode.ts 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/hooks/use-chart-focus-mode.ts
git commit -m "feat: add useChartFocusMode hook for scroll lock + overlay on chart expand"
```

---

### Task 2: Plan Net Hero Card

**Files:**
- Create: `src/components/mobile/v2/plan/plan-net-hero.tsx`

The main hero for the Plan hub. Shows net amount, stacked progress bar (green income → red payments → brass net), and expands to show the full Flujo del Mes chart.

- [ ] **Step 1: Create the net hero component**

```tsx
// src/components/mobile/v2/plan/plan-net-hero.tsx
"use client";

import { useState } from "react";
import { useChartFocusMode } from "@/hooks/use-chart-focus-mode";
import { PlanFlowChart } from "./plan-flow-chart";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { PlanTimelineData } from "@/actions/plan-timeline";

interface PlanNetHeroProps {
  ingresos: number;
  gastos: number;
  currency: CurrencyCode;
  daysRemaining: number;
  timelineData: PlanTimelineData;
}

export function PlanNetHero({
  ingresos,
  gastos,
  currency,
  daysRemaining,
  timelineData,
}: PlanNetHeroProps) {
  const [expanded, setExpanded] = useState(false);
  const neto = ingresos - gastos;
  const gastosRatio = ingresos > 0 ? Math.min((gastos / ingresos) * 100, 100) : 0;
  const netoRatio = 100 - gastosRatio;

  const { overlayVisible, handleOverlayClick } = useChartFocusMode(expanded);

  return (
    <>
      {/* Overlay */}
      {overlayVisible && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={handleOverlayClick(() => setExpanded(false))}
        />
      )}

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="relative z-50 w-full rounded-2xl border border-white/8 bg-gradient-to-br from-[#1a2a1a] to-[#1a1a0a] p-4 text-left transition-all"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            Neto del mes
          </p>
          <span className="text-[10px] text-muted-foreground">
            {daysRemaining} días restantes
          </span>
        </div>

        <p className="text-3xl font-bold text-z-brass">
          {neto >= 0 ? "+" : ""}
          {formatCurrency(neto, currency)}
        </p>

        {/* Stacked progress bar */}
        <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-z-surface-2">
          {/* Green: full income width */}
          <div className="absolute inset-y-0 left-0 w-full rounded-full bg-emerald-500/80" />
          {/* Red: payments portion from left */}
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-red-500/80"
            style={{ width: `${gastosRatio}%` }}
          />
          {/* Brass: net remainder on right */}
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-z-brass/80"
            style={{ width: `${netoRatio}%` }}
          />
        </div>

        {/* Legend */}
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            Ingresos {formatCurrency(ingresos, currency)}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-red-500" />
            Gastos {formatCurrency(gastos, currency)}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-z-brass" />
            Neto
          </span>
        </div>

        {/* Collapsed: sparkline hint */}
        {!expanded && (
          <p className="mt-3 text-center text-[11px] text-z-brass/50">
            Toca para ver flujo ↓
          </p>
        )}

        {/* Expanded: full chart */}
        {expanded && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <PlanFlowChart timelineData={timelineData} currency={currency} />
            <p
              className="mt-2 text-center text-[11px] text-z-brass cursor-pointer"
              onClick={() => setExpanded(false)}
            >
              Ocultar flujo ↑
            </p>
          </div>
        )}
      </button>
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-net-hero.tsx
git commit -m "feat: add PlanNetHero — cashflow hero card with stacked bar and expandable chart"
```

---

### Task 3: Expandable Chips (Próximo Ingreso / Próximo Pago)

**Files:**
- Create: `src/components/mobile/v2/plan/plan-expandable-chips.tsx`

Two chips in a 2-column grid. Each shows the next income/payment and expands to a full list on tap.

- [ ] **Step 1: Create the expandable chips component**

```tsx
// src/components/mobile/v2/plan/plan-expandable-chips.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode, UpcomingRecurrence } from "@/types/domain";

interface PlanExpandableChipsProps {
  incomes: UpcomingRecurrence[];
  payments: UpcomingRecurrence[];
  currency: CurrencyCode;
}

type ChipType = "income" | "payment" | null;

export function PlanExpandableChips({
  incomes,
  payments,
  currency,
}: PlanExpandableChipsProps) {
  const [expanded, setExpanded] = useState<ChipType>(null);

  const nextIncome = incomes[0] ?? null;
  const nextPayment = payments[0] ?? null;

  const toggle = (type: ChipType) => {
    setExpanded((prev) => (prev === type ? null : type));
  };

  const expandedList = expanded === "income" ? incomes : expanded === "payment" ? payments : [];
  const expandedLabel = expanded === "income" ? "Ingresos esperados" : "Pagos programados";
  const expandedColor = expanded === "income" ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-2">
      {/* Chips grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Income chip */}
        <button
          type="button"
          onClick={() => toggle("income")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            expanded === "income"
              ? "border-emerald-500/50 bg-emerald-950/30"
              : "border-white/6 bg-emerald-950/20",
            expanded === "payment" && "opacity-50"
          )}
        >
          <p className="text-lg font-bold text-emerald-400">
            {nextIncome
              ? formatCurrency(nextIncome.template.amount ?? 0, currency)
              : "—"}
          </p>
          <p className="text-[10px] text-emerald-400/80">Próximo ingreso</p>
          {nextIncome && (
            <p className="text-[9px] text-muted-foreground">
              {nextIncome.template.description} · {formatDate(new Date(nextIncome.next_date), "dd MMM")}
            </p>
          )}
        </button>

        {/* Payment chip */}
        <button
          type="button"
          onClick={() => toggle("payment")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            expanded === "payment"
              ? "border-red-500/50 bg-red-950/30"
              : "border-white/6 bg-red-950/20",
            expanded === "income" && "opacity-50"
          )}
        >
          <p className="text-lg font-bold text-red-400">
            {nextPayment
              ? formatCurrency(nextPayment.template.amount ?? 0, currency)
              : "—"}
          </p>
          <p className="text-[10px] text-red-400/80">Próximo pago</p>
          {nextPayment && (
            <p className="text-[9px] text-muted-foreground">
              {nextPayment.template.description} · {formatDate(new Date(nextPayment.next_date), "dd MMM")}
            </p>
          )}
        </button>
      </div>

      {/* Expanded list */}
      {expanded && expandedList.length > 0 && (
        <div className={cn(
          "rounded-xl border p-3",
          expanded === "income"
            ? "border-emerald-500/20 bg-emerald-950/20"
            : "border-red-500/20 bg-red-950/20"
        )}>
          <p className={cn("text-[10px] font-semibold uppercase tracking-widest mb-2", expandedColor)}>
            {expandedLabel}
          </p>
          <div className="divide-y divide-white/5">
            {expandedList.map((item, i) => (
              <div key={`${item.template.id}-${i}`} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium">{item.template.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(new Date(item.next_date), "dd MMM yyyy")}
                    {item.template.account && ` · ${item.template.account.name}`}
                  </p>
                </div>
                <p className={cn("text-sm font-semibold", expandedColor)}>
                  {formatCurrency(item.template.amount ?? 0, currency)}
                </p>
              </div>
            ))}
          </div>
          {/* Total */}
          <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
            <span className="text-muted-foreground">Total</span>
            <span className={cn("font-bold", expandedColor)}>
              {formatCurrency(
                expandedList.reduce((sum, item) => sum + (item.template.amount ?? 0), 0),
                currency
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-expandable-chips.tsx
git commit -m "feat: add PlanExpandableChips — income/payment chips with expandable lists"
```

---

### Task 4: Drill-down Cards

**Files:**
- Create: `src/components/mobile/v2/plan/plan-drill-cards.tsx`

"IR A" section with cards linking to Presupuesto, Periodo, Recurrentes, Deseos.

- [ ] **Step 1: Create drill-down cards component**

```tsx
// src/components/mobile/v2/plan/plan-drill-cards.tsx
import Link from "next/link";
import type { PlanBudgetSummary, PlanRecurringSummary } from "@/types/plan";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface DrillCard {
  title: string;
  hint: string;
  hintColor: string;
  href: string;
}

interface PlanDrillCardsProps {
  budget: PlanBudgetSummary;
  recurring: PlanRecurringSummary;
  periodoSummary: { hasActive: boolean; percentAssigned: number } | null;
  wishlistCount: number;
  currency: CurrencyCode;
}

export function PlanDrillCards({
  budget,
  recurring,
  periodoSummary,
  wishlistCount,
  currency,
}: PlanDrillCardsProps) {
  const budgetPct = budget.totalBudgeted > 0
    ? Math.round((budget.totalSpent / budget.totalBudgeted) * 100)
    : 0;

  const cards: DrillCard[] = [
    {
      title: "Presupuesto",
      hint: budget.overLimitCount > 0
        ? `${budgetPct}% · ${budget.overLimitCount} sobre límite`
        : `${budgetPct}% gastado`,
      hintColor: budget.overLimitCount > 0 ? "text-red-400" : "text-emerald-400",
      href: "/plan?tab=presupuesto",
    },
    {
      title: "Periodo",
      hint: periodoSummary?.hasActive
        ? `${periodoSummary.percentAssigned}% asignado`
        : "Sin periodo activo",
      hintColor: periodoSummary?.hasActive ? "text-emerald-400" : "text-muted-foreground",
      href: "/plan?tab=periodo",
    },
    {
      title: "Recurrentes",
      hint: `${formatCurrency(recurring.totalMonthlyExpenses, currency)}/mes`,
      hintColor: "text-amber-400",
      href: "/plan?tab=recurrentes",
    },
    {
      title: "Deseos",
      hint: `${wishlistCount} item${wishlistCount !== 1 ? "s" : ""}`,
      hintColor: "text-muted-foreground",
      href: "/plan?tab=deseos",
    },
  ];

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Ir a
      </p>
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="flex items-center justify-between rounded-xl border border-white/6 bg-z-surface-2/60 px-4 py-3 transition-colors active:bg-z-surface-2"
        >
          <div>
            <p className="text-[13px] font-semibold">{card.title}</p>
            <p className={`text-[11px] ${card.hintColor}`}>{card.hint}</p>
          </div>
          <span className="text-muted-foreground">›</span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx
git commit -m "feat: add PlanDrillCards — navigation cards for plan sub-pages"
```

---

### Task 5: Wire Up New Plan Hub Mobile View

**Files:**
- Modify: `src/components/mobile/v2/plan/plan-root.tsx`
- Modify: `src/app/(dashboard)/plan/page.tsx`

Replace the current budget-focused mobile Plan with the new net hero + chips + drill-down layout.

- [ ] **Step 1: Rewrite plan-root.tsx**

Replace the entire contents of `src/components/mobile/v2/plan/plan-root.tsx` with the new layout. The component now uses `PlanNetHero`, `PlanExpandableChips`, and `PlanDrillCards` instead of `PlanHeroWrapper`, `PlanZoneChips`, `PlanFlowChart`, and `PlanDistribution`.

Key changes:
- Import new components: `PlanNetHero`, `PlanExpandableChips`, `PlanDrillCards`
- Remove imports: `PlanHeroWrapper`, `PlanZoneChips`, `PlanFlowChart`, `PlanDistribution`
- Add `periodoSummary` and `wishlistCount` to props
- Split `recurring.upcoming` into incomes/payments using `template.direction === "INFLOW"` / `"OUTFLOW"`
- Remove `useExpandableZone` (no longer needed at this level)
- Keep `MobileHeader` and `MonthSelector`

The new render order:
1. `MobileHeader` (existing)
2. `MonthSelector` (existing, single instance)
3. `PlanNetHero` — net amount, stacked bar, expandable chart
4. `PlanExpandableChips` — 2 chips with expandable income/payment lists
5. `PlanDrillCards` — navigation to sub-pages
6. Scenarios count (existing, optional)

- [ ] **Step 2: Update plan page.tsx to pass new props**

In `src/app/(dashboard)/plan/page.tsx`, update the `PlanRoot` invocation (around line 86) to pass the new props:
- `periodoSummary` (already computed on line 66-74)
- `wishlistCount` (from `wishlistSummary`)

- [ ] **Step 3: Build and verify**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -20`
Expected: Clean build, no type errors.

- [ ] **Step 4: Manual test on mobile viewport**

Open `http://localhost:3000/plan` at 390×844 and verify:
- Net hero shows with stacked bar
- Tapping hero expands chart with scroll lock
- Tapping chips expands income/payment lists
- Drill-down cards navigate to correct tabs

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/plan-root.tsx webapp/src/app/\(dashboard\)/plan/page.tsx
git commit -m "feat: wire up new Plan hub mobile view — net hero + chips + drill cards"
```

---

### Task 6: Mobile Presupuesto View

**Files:**
- Modify: `src/components/plan/tabs/plan-tab-presupuesto.tsx`

The presupuesto tab already renders the budget view. We need to add a `lg:hidden` mobile variant that shows the budget hero (moved from Plan) + a vertical category list. The desktop view (`hidden lg:block`) stays unchanged.

- [ ] **Step 1: Read current plan-tab-presupuesto.tsx**

Read the file to understand its current structure, what data it fetches, and how it renders.

- [ ] **Step 2: Add mobile variant**

Wrap existing content in `hidden lg:block`. Add a `lg:hidden` section above with:
- `MobileHeader variant="sub" title="Presupuesto" backHref="/plan"`
- Budget hero card (extract from `PlanBudgetHero` or inline): percentage, spent/budget, progress bar, status badge, distribution
- Category list: vertical list with icon, name, amount/budget, mini progress bar
- Use the existing `categories` data already available in this component

- [ ] **Step 3: Build and verify**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx
git commit -m "feat: add dedicated mobile Presupuesto view with budget hero"
```

---

### Task 7: Mobile Recurrentes View

**Files:**
- Create: `src/components/mobile/v2/plan/mobile-recurrentes-view.tsx`
- Modify: `src/components/plan/tabs/plan-tab-recurrentes.tsx`

Desktop keeps the calendar. Mobile gets a hero card + chronological list.

- [ ] **Step 1: Create mobile-recurrentes-view.tsx**

```tsx
// src/components/mobile/v2/plan/mobile-recurrentes-view.tsx
"use client";

import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { CurrencyCode, UpcomingRecurrence } from "@/types/domain";
import type { PlanRecurringSummary } from "@/types/plan";

interface MobileRecurrentesViewProps {
  summary: PlanRecurringSummary;
  currency: CurrencyCode;
}

export function MobileRecurrentesView({ summary, currency }: MobileRecurrentesViewProps) {
  const pending = summary.upcoming.filter((u) => !u.template.is_confirmed);
  const completed = summary.upcoming.filter((u) => u.template.is_confirmed);

  return (
    <div className="space-y-4 pb-20">
      <MobileHeader variant="sub" title="Recurrentes" backHref="/plan" />

      {/* Hero card */}
      <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-[#2a1a0a] to-[#1a1a0a] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
          Compromiso mensual
        </p>
        <p className="mt-1 text-3xl font-bold">
          {formatCurrency(summary.totalMonthlyExpenses, currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary.activeCount} plantillas activas
        </p>

        <div className="my-3 h-px bg-white/6" />

        <div className="flex justify-between text-center">
          <div>
            <p className="text-[10px] text-amber-400">Pendientes</p>
            <p className="text-lg font-semibold text-amber-400">{summary.dueSoonCount}</p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-400">Completados</p>
            <p className="text-lg font-semibold text-emerald-400">{completed.length}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Próximo</p>
            {pending[0] ? (
              <p className="text-xs font-semibold">
                {pending[0].template.description} · {formatDate(new Date(pending[0].next_date), "dd MMM")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming list */}
      {pending.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Próximos
          </p>
          <div className="divide-y divide-white/5">
            {pending.map((item, i) => (
              <div key={`${item.template.id}-${i}`} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-medium">{item.template.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(new Date(item.next_date), "dd MMM yyyy")}
                    {item.template.account && ` · ${item.template.account.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-red-400">
                    {formatCurrency(item.template.amount ?? 0, currency)}
                  </p>
                  <span className="rounded-md bg-z-brass/10 px-2 py-0.5 text-[10px] text-z-brass">
                    Confirmar
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed list */}
      {completed.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Completados
          </p>
          <div className="divide-y divide-white/5 opacity-50">
            {completed.map((item, i) => (
              <div key={`${item.template.id}-${i}`} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs">{item.template.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(new Date(item.next_date), "dd MMM")}
                  </p>
                </div>
                <p className="text-sm text-emerald-400">
                  ✓ {formatCurrency(item.template.amount ?? 0, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add lg:hidden split to plan-tab-recurrentes.tsx**

Read `src/components/plan/tabs/plan-tab-recurrentes.tsx`, then wrap existing content in `hidden lg:block` and add `lg:hidden` above it rendering `MobileRecurrentesView` with the summary and currency props. The data fetch stays in the parent — both branches use the same data.

- [ ] **Step 3: Build and verify**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx webapp/src/components/plan/tabs/plan-tab-recurrentes.tsx
git commit -m "feat: add mobile Recurrentes view — hero card + chronological list (no calendar)"
```

---

### Task 8: Mobile Periodo View

**Files:**
- Create: `src/components/mobile/v2/plan/mobile-periodo-view.tsx`
- Modify: `src/components/plan/tabs/plan-tab-periodo.tsx`

Chart is the hero (always visible). Period summary bar below. Income cards with full "Disponible" labels. Expense list.

- [ ] **Step 1: Create mobile-periodo-view.tsx**

The component receives the period data and timeline data. It renders:
1. `MobileHeader variant="sub" title="Periodo" backHref="/plan"`
2. Chart hero — reuse existing `PlanFlowChart` component, always visible (not collapsed). Apply `useChartFocusMode` on touch interaction.
3. Period summary bar — date range + "100% asignado" badge
4. Income cards — each with name, amount, date, assignment progress bar, "Disponible: $X" (never truncated)
5. Expense list — clean rows with "Pendiente" badge

The key difference from desktop: no side-by-side layout, full-width cards, "Disponible" label gets its own line.

- [ ] **Step 2: Add lg:hidden split to plan-tab-periodo.tsx**

Read `src/components/plan/tabs/plan-tab-periodo.tsx`, wrap existing content in `hidden lg:block`, add `lg:hidden` rendering `MobilePeriodoView`.

- [ ] **Step 3: Build and verify**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx webapp/src/components/plan/tabs/plan-tab-periodo.tsx
git commit -m "feat: add mobile Periodo view — chart hero + income cards + expense list"
```

---

### Task 9: Landing Page Hero Text Overflow Fix

**Files:**
- Modify: `src/components/marketing/landing-page.tsx:580`

- [ ] **Step 1: Fix hero headline responsive sizing**

In `src/components/marketing/landing-page.tsx`, line 580, the headline uses `text-5xl sm:text-6xl lg:text-7xl`. On a 390px viewport this overflows because `text-5xl` (3rem/48px) is too large with the current padding.

Change:
```tsx
<h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
```
To:
```tsx
<h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-7xl">
```

- [ ] **Step 2: Build and verify**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Verify visually at 390px**

Open `http://localhost:3000` at 390×844 and confirm headline no longer clips.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/marketing/landing-page.tsx
git commit -m "fix: reduce landing hero font size on mobile to prevent text overflow"
```

---

### Task 10: Settings Profile Cards Overflow Fix

**Files:**
- Modify: `src/components/ui/summary-card.tsx:27`

- [ ] **Step 1: Make SummaryCard grid responsive**

In `src/components/ui/summary-card.tsx`, line 27, change:
```tsx
<div className="mt-3 grid grid-cols-3 gap-3">
```
To:
```tsx
<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
```

This stacks the 3 metric boxes vertically on mobile (<640px) and keeps the 3-column layout on larger screens.

- [ ] **Step 2: Build and verify**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Verify visually at 390px**

Open `http://localhost:3000/settings` at 390×844. Profile cards should stack vertically — email and date fully visible.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/ui/summary-card.tsx
git commit -m "fix: stack SummaryCard metrics vertically on mobile to prevent overflow"
```

---

### Task 11: Bottom Nav Padding + Accounts Tap Targets

**Files:**
- Modify: `src/app/(dashboard)/transactions/page.tsx` — verify `pb-20` on scrollable container
- Modify: `src/app/(dashboard)/accounts/page.tsx` — make account cards fully tappable

- [ ] **Step 1: Verify transactions page has bottom padding**

Read `src/app/(dashboard)/transactions/page.tsx` and check the outermost mobile container has `pb-20`. If missing, add it.

- [ ] **Step 2: Make account cards fully tappable**

Read `src/app/(dashboard)/accounts/page.tsx`. Find the account card rendering (likely using `AccountCard` component). If the entire card isn't wrapped in a `Link` to the account detail, wrap it so the whole card is a tap target instead of just the small "Ver detalle" text.

- [ ] **Step 3: Build and verify**

Run: `cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/transactions/page.tsx webapp/src/app/\(dashboard\)/accounts/page.tsx
git commit -m "fix: add bottom nav padding on transactions, make account cards fully tappable"
```

---

### Task 12: Final Build Gate + Verification

- [ ] **Step 1: Full build**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm install && pnpm build
```

Expected: Clean build, zero errors.

- [ ] **Step 2: Visual verification on mobile viewport**

Test all modified pages at 390×844:
- `/plan` — net hero, chips, drill cards
- `/plan?tab=presupuesto` — budget hero, category list
- `/plan?tab=recurrentes` — hero card, upcoming/completed lists
- `/plan?tab=periodo` — chart hero, income cards, expense list
- `/` — hero text fits
- `/settings` — profile cards stack
- `/accounts` — cards are tappable
- `/transactions` — no bottom nav overlap

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A && git commit -m "fix: final mobile polish adjustments"
```
