# Debt Salary Bar Chart Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add salary breakdown visualization — a simple bar on the deudas page showing current debt-to-income split, and a full timeline chart in the scenario planner showing how the "libre" portion grows as debts are paid off.

**Architecture:** Shared calculation engine in packages/shared, income detection server action, two UI components (simple bar + timeline chart) using recharts. Color assignment is deterministic per account via hash.

**Tech Stack:** Next.js 15, TypeScript, recharts via shadcn ChartContainer, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-14-burn-rate-fab-salary-chart-design.md` (Feature 3)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/shared/src/utils/salary-breakdown.ts` | Shared calculation engine: single bar breakdown + timeline breakdowns + deterministic color hashing |
| Modify | `packages/shared/src/index.ts` | Re-export salary-breakdown module |
| Create | `webapp/src/actions/income.ts` | Server action: query INFLOW transactions, compute monthly average income |
| Create | `webapp/src/components/debt/salary-bar.tsx` | Simple stacked horizontal bar for deudas page |
| Create | `webapp/src/components/debt/salary-timeline-chart.tsx` | Full timeline stacked bar chart for scenario planner detail step |
| Modify | `webapp/src/app/(dashboard)/deudas/page.tsx` | Integrate SalaryBar between insights and per-account cards |
| Modify | `webapp/src/components/debt/planner/detail-step.tsx` | Add SalaryTimelineChart section below existing area chart |
| Modify | `webapp/src/components/debt/scenario-planner.tsx` | Pass `income` prop down to DetailStep |
| Modify | `webapp/src/app/(dashboard)/deudas/planificador/page.tsx` | Fetch income and pass to ScenarioPlanner |

---

## Chunk 1: Shared Calculation Engine

### Task 1: Create salary-breakdown utility

**Files:**
- Create: `packages/shared/src/utils/salary-breakdown.ts`
- Modify: `packages/shared/src/index.ts` (line 18, add re-export)

- [ ] **Step 1: Create the salary-breakdown module with types and functions**

