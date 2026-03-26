# Dashboard Metrics & Visualizations Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Zeta dashboard with a section-based widget system, gamified health meters, waterfall cash flow, spending heatmap, 50/30/20 allocation, and debt-free countdown.

**Architecture:** Extends the existing `DashboardConfig` JSONB system with new widget IDs and a `section` field. New server actions compute health metrics, allocations, and heatmap data from existing DB tables. New components are mostly CSS-based (no new chart library deps), with Recharts only for donut and cash flow toggle.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4, Recharts, shadcn/ui, Supabase, `@zeta/shared` debt utils

**Spec:** `docs/superpowers/specs/2026-03-18-dashboard-metrics-redesign.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `webapp/src/actions/health-meters.ts` | Server action: `getHealthMeters(currency)` — computes 4 meter values + roast context |
| `webapp/src/actions/allocation.ts` | Server action: `get503020Allocation(month, currency)` — needs/wants/savings breakdown |
| `webapp/src/actions/spending-heatmap.ts` | Server action: `getSpendingHeatmap(month, currency)` — daily amounts + patterns |
| `webapp/src/actions/debt-countdown.ts` | Server action: `getDebtFreeCountdown(currency)` — payoff projection |
| `webapp/src/actions/interest-paid.ts` | Server action: `getInterestPaid(month, currency)` — snapshot interest aggregation |
| `webapp/src/lib/health-levels.ts` | Level classification logic + roast templates (pure functions, no DB) |
| `webapp/src/components/dashboard/dashboard-section.tsx` | Collapsible section wrapper with gear toggle |
| `webapp/src/components/dashboard/widget-toggle-panel.tsx` | Settings popover for toggling widgets per section |
| `webapp/src/components/dashboard/cash-flow-hero-strip.tsx` | Income → Fixed → Variable → Remaining flow |
| `webapp/src/components/dashboard/health-meters-card.tsx` | Compact horizontal bars with pins + level tags |
| `webapp/src/components/dashboard/health-meter-expanded.tsx` | Speedometer modal/sheet with roast copy |
| `webapp/src/components/charts/waterfall-chart.tsx` | Income → categories → net remaining |
| `webapp/src/components/charts/cash-flow-view-toggle.tsx` | Wraps line + bar views with toggle |
| `webapp/src/components/charts/category-donut.tsx` | Recharts PieChart donut + legend |
| `webapp/src/components/charts/spending-heatmap.tsx` | CSS grid calendar + pattern detection |
| `webapp/src/components/budget/allocation-bars-5030.tsx` | 50/30/20 horizontal progress bars |
| `webapp/src/components/debt/debt-free-countdown.tsx` | Motivational payoff card |
| `webapp/src/components/dashboard/savings-rate-widget.tsx` | KPIWidget for savings rate |
| `webapp/src/components/dashboard/emergency-fund-widget.tsx` | KPIWidget for emergency fund |
| `webapp/src/components/dashboard/interest-paid-widget.tsx` | KPIWidget for interest paid |
| `webapp/src/components/dashboard/debt-progress-widget.tsx` | Per-account progress bars |

### Modified Files

| File | Change |
|------|--------|
| `webapp/src/types/dashboard-config.ts` | Add `section` field to `WidgetConfig`, add `DashboardSection` type |
| `webapp/src/lib/dashboard-config-defaults.ts` | Add new widget IDs with section assignments |
| `webapp/src/actions/charts.ts` | Extend `getCategorySpending` to include `expense_type` in select |
| `webapp/src/app/globals.css` | Add `--z-excellent` token |
| `webapp/src/app/(dashboard)/dashboard/page.tsx` | Refactor to section-based widget renderer |
| `webapp/src/components/mobile/mobile-dashboard.tsx` | Align with section-based layout |
| `webapp/src/components/dashboard/dashboard-hero.tsx` | Add cash flow strip |
| `webapp/src/app/(dashboard)/categories/page.tsx` | Add 50/30/20 allocation widget |

---

## Phase 1: Foundation (Widget System + Design Tokens)

### Task 1: Extend Dashboard Config Types

**Files:**
- Modify: `webapp/src/types/dashboard-config.ts`
- Modify: `webapp/src/lib/dashboard-config-defaults.ts`

- [ ] **Step 1: Add section type and update WidgetConfig**

In `webapp/src/types/dashboard-config.ts`, add:

```typescript
export type DashboardSection = "hero" | "niveles" | "flujo" | "presupuesto" | "patrimonio" | "actividad";

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
  section: DashboardSection;
}
```

- [ ] **Step 2: Update defaults with new widget IDs and sections**

In `webapp/src/lib/dashboard-config-defaults.ts`, update every widget in every `DEFAULTS` config to include the `section` field. Add the new widget IDs. Example for `manage_debt`:

```typescript
widgets: [
  // Hero section (always on, not toggleable)
  { id: "hero-available", visible: true, order: 0, section: "hero" },
  { id: "hero-flow-strip", visible: true, order: 1, section: "hero" },
  // Niveles
  { id: "health-meters", visible: true, order: 0, section: "niveles" },
  // Flujo
  { id: "waterfall", visible: true, order: 0, section: "flujo" },
  { id: "cashflow-trend", visible: false, order: 1, section: "flujo" },
  // Presupuesto
  { id: "budget-pulse", visible: true, order: 0, section: "presupuesto" },
  { id: "allocation-5030", visible: true, order: 1, section: "presupuesto" },
  { id: "category-donut", visible: false, order: 2, section: "presupuesto" },
  // Patrimonio
  { id: "debt-countdown", visible: true, order: 0, section: "patrimonio" },
  { id: "debt-progress", visible: true, order: 1, section: "patrimonio" },
  { id: "net-worth", visible: false, order: 2, section: "patrimonio" },
  { id: "savings-rate", visible: false, order: 3, section: "presupuesto" },
  { id: "emergency-fund", visible: false, order: 4, section: "patrimonio" },
  { id: "interest-paid", visible: false, order: 5, section: "patrimonio" },
  // Actividad
  { id: "upcoming-payments", visible: true, order: 0, section: "actividad" },
  { id: "recent-tx", visible: true, order: 1, section: "actividad" },
  { id: "spending-heatmap", visible: false, order: 2, section: "actividad" },
],
```

Repeat for all 4 purpose configs, varying which widgets are visible by default per purpose.

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Types updated, defaults compile, no errors.

- [ ] **Step 4: Commit**

```
feat: extend dashboard config types with section-based widgets
```

---

### Task 2: Add Design Token + Extend getCategorySpending

**Files:**
- Modify: `webapp/src/app/globals.css`
- Modify: `webapp/src/actions/charts.ts` (around line 507)

- [ ] **Step 1: Add z-excellent token to globals.css**

In `:root` section after `--z-alert`, add:

```css
--z-excellent: #3D9E6E;
```

Also add to the `@theme inline` block:

```css
--color-z-excellent: var(--z-excellent);
```

- [ ] **Step 2: Extend getCategorySpending to include expense_type**

In `webapp/src/actions/charts.ts`, find the `getCategorySpending` function (line ~507). The inner query selects `categories!category_id(name_es, name, color)`. Add `expense_type` to that select:

```typescript
categories!category_id(name_es, name, color, expense_type)
```

Update the `CategorySpending` type (find it near the top of the file) to include:

```typescript
export interface CategorySpending {
  // ... existing fields
  expense_type: "fixed" | "variable" | null;
}
```

Also update the type cast at `charts.ts` line ~99 where category data is typed as `{ name_es: string | null; name: string; color: string }` — add `expense_type: string | null` to this cast. Then propagate `expense_type` through the aggregation loop (lines ~97-116) to include it in each map entry and the final return array.

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```
feat: add z-excellent token and expense_type to category spending
```

---

## Phase 2: Health Levels & Data Layer

### Task 3: Health Level Classification + Roast Templates

**Files:**
- Create: `webapp/src/lib/health-levels.ts`

- [ ] **Step 1: Create the pure classification + roast module**

This file has zero DB dependencies — pure functions only. Contains:

1. `Level` type: `"excelente" | "solido" | "atento" | "alto" | "critico"`
2. `MeterType` type: `"gasto" | "deuda" | "ahorro" | "colchon"`
3. `classifyLevel(meter: MeterType, value: number): Level` — threshold logic from spec Section 3
4. `getLevelColor(level: Level): string` — returns CSS var name
5. `getLevelTag(level: Level): string` — returns uppercase tag string
6. `getRoastMessage(meter, value, level, income?, currency?): string` — deterministic template strings with salary-range variants

Key: for meters where lower is better (gasto, deuda), the gradient goes green→red left→right. For higher-is-better (ahorro, colchon), reversed.

Salary fallback: if income is null/undefined, return generic level-based message without salary comparison.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```
feat: add health level classification and roast templates
```

---

### Task 4: getHealthMeters Server Action

**Files:**
- Create: `webapp/src/actions/health-meters.ts`

- [ ] **Step 1: Implement getHealthMeters**

```typescript
"use server";

import { cache } from "react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { getMonthlyCashflow, getCategorySpending } from "./charts";
import { getEstimatedIncome } from "./income";
import { getAccounts } from "./accounts";
import { classifyLevel, getRoastMessage } from "@/lib/health-levels";
import type { CurrencyCode } from "@/types/domain";

export interface HealthMeter {
  type: "gasto" | "deuda" | "ahorro" | "colchon";
  value: number;
  level: ReturnType<typeof classifyLevel>;
  roast: string;
}

export interface HealthMetersData {
  meters: HealthMeter[];
  summaryRoast: string;
  monthlyIncome: number | null;
  currency: CurrencyCode;
}

export const getHealthMeters = cache(async (
  currency: CurrencyCode,
  month?: string
): Promise<HealthMetersData> => {
  // Parallel fetch: cashflow, category spending, accounts, income
  const [cashflowData, categoryData, accountsResult, incomeEstimate] = await Promise.all([
    getMonthlyCashflow(month, currency),
    getCategorySpending(month, currency),
    getAccounts(),
    getEstimatedIncome(currency, month),
  ]);

  const currentMonth = cashflowData[cashflowData.length - 1];
  const income = currentMonth?.income ?? 0;
  const expenses = currentMonth?.expenses ?? 0;
  const monthlyIncome = incomeEstimate?.monthlyAverage ?? null;

  // Gasto: expense ratio
  const gastoValue = income > 0 ? (expenses / income) * 100 : 0;

  // Deuda: DTI — query latest snapshot per debt account for minimum_payment
  const accounts = accountsResult.success ? accountsResult.data : [];
  const debtAccounts = accounts.filter(a =>
    a.account_type === "CREDIT_CARD" || a.account_type === "LOAN"
  );

  // Fetch latest snapshot per debt account to get minimum_payment
  const { supabase } = await getAuthenticatedClient();
  const debtAccountIds = debtAccounts.map(a => a.id);
  let monthlyDebtPayments = 0;
  if (debtAccountIds.length > 0) {
    // Get the most recent snapshot per debt account
    const { data: snapshots } = await supabase
      .from("statement_snapshots")
      .select("account_id, minimum_payment, total_payment_due")
      .in("account_id", debtAccountIds)
      .order("period_to", { ascending: false });

    // Deduplicate: keep only the latest snapshot per account
    const seen = new Set<string>();
    for (const snap of snapshots ?? []) {
      if (!seen.has(snap.account_id)) {
        seen.add(snap.account_id);
        monthlyDebtPayments += snap.minimum_payment ?? snap.total_payment_due ?? 0;
      }
    }
  }

  const deudaValue = monthlyIncome && monthlyIncome > 0
    ? (monthlyDebtPayments / monthlyIncome) * 100
    : 0;

  // Ahorro: savings rate
  const ahorroValue = income > 0 ? ((income - expenses) / income) * 100 : 0;

  // Colchon: emergency fund months
  const liquidAccounts = accounts.filter(a =>
    a.account_type === "CHECKING" || a.account_type === "SAVINGS"
  );
  const liquidBalance = liquidAccounts.reduce((sum, a) => sum + Math.abs(a.current_balance), 0);
  const fixedExpenses = categoryData
    .filter(c => c.expense_type === "fixed")
    .reduce((sum, c) => sum + c.amount, 0);
  const colchonValue = fixedExpenses > 0 ? liquidBalance / fixedExpenses : 99;

  // Build meters
  const meters: HealthMeter[] = [
    { type: "gasto", value: gastoValue, level: classifyLevel("gasto", gastoValue), roast: "" },
    { type: "deuda", value: deudaValue, level: classifyLevel("deuda", deudaValue), roast: "" },
    { type: "ahorro", value: ahorroValue, level: classifyLevel("ahorro", ahorroValue), roast: "" },
    { type: "colchon", value: colchonValue, level: classifyLevel("colchon", colchonValue), roast: "" },
  ];

  // Fill roast messages
  for (const m of meters) {
    m.roast = getRoastMessage(m.type, m.value, m.level, monthlyIncome ?? undefined, currency);
  }

  return { meters, summaryRoast: "", monthlyIncome, currency };
});
```

Note: The DTI calculation needs a sub-query for latest snapshot minimum_payments per debt account. The implementer should add this parallel query in the Promise.all.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```
feat: add getHealthMeters server action
```

---

### Task 5: get503020Allocation Server Action

**Files:**
- Create: `webapp/src/actions/allocation.ts`

- [ ] **Step 1: Implement the allocation action**

Queries `getMonthlyCashflow` for income and `getCategorySpending` (with new `expense_type` field) to group spending into needs/wants/savings.

**Critical: debt payment separation.** Debt payments (OUTFLOWs to CREDIT_CARD/LOAN accounts) ARE included in the `expenses` total from `getMonthlyCashflow` — they are NOT automatically excluded. To correctly build the 20% bucket (savings + debt), the action must:

1. Query OUTFLOW transactions for the month joined with `accounts` to identify those where `accounts.account_type IN ('CREDIT_CARD', 'LOAN')`.
2. Sum those as `debtPayments`.
3. Needs = sum of category spending where `expense_type = 'fixed'` (excluding debt payments).
4. Wants = sum of category spending where `expense_type = 'variable'` or null.
5. Savings+Debt = `(income - needs - wants)` + `debtPayments` (since debt payments are already counted in expenses but belong in this bucket, we add them back).

Alternative simpler approach: Savings+Debt bucket = `income - needs - wants` which naturally includes both actual savings and debt payments since neither are categorized as needs/wants.

Returns:

```typescript
export interface AllocationData {
  income: number;
  needs: { amount: number; percent: number; target: 50 };
  wants: { amount: number; percent: number; target: 30 };
  savings: { amount: number; percent: number; target: 20 };
  currency: CurrencyCode;
}
```

- [ ] **Step 2: Verify build**

- [ ] **Step 3: Commit**

```
feat: add 50/30/20 allocation server action
```

---

### Task 6: getSpendingHeatmap Server Action

**Files:**
- Create: `webapp/src/actions/spending-heatmap.ts`

- [ ] **Step 1: Implement heatmap action**

Wraps `getDailySpending(month, currency)` and adds:
1. `dailyAverage` computation
2. Level classification per day (0-4 scale based on avg)
3. Pattern detection: day-of-week aggregation, weekend/weekday ratio, highest spending day, zero-spend day count

Returns:

```typescript
export interface HeatmapData {
  days: Array<{ date: string; amount: number; level: 0|1|2|3|4 }>;
  dailyAverage: number;
  patterns: {
    weekendRatio: number; // e.g., 2.3 = spend 2.3x more on weekends
    highestDay: string; // "sabado"
    zeroSpendDays: number;
  };
  currency: CurrencyCode;
}
```

- [ ] **Step 2: Verify build**

- [ ] **Step 3: Commit**

```
feat: add spending heatmap server action
```

---

### Task 7: getDebtFreeCountdown + getInterestPaid Server Actions

**Files:**
- Create: `webapp/src/actions/debt-countdown.ts`
- Create: `webapp/src/actions/interest-paid.ts`

- [ ] **Step 1: Implement debt countdown**

Uses `getAccounts()` filtered to debt types, fetches latest snapshots for rates/minimums, then calls `compareStrategies()` from `@zeta/shared` (debt-simulator module) with an extra payment scenario (10% of highest-rate debt's minimum).

Returns: `{ monthsToFree, projectedDate, totalDebt, originalDebt, extraPaymentScenario: { extraAmount, monthsSaved, interestSaved }, currency }`

Edge cases: no debt → return null. Missing rate/minimum → exclude account, note incomplete data.

- [ ] **Step 2: Implement interest paid**

Queries `statement_snapshots` grouped by month, sums `interest_charged`. Returns current month, previous month, and YTD totals.

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```
feat: add debt countdown and interest paid server actions
```

---

## Phase 3: Dashboard Shell (Sections + Widget Renderer)

### Task 8: DashboardSection Component

**Files:**
- Create: `webapp/src/components/dashboard/dashboard-section.tsx`

- [ ] **Step 1: Build collapsible section wrapper**

Client component. Props: `title: string`, `section: DashboardSection`, `children`, `defaultOpen?: boolean`, `summaryText?: string`.

Features:
- Chevron toggle for collapse/expand
- Gear icon opens `WidgetTogglePanel`
- On mobile: collapsed shows `summaryText` one-liner
- Uses `cn()` for Tailwind classes, matches existing Card styling

- [ ] **Step 2: Verify build**

- [ ] **Step 3: Commit**

```
feat: add collapsible DashboardSection component
```

---

### Task 9: WidgetTogglePanel Component

**Files:**
- Create: `webapp/src/components/dashboard/widget-toggle-panel.tsx`

- [ ] **Step 1: Build widget toggle popover**

Client component. Uses shadcn `Popover` + `Switch` per widget. Reads widget list for the section from config, shows toggle switches.

Props: `section: DashboardSection`, `config: DashboardConfig`, `onToggle: (widgetId: string, visible: boolean) => void`

- [ ] **Step 2: Verify build**

- [ ] **Step 3: Commit**

```
feat: add WidgetTogglePanel popover
```

---

### Task 10: Refactor Dashboard Page to Section-Based Layout

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Refactor DashboardPage to render sections**

Replace the current flat layout with section-based rendering. The page fetches all data in parallel (as it does now), then renders `DashboardSection` wrappers for each section. Widgets within each section render conditionally based on `config.widgets.filter(w => w.section === section && w.visible)`.

Key: preserve the existing `Suspense` boundary for heavy chart data. The Hero and Niveles sections render immediately (fast data). Flujo, Presupuesto, Patrimonio, Actividad render inside Suspense.

**Important:** Task 10 should use lazy conditional rendering for widget slots. If a widget component doesn't exist yet (Tasks 11-21), render a placeholder div or simply skip it. This allows Task 10 to compile and be tested before all widget components are built. Use dynamic imports or conditional checks so missing components don't block the build.

This is the largest single change. The existing layout structure (hero → burn rate → payments/accounts → alerts → analysis → recent tx) becomes:
1. Hero section (disponible + flow strip)
2. Niveles section (health meters)
3. Flujo section (waterfall + optional trend)
4. Presupuesto section (budget pace + 50/30/20 + optional donut)
5. Patrimonio section (debt countdown + progress + optional net worth/KPIs)
6. Actividad section (payments + recent tx + optional heatmap)

Wire `useDashboardConfig` hook to control widget visibility.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Test in dev**

Run: `cd webapp && pnpm dev` — verify dashboard loads with default widgets, sections render correctly.

- [ ] **Step 4: Commit**

```
feat: refactor dashboard to section-based widget layout
```

---

## Phase 4: Hero + Health Meters

### Task 11: Cash Flow Hero Strip

**Files:**
- Create: `webapp/src/components/dashboard/cash-flow-hero-strip.tsx`
- Modify: `webapp/src/components/dashboard/dashboard-hero.tsx`

- [ ] **Step 1: Build CashFlowHeroStrip**

Server component. Pure CSS flow nodes: Income → Fijos → Variable → Queda. Uses `formatCurrency` with abbreviated format for mobile. Props: `income, fixedExpenses, variableExpenses, remaining, currency`.

- [ ] **Step 2: Integrate into DashboardHero**

Add the strip below the headline number, above the 3 sub-KPI cards. The strip data comes from `getMonthlyCashflow` (income/expenses) + `getCategorySpending` (with `expense_type` from Task 2) to split expenses into fixed vs variable. This avoids a dependency on `get503020Allocation` — the hero strip computes its own simple split directly from the extended category data.

- [ ] **Step 3: Verify build + dev test**

- [ ] **Step 4: Commit**

```
feat: add cash flow hero strip to dashboard
```

---

### Task 12: Health Meters Card (Compact)

**Files:**
- Create: `webapp/src/components/dashboard/health-meters-card.tsx`

- [ ] **Step 1: Build compact meters card**

Client component. Renders 4 horizontal gradient bars with white pin markers. Each row: label, value, level tag, gradient bar with pin at position.

Gradient: CSS `linear-gradient` from green→red (for gasto/deuda) or red→green (for ahorro/colchon). Pin position: `left: ${normalizedValue}%`.

Below the 4 bars: summary roast text from `HealthMetersData.summaryRoast`.

Props: `data: HealthMetersData`, `onMeterClick: (type: MeterType) => void`

- [ ] **Step 2: Verify build**

- [ ] **Step 3: Commit**

```
feat: add compact health meters card
```

---

### Task 13: Health Meter Expanded (Speedometer)

**Files:**
- Create: `webapp/src/components/dashboard/health-meter-expanded.tsx`

- [ ] **Step 1: Build expanded speedometer view**

Client component. Renders in a Sheet (mobile) or Dialog (desktop).

Contains:
- SVG semicircle arc with colored segments (green → yellow → orange → red)
- CSS-animated needle rotated to the user's value position
- Large value + level tag
- Full roast paragraph
- Breakdown table (for deuda: per-account payments; for gasto: top categories)
- Actionable recommendation line

Props: `meter: HealthMeter`, `income: number | null`, `breakdown: Array<{label, amount}>`, `currency`

- [ ] **Step 2: Wire click handler from HealthMetersCard to open expanded view**

- [ ] **Step 3: Verify build + dev test**

- [ ] **Step 4: Commit**

```
feat: add speedometer expanded health meter view
```

---

## Phase 5: Visualizations

### Task 14: Waterfall Chart

**Files:**
- Create: `webapp/src/components/charts/waterfall-chart.tsx`

- [ ] **Step 1: Build waterfall chart**

Client component. Uses CSS div bars (not Recharts) for simplicity. Each bar: label, value, proportional-height colored div. Income = full green. Categories = orange segments. Net = green outline.

Props: `income: number`, `categories: Array<{name, amount}>`, `net: number`, `currency`

Responsive: on mobile (< 640px), show max 4 categories + "Otros" bucket.

- [ ] **Step 2: Wire into Flujo section on dashboard**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```
feat: add waterfall cash flow chart
```

---

### Task 15: Cash Flow View Toggle (Line ↔ Bar)

**Files:**
- Create: `webapp/src/components/charts/cash-flow-view-toggle.tsx`

- [ ] **Step 1: Build toggle wrapper**

Client component. Contains a tab bar (Line | Barras) and renders either the existing `IncomeVsExpensesChart` logic (line) or the orphaned `MonthlyCashflowChart` logic (bar) based on selection.

Refactor: extract the chart rendering from both existing components into this new component. The data prop is the same: `MonthlyCashflow[]` from `getMonthlyCashflow`.

- [ ] **Step 2: Replace IncomeVsExpensesChart usage in dashboard with CashFlowViewToggle**

Update the Flujo section to render this component instead of the old `IncomeVsExpensesChart`.

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```
feat: add cash flow line/bar view toggle
```

---

### Task 16: Category Donut

**Files:**
- Create: `webapp/src/components/charts/category-donut.tsx`

- [ ] **Step 1: Build donut chart with legend**

Client component. Recharts `PieChart` with `innerRadius="65%"`. Center text: total amount. Legend list on the right (or below on mobile) with color dot, name, amount.

Max 6 categories + "Otros" bucket. Sorted by amount descending.

Props: `data: CategorySpending[]`, `currency: CurrencyCode`

- [ ] **Step 2: Wire into Presupuesto section**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```
feat: add category spending donut chart
```

---

### Task 17: Spending Heatmap

**Files:**
- Create: `webapp/src/components/charts/spending-heatmap.tsx`

- [ ] **Step 1: Build heatmap component**

Client component. CSS grid: 7 columns (Lun-Dom), rows = weeks in month. Each cell: colored div with opacity based on level (0-4). Color scale uses `z-expense` at 0%, 20%, 40%, 60%, 100% opacity.

Day labels row above the grid. Legend bar below (Menos → Mas with 5 color swatches).

Pattern detection text below: "Gastas {ratio}x mas los {day}" + "Dias sin gasto: {count}".

Props: `data: HeatmapData`

- [ ] **Step 2: Wire into Actividad section**

- [ ] **Step 3: Verify build + dev test**

- [ ] **Step 4: Commit**

```
feat: add spending heatmap calendar visualization
```

---

## Phase 6: Budget & Debt Widgets

### Task 18: 50/30/20 Allocation Bars

**Files:**
- Create: `webapp/src/components/budget/allocation-bars-5030.tsx`

- [ ] **Step 1: Build allocation bars component**

Server component. Three horizontal bars: Necesidades (50%), Deseos (30%), Ahorro/Deuda (20%). Each bar has:
- Label + "(meta: X%)" + actual % + actual amount (right-aligned)
- Colored progress bar with fill at actual %
- Dashed vertical line at target %
- Sub-text listing category names in that bucket

Color logic: green if within target, yellow if 1-10% over, red if >10% over.

Props: `data: AllocationData`

- [ ] **Step 2: Wire into Presupuesto section on dashboard**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```
feat: add 50/30/20 budget allocation bars
```

---

### Task 19: Debt-Free Countdown Card

**Files:**
- Create: `webapp/src/components/debt/debt-free-countdown.tsx`

- [ ] **Step 1: Build countdown component**

Server component. Shows:
- Large number: "{N} meses" or "Libre de deudas!" if null debt
- Projected date
- Progress bar: original → current → $0
- Extra payment nudge box with savings highlight

Props from `getDebtFreeCountdown` return type.

Edge case: if `getDebtFreeCountdown` returns null (no debts), render celebratory empty state.

- [ ] **Step 2: Wire into Patrimonio section**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```
feat: add debt-free countdown card
```

---

### Task 20: KPI Widgets (Savings Rate, Emergency Fund, Interest Paid, Debt Progress)

**Files:**
- Create: `webapp/src/components/dashboard/savings-rate-widget.tsx`
- Create: `webapp/src/components/dashboard/emergency-fund-widget.tsx`
- Create: `webapp/src/components/dashboard/interest-paid-widget.tsx`
- Create: `webapp/src/components/dashboard/debt-progress-widget.tsx`

- [ ] **Step 1: Build all 4 KPI widgets**

Each follows the existing `KPIWidget` component pattern from `webapp/src/components/ui/kpi-widget.tsx`. Small server components wrapping `KPIWidget` with computed data.

- **SavingsRateWidget**: value from health meters (ahorro), progress bar 0-50%, 20% target marker
- **EmergencyFundWidget**: value from health meters (colchon), segmented bar (current | gap to 3m | gap to 6m)
- **InterestPaidWidget**: value from `getInterestPaid`, trend vs previous month, YTD total
- **DebtProgressWidget**: per-account progress bars from loan snapshots (initial_amount, remaining_balance)

- [ ] **Step 2: Wire into Patrimonio section as optional widgets**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```
feat: add savings rate, emergency fund, interest paid, and debt progress widgets
```

---

## Phase 7: Wire Orphaned Components

### Task 21: Wire Net Worth History Chart

**Files:**
- Modify: `webapp/src/components/charts/net-worth-history-chart.tsx` (if props need adjustment)
- Already wired into Patrimonio section via Task 10

- [ ] **Step 1: Verify NetWorthHistoryChart props match getNetWorthHistory return type**

Read both files. If props don't match, adjust the chart component.

- [ ] **Step 2: Ensure the chart renders in the Patrimonio section when widget is enabled**

Data: `getNetWorthHistory(month, currency)` — already exists in `charts.ts:570`.

- [ ] **Step 3: Verify in dev**

- [ ] **Step 4: Commit**

```
feat: wire net worth history chart into patrimonio section
```

---

## Phase 8: Mobile Alignment

### Task 22: Update Mobile Dashboard

**Files:**
- Modify: `webapp/src/components/mobile/mobile-dashboard.tsx`

- [ ] **Step 1: Refactor MobileDashboard to section-based layout**

Align with the desktop section structure:
1. Hero card with cash flow strip (abbreviated amounts)
2. Health meters compact card (tap → bottom sheet with speedometer)
3. Collapsible sections for remaining widgets
4. Default: first 3 sections open, rest collapsed with summary line

Reuse the same components (HealthMetersCard, WaterfallChart, etc.) — they should already be responsive.

- [ ] **Step 2: Add bottom sheet for expanded health meter on mobile**

Use shadcn `Sheet` component with `side="bottom"` to render `HealthMeterExpanded`.

- [ ] **Step 3: Test at 375px viewport width**

Run dev server, use browser devtools mobile viewport.

- [ ] **Step 4: Commit**

```
feat: align mobile dashboard with section-based widget layout
```

---

## Phase 9: Final Verification

### Task 23: Build Verification + Cleanup

- [ ] **Step 1: Run full build**

```bash
cd webapp && pnpm install && pnpm build
```

Must pass clean with no type errors.

- [ ] **Step 2: Test default widget configs**

Load dashboard with fresh user (no stored config). Verify all default widgets render. Toggle a widget off via gear icon. Refresh — verify it stays off (localStorage + DB sync).

- [ ] **Step 3: Test all 4 purpose configs**

Each `AppPurpose` (manage_debt, track_spending, save_money, improve_habits) should show different default widgets.

- [ ] **Step 4: Test mobile collapse behavior**

Verify sections collapse/expand on mobile. Verify summary lines show when collapsed.

- [ ] **Step 5: Clean up orphaned components**

Delete `EnhancedCashflowChart` if fully cannibalized. Delete `DailySpendingChart` if unused. Keep `MonthlyCashflowChart` only if it's imported by the new toggle — otherwise delete.

- [ ] **Step 6: Final commit**

```
chore: cleanup orphaned chart components
```

---

## Dependency Graph

```
Task 1 (types) ──┬── Task 2 (tokens + expense_type)
                  │
                  ├── Task 3 (health levels — pure functions)
                  │     └── Task 4 (getHealthMeters action)
                  │           └── Task 12 (health meters card)
                  │                 └── Task 13 (speedometer expanded)
                  │
                  ├── Task 5 (allocation action) ── Task 18 (5030 bars)
                  │
                  ├── Task 6 (heatmap action) ── Task 17 (heatmap component)
                  │
                  ├── Task 7 (debt countdown + interest paid actions)
                  │     ├── Task 19 (countdown card)
                  │     └── Task 20 (KPI widgets)
                  │
                  ├── Task 8 (DashboardSection) ──┐
                  ├── Task 9 (WidgetTogglePanel) ──┤
                  │                                └── Task 10 (dashboard page refactor — placeholder slots)
                  │                                      ├── Task 11 (hero strip — needs Task 2 for expense_type)
                  │                                      ├── Task 14 (waterfall)
                  │                                      ├── Task 15 (cashflow toggle)
                  │                                      ├── Task 16 (donut)
                  │                                      └── Task 21 (net worth wire)
                  │
                  └── Task 22 (mobile alignment — after all components exist)
                        └── Task 23 (final verification)
```

**Parallelizable groups:**
- Tasks 3, 5, 6, 7, 8, 9 can all run in parallel after Task 1+2
- Tasks 12, 14, 15, 16, 17, 18, 19, 20 can run in parallel after their respective data actions + Task 10
- Task 22 depends on all component tasks being complete