```typescript
// packages/shared/src/utils/salary-breakdown.ts

import type { ScenarioResult, ScenarioMonth, ScenarioMonthAccount } from "./scenario-types";
// Note: DebtAccount and getMinPayment are NOT imported here — they are used
// by consumers (deudas page, planner) that call getCurrentSalaryBreakdown
// with pre-computed debtPayments. This module only needs scenario types.

// ── Types ──────────────────────────────────────────────────────

export interface SalaryBreakdownInput {
  monthlyIncome: number;
  debtPayments: { accountId: string; name: string; amount: number }[];
}

export interface SalarySegment {
  accountId: string | "libre" | "redirected";
  name: string;
  amount: number;
  percentage: number;
  color: string;
  redirectedTo?: string; // only in cascade mode
}

export interface MonthlyBreakdown {
  month: string; // "YYYY-MM" calendar month
  income: number;
  segments: SalarySegment[];
  freePercentage: number;
  paidOffThisMonth?: string[]; // account names that reached zero
}

// ── Color palette ──────────────────────────────────────────────

const DEBT_PALETTE = [
  "#dc2626", // red
  "#ea580c", // orange
  "#d97706", // amber
  "#7c3aed", // purple
  "#6366f1", // indigo
  "#0891b2", // cyan
] as const;

const LIBRE_COLOR = "#22c55e"; // green — always used for "libre"

/**
 * Deterministic color assignment based on account ID.
 * Uses a simple FNV-1a-inspired hash to pick from the palette.
 * Same account always gets the same color regardless of order.
 */
export function getDebtColor(accountId: string): string {
  let hash = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < accountId.length; i++) {
    hash ^= accountId.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as uint32
  }
  return DEBT_PALETTE[hash % DEBT_PALETTE.length];
}

// ── Single-bar breakdown (deudas page) ─────────────────────────

/**
 * Compute a single-month salary breakdown for the deudas page.
 * Each debt payment amount comes from getMinPayment() (minimum_payment
 * or 5%-of-balance fallback) — the same source the simulation engine uses.
 */
export function getCurrentSalaryBreakdown(
  input: SalaryBreakdownInput
): MonthlyBreakdown {
  const { monthlyIncome, debtPayments } = input;
  if (monthlyIncome <= 0) {
    return {
      month: "",
      income: 0,
      segments: [],
      freePercentage: 0,
    };
  }

  const segments: SalarySegment[] = [];
  let totalDebtPayments = 0;

  for (const dp of debtPayments) {
    const pct = (dp.amount / monthlyIncome) * 100;
    segments.push({
      accountId: dp.accountId,
      name: dp.name,
      amount: dp.amount,
      percentage: Math.min(pct, 100),
      color: getDebtColor(dp.accountId),
    });
    totalDebtPayments += dp.amount;
  }

  const freeAmount = Math.max(monthlyIncome - totalDebtPayments, 0);
  const freePercentage = (freeAmount / monthlyIncome) * 100;

  segments.push({
    accountId: "libre",
    name: "Libre",
    amount: freeAmount,
    percentage: freePercentage,
    color: LIBRE_COLOR,
  });

  return {
    month: "",
    income: monthlyIncome,
    segments,
    freePercentage,
  };
}

// ── Timeline breakdown (scenario planner) ──────────────────────

/**
 * Build monthly salary breakdowns from a completed ScenarioResult.
 *
 * In "simple" mode: when a debt is paid off its segment disappears and
 * the freed amount goes straight to "libre."
 *
 * In "cascade" mode: freed payments are shown as a striped "redirected"
 * segment colored toward the debt they're redirected to (matching the
 * scenario engine's cascade logic).
 */
export function getTimelineSalaryBreakdown(
  income: number,
  scenarioResult: ScenarioResult,
  mode: "simple" | "cascade"
): MonthlyBreakdown[] {
  if (income <= 0 || scenarioResult.timeline.length === 0) return [];

  // Build payoff month lookup: accountId -> calendarMonth
  const payoffMonthMap = new Map<string, string>();
  for (const entry of scenarioResult.payoffOrder) {
    payoffMonthMap.set(entry.accountId, entry.calendarMonth);
  }

  return scenarioResult.timeline.map((month: ScenarioMonth) => {
    const segments: SalarySegment[] = [];
    let totalPayments = 0;

    // Each active account's total payment this month
    for (const acctMonth of month.accounts) {
      const totalPayment =
        acctMonth.minimumPaymentApplied +
        acctMonth.extraPaymentApplied +
        (mode === "simple" ? acctMonth.cascadePaymentApplied : 0);

      if (totalPayment > 0) {
        segments.push({
          accountId: acctMonth.accountId,
          name: acctMonth.accountId, // resolved by UI from accounts lookup
          amount: totalPayment,
          percentage: (totalPayment / income) * 100,
          color: getDebtColor(acctMonth.accountId),
        });
        totalPayments += totalPayment;
      }

      // In cascade mode, show cascade payments as a separate "redirected" segment
      if (mode === "cascade" && acctMonth.cascadePaymentApplied > 0) {
        segments.push({
          accountId: "redirected",
          name: acctMonth.accountId, // the account receiving the redirect
          amount: acctMonth.cascadePaymentApplied,
          percentage: (acctMonth.cascadePaymentApplied / income) * 100,
          color: getDebtColor(acctMonth.accountId),
          redirectedTo: acctMonth.accountId,
        });
        totalPayments += acctMonth.cascadePaymentApplied;
      }
    }

    // "Libre" segment = income minus all debt payments
    const freeAmount = Math.max(income - totalPayments, 0);
    const freePercentage = (freeAmount / income) * 100;

    segments.push({
      accountId: "libre",
      name: "Libre",
      amount: freeAmount,
      percentage: freePercentage,
      color: LIBRE_COLOR,
    });

    // Detect payoffs this month
    const paidOffThisMonth = month.events
      .filter((e) => e.type === "account_paid_off")
      .map((e) => e.description);

    return {
      month: month.calendarMonth,
      income,
      segments,
      freePercentage,
      paidOffThisMonth: paidOffThisMonth.length > 0 ? paidOffThisMonth : undefined,
    };
  });
}
```

- [ ] **Step 2: Re-export from the shared package barrel**

In `packages/shared/src/index.ts`, add after line 17 (`export * from "./utils/scenario-engine";`):

```typescript
export * from "./utils/salary-breakdown";
```

- [ ] **Step 3: Verify the shared package builds**

```bash
cd packages/shared && pnpm build
# Expected: clean build, no type errors
```

**Commit:** `feat: add salary-breakdown calculation engine to shared package`

---

## Chunk 2: Income Detection

### Task 2: Create income server action

**Files:**
- Create: `webapp/src/actions/income.ts`

- [ ] **Step 1: Create the income detection server action**

The action queries INFLOW transactions (direction = "INFLOW") over available months and computes a monthly average. It returns the estimate plus enough info for the UI to show context.

```typescript
// webapp/src/actions/income.ts
"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { CurrencyCode } from "@zeta/shared";

export interface IncomeEstimate {
  monthlyAverage: number;
  currency: CurrencyCode;
  monthsOfData: number;
  totalIncome: number;
  recentTransactions: {
    id: string;
    description: string;
    amount: number;
    date: string;
  }[];
}

/**
 * Estimate monthly income from INFLOW transactions.
 * Queries all income transactions in the user's preferred currency,
 * groups by month, and returns the average.
 *
 * Excludes debt account inflows (credit card payments received, etc.)
 * by filtering to only checking/savings accounts.
 */
export async function getEstimatedIncome(
  currency?: CurrencyCode
): Promise<IncomeEstimate | null> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const baseCurrency = currency ?? "COP";

  // Get non-debt account IDs to filter transfers from credit cards
  const { data: liquidAccounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("account_type", ["CHECKING", "SAVINGS"]);

  const liquidAccountIds = liquidAccounts?.map((a) => a.id) ?? [];
  if (liquidAccountIds.length === 0) return null;

  // Fetch all INFLOW transactions in liquid accounts
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, description, amount, transaction_date, account_id")
    .eq("user_id", user.id)
    .eq("direction", "INFLOW")
    .eq("currency_code", baseCurrency)
    .in("account_id", liquidAccountIds)
    .order("transaction_date", { ascending: false });

  if (!transactions || transactions.length === 0) return null;

  // Group by "YYYY-MM" and compute monthly totals
  const monthlyTotals = new Map<string, number>();
  for (const tx of transactions) {
    const month = tx.transaction_date.slice(0, 7); // "YYYY-MM"
    monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + tx.amount);
  }

  const monthsOfData = monthlyTotals.size;
  const totalIncome = [...monthlyTotals.values()].reduce((s, v) => s + v, 0);
  const monthlyAverage = monthsOfData > 0 ? totalIncome / monthsOfData : 0;

  // Return most recent income transactions for user context (up to 10)
  const recentTransactions = transactions.slice(0, 10).map((tx) => ({
    id: tx.id,
    description: tx.description ?? "Ingreso",
    amount: tx.amount,
    date: tx.transaction_date,
  }));

  return {
    monthlyAverage,
    currency: baseCurrency,
    monthsOfData,
    totalIncome,
    recentTransactions,
  };
}
```

- [ ] **Step 2: Verify the action compiles**

```bash
cd webapp && pnpm build
# Expected: clean build, no type errors
```

**Commit:** `feat: add getEstimatedIncome server action for income detection`

---

## Chunk 3: Simple Bar (Deudas Page)

### Task 3: Create the simple salary bar component and integrate into deudas page

**Files:**
- Create: `webapp/src/components/debt/salary-bar.tsx`
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`

- [ ] **Step 1: Create the SalaryBar component**

This is a server component that receives pre-computed data. It renders:
1. Header row: "Tu salario hoy" + income amount + free percentage badge
2. A stacked horizontal bar (~40px tall) with colored segments per debt + green "Libre"
3. A legend below with colored dots, debt names, and monthly payment amounts
4. CTA card linking to the scenario planner

```typescript
// webapp/src/components/debt/salary-bar.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@zeta/shared";
import type { MonthlyBreakdown, SalarySegment } from "@zeta/shared";

interface Props {
  breakdown: MonthlyBreakdown;
  currency: CurrencyCode;
}

export function SalaryBar({ breakdown, currency }: Props) {
  const { income, segments, freePercentage } = breakdown;
  const debtSegments = segments.filter((s) => s.accountId !== "libre");
  const libreSegment = segments.find((s) => s.accountId === "libre");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Tu salario hoy</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {formatCurrency(income, currency)}
            </span>
            <span
              className="text-lg font-bold"
              style={{ color: libreSegment?.color ?? "#22c55e" }}
            >
              {freePercentage.toFixed(0)}% libre
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked horizontal bar */}
        <div className="flex h-10 w-full overflow-hidden rounded-lg">
          {segments.map((seg) => (
            <div
              key={seg.accountId}
              className="flex items-center justify-center overflow-hidden transition-all"
              style={{
                width: `${Math.max(seg.percentage, 1)}%`,
                backgroundColor: seg.color,
              }}
            >
              {seg.percentage > 12 && (
                <span className="text-[11px] font-medium text-white truncate px-1">
                  {seg.name}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((seg) => (
            <div
              key={seg.accountId}
              className="flex items-center gap-1.5 text-xs"
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-muted-foreground">{seg.name}</span>
              <span className="font-medium">
                {formatCurrency(seg.amount, currency)}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {debtSegments.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              ¿Quieres ver cómo crece lo libre mes a mes?
            </p>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/deudas/planificador">
                Simular
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Integrate SalaryBar into the deudas page**

In `webapp/src/app/(dashboard)/deudas/page.tsx`:

1. Add imports at the top (after existing imports, around line 11):

```typescript
import { getEstimatedIncome } from "@/actions/income";
import { SalaryBar } from "@/components/debt/salary-bar";
import { getCurrentSalaryBreakdown, getMinPayment } from "@zeta/shared";
```

2. After `const overview = await getDebtOverview(currency);` (line 17), fetch income:

```typescript
const incomeEstimate = await getEstimatedIncome(currency);
```

3. Before the return statement of the main content (around line 47), compute breakdown:

```typescript
  // Salary breakdown — only if income is detected
  const salaryBreakdown = incomeEstimate && incomeEstimate.monthlyAverage > 0
    ? getCurrentSalaryBreakdown({
        monthlyIncome: incomeEstimate.monthlyAverage,
        debtPayments: overview.accounts
          .filter((a) => a.balance > 0)
          .map((a) => ({
            accountId: a.id,
            name: a.name,
            amount: getMinPayment(a),
          })),
      })
    : null;
```

4. Insert the SalaryBar between `{/* Insights */}` and `{/* Per-account cards */}` (between lines 82-84):

```tsx
      {/* Salary breakdown */}
      {salaryBreakdown && incomeEstimate && (
        <SalaryBar breakdown={salaryBreakdown} currency={currency} />
      )}
```

- [ ] **Step 3: Verify build**

```bash
cd webapp && pnpm build
# Expected: clean build, SalaryBar renders on /deudas
```

**Commit:** `feat: add salary breakdown bar to deudas page`

---

## Chunk 4: Timeline Chart (Scenario Planner)

### Task 4: Create the salary timeline chart and integrate into detail step

**Files:**
- Create: `webapp/src/components/debt/salary-timeline-chart.tsx`
- Modify: `webapp/src/components/debt/planner/detail-step.tsx`
- Modify: `webapp/src/components/debt/scenario-planner.tsx`
- Modify: `webapp/src/app/(dashboard)/deudas/planificador/page.tsx`

- [ ] **Step 1: Create the SalaryTimelineChart component**

This is a "use client" component that:
1. Shows a recharts BarChart with stacked bars (one bar per month)
2. Has a Simple/Cascada toggle (re-renders from same scenario data, both modes computed client-side)
3. Shows payoff milestone pills below the chart
4. Shows a summary banner with debt-free date and libre percentage progression
5. Horizontally scrolls for timelines > 12 months on mobile

The component calls `getTimelineSalaryBreakdown()` from the shared package with the scenario result and the selected mode. It converts the `MonthlyBreakdown[]` into recharts-compatible stacked bar data.

```typescript
// webapp/src/components/debt/salary-timeline-chart.tsx
"use client";

import { useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import {
  type DebtAccount,
  type ScenarioResult,
  type CurrencyCode,
  getTimelineSalaryBreakdown,
  getDebtColor,
} from "@zeta/shared";

const SPANISH_MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatCalendarMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const monthIdx = Number(month) - 1;
  return `${SPANISH_MONTHS[monthIdx] ?? month} ${year}`;
}

function formatShortMonth(yyyyMm: string): string {
  const [, month] = yyyyMm.split("-");
  const monthIdx = Number(month) - 1;
  return SPANISH_MONTHS[monthIdx] ?? month;
}

interface Props {
  accounts: DebtAccount[];
  income: number;
  result: ScenarioResult;
  currency?: CurrencyCode;
}

export function SalaryTimelineChart({
  accounts,
  income,
  result,
  currency,
}: Props) {
  const [mode, setMode] = useState<"simple" | "cascade">("simple");

  // Build account name lookup
  const accountNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) {
      map.set(a.id, a.name);
    }
    return map;
  }, [accounts]);

  // Compute breakdowns for selected mode
  const breakdowns = useMemo(
    () => getTimelineSalaryBreakdown(income, result, mode),
    [income, result, mode]
  );

  // Build recharts data: each month is a row, each account+libre is a column
  // The dataKey for each account is `acct_{accountId}`, plus `libre`
  const activeAccountIds = useMemo(() => {
    const ids = new Set<string>();
    for (const bd of breakdowns) {
      for (const seg of bd.segments) {
        if (seg.accountId !== "libre" && seg.accountId !== "redirected") {
          ids.add(seg.accountId);
        }
      }
    }
    return [...ids];
  }, [breakdowns]);

  const chartData = useMemo(() => {
    return breakdowns.map((bd) => {
      const row: Record<string, number | string> = {
        month: formatShortMonth(bd.month),
        fullMonth: formatCalendarMonth(bd.month),
      };
      // Initialize all to 0
      for (const id of activeAccountIds) {
        row[`acct_${id}`] = 0;
      }
      row.libre = 0;

      for (const seg of bd.segments) {
        if (seg.accountId === "libre") {
          row.libre = seg.amount;
        } else if (seg.accountId === "redirected") {
          // In cascade mode, add to the target account's key with a suffix
          const key = `redir_${seg.redirectedTo}`;
          row[key] = (Number(row[key]) || 0) + seg.amount;
        } else {
          row[`acct_${seg.accountId}`] = seg.amount;
        }
      }
      return row;
    });
  }, [breakdowns, activeAccountIds]);

  // Chart config for recharts
  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    for (const id of activeAccountIds) {
      const name = accountNames.get(id) ?? id;
      cfg[`acct_${id}`] = {
        label: name,
        color: getDebtColor(id),
      };
      if (mode === "cascade") {
        cfg[`redir_${id}`] = {
          label: `${name} (cascada)`,
          color: getDebtColor(id),
        };
      }
    }
    cfg.libre = {
      label: "Libre",
      color: "#22c55e",
    };
    return cfg;
  }, [activeAccountIds, accountNames, mode]);

  // Payoff milestones
  const milestones = result.payoffOrder.map((entry) => ({
    name: accountNames.get(entry.accountId) ?? entry.accountName,
    month: formatCalendarMonth(entry.calendarMonth),
    color: getDebtColor(entry.accountId),
  }));

  // Summary: first and last libre percentages
  const firstFree = breakdowns[0]?.freePercentage ?? 0;
  const lastMonth = breakdowns[breakdowns.length - 1];

  // Chart width: min 40px per bar, at least full container width
  const chartMinWidth = Math.max(breakdowns.length * 40, 300);
  const needsScroll = breakdowns.length > 12;

  if (income <= 0 || breakdowns.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">
            Distribución del salario
          </CardTitle>
          <div className="flex rounded-lg border p-0.5">
            <Button
              variant={mode === "simple" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setMode("simple")}
            >
              Simple
            </Button>
            <Button
              variant={mode === "cascade" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setMode("cascade")}
            >
              Cascada
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked bar chart */}
        <div className={needsScroll ? "overflow-x-auto" : ""}>
          <div style={{ minWidth: needsScroll ? `${chartMinWidth}px` : "100%" }}>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[300px] w-full"
            >
              <BarChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                    return String(v);
                  }}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as Record<string, number | string>;
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                        <p className="font-medium mb-1.5">{String(d.fullMonth)}</p>
                        <div className="space-y-1">
                          {payload
                            .filter((p) => Number(p.value) > 0)
                            .map((p) => (
                              <div key={p.dataKey} className="flex items-center gap-2">
                                <div
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: String(p.color) }}
                                />
                                <span className="text-muted-foreground">
                                  {chartConfig[String(p.dataKey)]?.label ?? p.dataKey}:
                                </span>
                                <span className="font-medium ml-auto">
                                  {formatCurrency(Number(p.value), currency)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Debt segments (stacked) */}
                {activeAccountIds.map((id) => (
                  <Bar
                    key={`acct_${id}`}
                    dataKey={`acct_${id}`}
                    stackId="salary"
                    fill={getDebtColor(id)}
                  />
                ))}

                {/* Cascade redirect segments (striped via opacity) */}
                {mode === "cascade" &&
                  activeAccountIds.map((id) => (
                    <Bar
                      key={`redir_${id}`}
                      dataKey={`redir_${id}`}
                      stackId="salary"
                      fill={getDebtColor(id)}
                      fillOpacity={0.4}
                    />
                  ))}

                {/* Libre segment (always on top) */}
                <Bar
                  dataKey="libre"
                  stackId="salary"
                  fill="#22c55e"
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 justify-center">
          {activeAccountIds.map((id) => (
            <div key={id} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getDebtColor(id) }}
              />
              <span className="text-muted-foreground">
                {accountNames.get(id) ?? id}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: "#22c55e" }}
            />
            <span className="text-muted-foreground">Libre</span>
          </div>
        </div>

        {/* Payoff milestones */}
        {milestones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {milestones.map((m) => (
              <Badge
                key={m.name}
                variant="secondary"
                className="text-xs gap-1.5"
              >
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                {m.name} se paga en {m.month}
              </Badge>
            ))}
          </div>
        )}

        {/* Summary banner */}
        {lastMonth && (
          <div className="rounded-lg bg-green-50/60 border border-green-200/50 px-4 py-3">
            <p className="text-sm text-green-800">
              En{" "}
              <span className="font-semibold">
                {formatCalendarMonth(result.debtFreeDate)}
              </span>{" "}
              eres libre de deuda. Tu salario pasa de{" "}
              <span className="font-semibold">{firstFree.toFixed(0)}%</span>{" "}
              libre a{" "}
              <span className="font-semibold">100%</span> libre en{" "}
              <span className="font-semibold">{result.totalMonths}</span>{" "}
              {result.totalMonths === 1 ? "mes" : "meses"}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add income prop to DetailStep**

In `webapp/src/components/debt/planner/detail-step.tsx`:

1. Add import at the top (after existing imports, around line 10):

```typescript
import { SalaryTimelineChart } from "@/components/debt/salary-timeline-chart";
```

2. Extend the `Props` interface (line 50-56) to include `income`:

```typescript
interface Props {
  accounts: DebtAccount[];
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency?: CurrencyCode;
  income?: number;  // monthly income for salary timeline
}
```

3. Destructure `income` in the component signature (line 147):

```typescript
export function DetailStep({
  accounts,
  scenarios,
  results,
  baseline,
  currency,
  income,
}: Props) {
```

4. Add the SalaryTimelineChart at the end of the component, before the closing `</div>` (after the per-account area chart card, around line 550):

```tsx
      {/* Salary timeline chart */}
      {income && income > 0 && result && (
        <SalaryTimelineChart
          accounts={accounts}
          income={income}
          result={result}
          currency={currency}
        />
      )}
```

- [ ] **Step 3: Thread income through ScenarioPlanner**

In `webapp/src/components/debt/scenario-planner.tsx`:

1. Add `income` to the `Props` interface (line 115-119):

```typescript
interface Props {
  accounts: DebtAccount[];
  currency?: CurrencyCode;
  savedScenarios: unknown[];
  income?: number;
}
```

2. Destructure `income` in the component (line 121):

```typescript
export function ScenarioPlanner({ accounts, currency, savedScenarios, income }: Props) {
```

3. Pass `income` to `DetailStep` (around line 200):

```tsx
          <DetailStep
            accounts={accounts}
            scenarios={state.scenarios}
            results={results}
            baseline={baseline}
            currency={currency}
            income={income}
          />
```

- [ ] **Step 4: Fetch income in the planificador page**

In `webapp/src/app/(dashboard)/deudas/planificador/page.tsx`:

1. Add import (after line 3):

```typescript
import { getEstimatedIncome } from "@/actions/income";
```

2. Fetch income alongside existing data fetches (after line 13):

```typescript
  const incomeEstimate = await getEstimatedIncome(currency);
```

3. Pass income to ScenarioPlanner (around line 58):

```tsx
      <ScenarioPlanner
        accounts={activeDebts}
        currency={currency}
        savedScenarios={savedScenarios}
        income={incomeEstimate?.monthlyAverage}
      />
```

- [ ] **Step 5: Verify full build**

```bash
cd webapp && pnpm build
# Expected: clean build, no type errors
# Verify /deudas shows the salary bar (if income transactions exist)
# Verify /deudas/planificador detail tab shows the salary timeline chart
```

**Commit:** `feat: add salary timeline chart to scenario planner detail step`

---

## Verification Checklist

After all chunks are implemented:

- [ ] `pnpm install` — lockfile is up to date (no new deps added in this feature)
- [ ] `pnpm build` (from repo root) — clean build, no type errors
- [ ] Navigate to `/deudas` — salary bar appears between insights and per-account cards (only when income data exists)
- [ ] Salary bar segments use deterministic colors per account (same account = same color across reloads)
- [ ] Salary bar legend shows all debts + "Libre" with amounts
- [ ] CTA "Simular" links to `/deudas/planificador`
- [ ] Navigate to `/deudas/planificador` -> Detail tab — salary timeline chart appears below the existing area chart
- [ ] Simple/Cascada toggle works (chart re-renders with different segment distribution)
- [ ] Payoff milestone pills show correct account names and months
- [ ] Summary banner shows correct debt-free date and libre percentage progression
- [ ] Timeline chart scrolls horizontally on mobile for >12 month timelines
- [ ] No income data scenario: salary bar does not render, timeline chart does not render (graceful degradation)
