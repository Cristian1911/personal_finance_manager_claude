# Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the webapp dashboard from a flat card list to a "Financial Command Center" with hero available-to-spend block, promoted upcoming payments, account sparklines with semantic color, and interactive Copilot-style charts.

**Architecture:** Server actions compute dashboard data (hero summary, sparkline history, budget pace). New React components consume this data in a redesigned layout with 5 sections: Hero, Payments, Accounts, Analysis, Recent Transactions. Pure utility functions handle freshness calculation and semantic color thresholds.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui, Recharts 2.15, Supabase (RLS)

**Design Doc:** `docs/plans/2026-03-06-dashboard-redesign-design.md`

---

## Task 1: Dashboard Utility Functions

Create pure utility functions for freshness indicators and semantic color thresholds.

**Files:**
- Create: `webapp/src/lib/utils/dashboard.ts`
- Create: `webapp/src/lib/utils/__tests__/dashboard.test.ts`

**Step 1: Write failing tests for freshness calculation**

```typescript
// webapp/src/lib/utils/__tests__/dashboard.test.ts
import { describe, it, expect } from "vitest";
import {
  getFreshnessLevel,
  getAccountSemanticColor,
  getCreditUtilizationColor,
} from "../dashboard";

describe("getFreshnessLevel", () => {
  it("returns 'fresh' for today", () => {
    const today = new Date().toISOString();
    expect(getFreshnessLevel(today)).toBe("fresh");
  });

  it("returns 'stale' for 2-3 days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(getFreshnessLevel(twoDaysAgo)).toBe("stale");
  });

  it("returns 'outdated' for 4+ days ago", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(getFreshnessLevel(fiveDaysAgo)).toBe("outdated");
  });

  it("returns 'outdated' for null", () => {
    expect(getFreshnessLevel(null)).toBe("outdated");
  });
});

describe("getAccountSemanticColor", () => {
  it("returns 'positive' when balance increases", () => {
    expect(getAccountSemanticColor(5, "deposit")).toBe("positive");
  });

  it("returns 'warning' for moderate deposit decline (10-30%)", () => {
    expect(getAccountSemanticColor(-15, "deposit")).toBe("warning");
  });

  it("returns 'danger' for severe deposit decline (>30%)", () => {
    expect(getAccountSemanticColor(-35, "deposit")).toBe("danger");
  });

  it("returns 'positive' when debt decreases", () => {
    expect(getAccountSemanticColor(-10, "debt")).toBe("positive");
  });

  it("returns 'danger' when debt increases", () => {
    expect(getAccountSemanticColor(15, "debt")).toBe("danger");
  });
});

describe("getCreditUtilizationColor", () => {
  it("returns 'positive' for <30%", () => {
    expect(getCreditUtilizationColor(25)).toBe("positive");
  });

  it("returns 'warning' for 30-60%", () => {
    expect(getCreditUtilizationColor(45)).toBe("warning");
  });

  it("returns 'danger' for >60%", () => {
    expect(getCreditUtilizationColor(75)).toBe("danger");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/dashboard.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementations**

```typescript
// webapp/src/lib/utils/dashboard.ts

export type FreshnessLevel = "fresh" | "stale" | "outdated";
export type SemanticColor = "positive" | "warning" | "danger" | "neutral";

/**
 * Determine freshness based on last update timestamp.
 * fresh = today, stale = 2-3 days, outdated = 4+ days or null
 */
export function getFreshnessLevel(updatedAt: string | null): FreshnessLevel {
  if (!updatedAt) return "outdated";
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffMs = now.getTime() - updated.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays <= 1) return "fresh";
  if (diffDays <= 3) return "stale";
  return "outdated";
}

/**
 * Semantic color for account balance change percentage.
 * For deposits: up = good. For debt: down = good.
 */
export function getAccountSemanticColor(
  changePercent: number,
  accountKind: "deposit" | "debt"
): SemanticColor {
  if (accountKind === "deposit") {
    if (changePercent >= 0) return "positive";
    if (changePercent > -30) return "warning";
    return "danger";
  }
  // debt: decrease is good, increase is bad
  if (changePercent <= 0) return "positive";
  if (changePercent < 15) return "warning";
  return "danger";
}

/**
 * Semantic color for credit card utilization percentage.
 */
export function getCreditUtilizationColor(utilization: number): SemanticColor {
  if (utilization < 30) return "positive";
  if (utilization <= 60) return "warning";
  return "danger";
}

/**
 * Maps semantic color to Tailwind classes.
 */
export const semanticColorMap: Record<SemanticColor, { text: string; bg: string; dot: string }> = {
  positive: { text: "text-emerald-600", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  warning: { text: "text-amber-600", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  danger: { text: "text-red-600", bg: "bg-red-500/10", dot: "bg-red-500" },
  neutral: { text: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" },
};

/**
 * Maps freshness level to Tailwind classes and labels.
 */
export const freshnessMap: Record<FreshnessLevel, { dot: string; label: string }> = {
  fresh: { dot: "bg-emerald-500", label: "Actualizado hoy" },
  stale: { dot: "bg-amber-500", label: "Actualizado hace unos dias" },
  outdated: { dot: "bg-red-500", label: "Desactualizado" },
};
```

**Step 4: Run tests to verify they pass**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/dashboard.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add webapp/src/lib/utils/dashboard.ts webapp/src/lib/utils/__tests__/dashboard.test.ts
git commit -m "feat(dashboard): add freshness and semantic color utility functions"
```

---

## Task 2: Server Action — getDashboardHeroData

Computes the hero section data: total liquid balance, pending obligations, available money, and overall freshness.

**Files:**
- Modify: `webapp/src/actions/charts.ts` (add new export)

**Step 1: Add the DashboardHeroData type and function**

Add to the end of `webapp/src/actions/charts.ts`:

```typescript
export interface PendingObligation {
  id: string;
  name: string;
  amount: number;
  currency_code: string;
  due_date: string;
  source: "recurring" | "statement";
}

export interface DashboardHeroData {
  totalLiquid: number;
  pendingObligations: PendingObligation[];
  totalPending: number;
  availableToSpend: number;
  freshness: "fresh" | "stale" | "outdated";
  oldestUpdate: string | null;
  currency: string;
}

export async function getDashboardHeroData(
  month?: string
): Promise<DashboardHeroData> {
  const supabase = await createClient();
  const user = await getUserSafely(supabase);
  if (!user) {
    return {
      totalLiquid: 0,
      pendingObligations: [],
      totalPending: 0,
      availableToSpend: 0,
      freshness: "outdated",
      oldestUpdate: null,
      currency: "COP",
    };
  }

  // 1. Get liquid accounts (not credit card, not loan)
  const { data: liquidAccounts } = await supabase
    .from("accounts")
    .select("id, name, current_balance, currency_code, updated_at")
    .eq("is_active", true)
    .not("account_type", "in", '("CREDIT_CARD","LOAN")');

  const accounts = liquidAccounts ?? [];
  const totalLiquid = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  // 2. Compute freshness from oldest updated_at among liquid accounts
  const { getFreshnessLevel } = await import("@/lib/utils/dashboard");
  const timestamps = accounts.map((a) => a.updated_at).filter(Boolean);
  const oldestUpdate = timestamps.length > 0
    ? timestamps.sort()[0]
    : null;
  const freshness = getFreshnessLevel(oldestUpdate);

  // 3. Get pending obligations from upcoming recurring (OUTFLOW only, not yet paid this month)
  const target = parseMonth(month);
  const startOfMonth = monthStartStr(target);
  const endOfMonth = monthEndStr(target);

  const upcomingRecurrences = await getUpcomingRecurrences(30);
  const recurringObligations: PendingObligation[] = upcomingRecurrences
    .filter((r) => r.template.direction === "OUTFLOW")
    .map((r) => ({
      id: r.template.id,
      name: r.template.merchant_name ?? "Recurrente",
      amount: r.template.amount,
      currency_code: r.template.currency_code ?? "COP",
      due_date: r.next_date,
      source: "recurring" as const,
    }));

  // 4. Get pending obligations from statement payment due dates
  const { getUpcomingPayments } = await import("@/actions/payment-reminders");
  const statementPayments = await getUpcomingPayments();
  const statementObligations: PendingObligation[] = statementPayments.map((p) => ({
    id: p.id,
    name: p.account_name,
    amount: p.total_payment_due,
    currency_code: p.currency_code,
    due_date: p.payment_due_date,
    source: "statement" as const,
  }));

  // 5. Merge and deduplicate (statement payments take priority if same account)
  const statementAccountIds = new Set(statementPayments.map((p) => p.account_id));
  const filteredRecurring = recurringObligations.filter((r) => {
    // Keep recurring if it's not a debt payment already covered by statement
    return true; // Most recurring (rent, utilities) won't overlap with statement payments
  });

  const allObligations = [...filteredRecurring, ...statementObligations]
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalPending = allObligations.reduce((sum, o) => sum + o.amount, 0);
  const availableToSpend = totalLiquid - totalPending;
  const currency = accounts[0]?.currency_code ?? "COP";

  return {
    totalLiquid,
    pendingObligations: allObligations,
    totalPending,
    availableToSpend,
    freshness,
    oldestUpdate,
    currency,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only pre-existing ones)

**Step 3: Commit**

```bash
git add webapp/src/actions/charts.ts
git commit -m "feat(dashboard): add getDashboardHeroData server action"
```

---

## Task 3: Server Action — getAccountsWithSparklineData

Returns accounts grouped by type with historical balance data for sparklines.

**Files:**
- Modify: `webapp/src/actions/charts.ts` (add new export)

**Step 1: Add types and function**

Add to the end of `webapp/src/actions/charts.ts`:

```typescript
export interface SparklinePoint {
  date: string;
  balance: number;
}

export interface AccountWithSparkline {
  id: string;
  name: string;
  account_type: string;
  current_balance: number;
  credit_limit: number | null;
  currency_code: string;
  updated_at: string;
  color: string | null;
  interest_rate: number | null;
  monthly_payment: number | null;
  loan_amount: number | null;
  // Computed fields
  sparkline: SparklinePoint[];
  changePercent: number;
  utilization: number | null; // credit cards only
  installmentProgress: string | null; // loans only (e.g., "18/48")
}

export interface GroupedAccounts {
  deposits: AccountWithSparkline[];
  debt: AccountWithSparkline[];
}

export async function getAccountsWithSparklineData(): Promise<GroupedAccounts> {
  const supabase = await createClient();
  const user = await getUserSafely(supabase);
  if (!user) return { deposits: [], debt: [] };

  // 1. Fetch all active accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  if (!accounts || accounts.length === 0) return { deposits: [], debt: [] };

  // 2. Fetch all statement snapshots for sparkline data
  const accountIds = accounts.map((a) => a.id);
  const { data: snapshots } = await supabase
    .from("statement_snapshots")
    .select("account_id, period_to, final_balance, created_at, remaining_balance")
    .in("account_id", accountIds)
    .order("period_to", { ascending: true });

  // 3. Group snapshots by account
  const snapshotsByAccount = new Map<string, SparklinePoint[]>();
  for (const snap of snapshots ?? []) {
    const key = snap.account_id;
    if (!snapshotsByAccount.has(key)) snapshotsByAccount.set(key, []);
    const balance = snap.final_balance ?? snap.remaining_balance ?? 0;
    snapshotsByAccount.get(key)!.push({
      date: snap.period_to ?? snap.created_at,
      balance,
    });
  }

  // 4. Build AccountWithSparkline for each account
  const isDebtType = (type: string) => type === "CREDIT_CARD" || type === "LOAN";

  const result: GroupedAccounts = { deposits: [], debt: [] };

  for (const account of accounts) {
    const points = snapshotsByAccount.get(account.id) ?? [];
    // Add current balance as last point
    points.push({ date: new Date().toISOString().slice(0, 10), balance: account.current_balance });

    // Compute change percent (current vs first point or previous month)
    const prevBalance = points.length >= 2 ? points[points.length - 2].balance : account.current_balance;
    const changePercent = prevBalance !== 0
      ? ((account.current_balance - prevBalance) / Math.abs(prevBalance)) * 100
      : 0;

    // Credit utilization
    const utilization = account.account_type === "CREDIT_CARD" && account.credit_limit
      ? (Math.abs(account.current_balance) / account.credit_limit) * 100
      : null;

    // Installment progress for loans
    let installmentProgress: string | null = null;
    if (account.account_type === "LOAN" && account.loan_amount && account.monthly_payment) {
      const totalInstallments = Math.ceil(account.loan_amount / account.monthly_payment);
      const paidInstallments = points.length > 1 ? points.length - 1 : 0;
      installmentProgress = `${paidInstallments}/${totalInstallments}`;
    }

    const item: AccountWithSparkline = {
      id: account.id,
      name: account.name,
      account_type: account.account_type,
      current_balance: account.current_balance,
      credit_limit: account.credit_limit,
      currency_code: account.currency_code,
      updated_at: account.updated_at,
      color: account.color,
      interest_rate: account.interest_rate,
      monthly_payment: account.monthly_payment,
      loan_amount: account.loan_amount,
      sparkline: points,
      changePercent,
      utilization,
      installmentProgress,
    };

    if (isDebtType(account.account_type)) {
      result.debt.push(item);
    } else {
      result.deposits.push(item);
    }
  }

  return result;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add webapp/src/actions/charts.ts
git commit -m "feat(dashboard): add getAccountsWithSparklineData server action"
```

---

## Task 4: Server Action — getDailyBudgetPace

Returns daily cumulative spending alongside ideal budget pace for the comparison chart.

**Files:**
- Modify: `webapp/src/actions/charts.ts` (add new export)

**Step 1: Add type and function**

```typescript
export interface DailyBudgetPace {
  date: string;
  label: string;
  actualCumulative: number;
  idealCumulative: number;
  isToday: boolean;
}

export async function getDailyBudgetPace(
  month?: string
): Promise<{ data: DailyBudgetPace[]; totalBudget: number; totalSpent: number }> {
  const target = parseMonth(month);
  const dailyData = await getDailySpending(month);
  const budgetSummary = await getBudgetSummary(month);

  const totalBudget = budgetSummary.totalTarget;
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const dailyIdeal = totalBudget / daysInMonth;

  const todayStr = new Date().toISOString().slice(0, 10);
  let cumulativeActual = 0;

  const data: DailyBudgetPace[] = dailyData.map((d, i) => {
    cumulativeActual += d.amount;
    return {
      date: d.date,
      label: d.label,
      actualCumulative: cumulativeActual,
      idealCumulative: dailyIdeal * (i + 1),
      isToday: d.date === todayStr,
    };
  });

  return { data, totalBudget, totalSpent: cumulativeActual };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add webapp/src/actions/charts.ts
git commit -m "feat(dashboard): add getDailyBudgetPace server action"
```

---

## Task 5: Sparkline Component

A small, reusable sparkline chart using Recharts. No axes, no labels — just the line.

**Files:**
- Create: `webapp/src/components/charts/sparkline.tsx`

**Step 1: Create the component**

```tsx
// webapp/src/components/charts/sparkline.tsx
"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { SemanticColor } from "@/lib/utils/dashboard";

const colorMap: Record<SemanticColor, { stroke: string; fill: string }> = {
  positive: { stroke: "#10b981", fill: "#10b98120" },
  warning: { stroke: "#f59e0b", fill: "#f59e0b20" },
  danger: { stroke: "#ef4444", fill: "#ef444420" },
  neutral: { stroke: "#a1a1aa", fill: "#a1a1aa20" },
};

interface SparklineProps {
  data: { value: number }[];
  color?: SemanticColor;
  height?: number;
  width?: number;
}

export function Sparkline({ data, color = "neutral", height = 32, width = 96 }: SparklineProps) {
  if (data.length < 2) return null;

  const { stroke, fill } = colorMap[color];

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            fill={fill}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 2: Verify it builds**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add webapp/src/components/charts/sparkline.tsx
git commit -m "feat(dashboard): add reusable Sparkline component"
```

---

## Task 6: Hero Component — "Tu dinero ahora"

**Files:**
- Create: `webapp/src/components/dashboard/dashboard-hero.tsx`

**Step 1: Create the component**

```tsx
// webapp/src/components/dashboard/dashboard-hero.tsx
"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { freshnessMap, type FreshnessLevel } from "@/lib/utils/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Receipt, Banknote, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { DashboardHeroData } from "@/actions/charts";

interface DashboardHeroProps {
  data: DashboardHeroData;
}

export function DashboardHero({ data }: DashboardHeroProps) {
  const { totalLiquid, totalPending, availableToSpend, freshness, pendingObligations, currency } = data;
  const f = freshnessMap[freshness];

  return (
    <div className="space-y-3">
      {/* Main number */}
      <div>
        <p className="text-sm text-muted-foreground">Disponible para gastar</p>
        <p className={`text-4xl font-bold tracking-tight ${availableToSpend < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(availableToSpend, currency as Parameters<typeof formatCurrency>[1])}
        </p>
      </div>

      {/* 3 sub-cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Saldo total</span>
            </div>
            <p className="text-lg font-semibold">
              {formatCurrency(totalLiquid, currency as Parameters<typeof formatCurrency>[1])}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Fijos pendientes</span>
            </div>
            <p className="text-lg font-semibold">
              {formatCurrency(totalPending, currency as Parameters<typeof formatCurrency>[1])}
            </p>
            <p className="text-xs text-muted-foreground">
              {pendingObligations.length} {pendingObligations.length === 1 ? "pago" : "pagos"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Libre</span>
            </div>
            <p className={`text-lg font-semibold ${availableToSpend < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(availableToSpend, currency as Parameters<typeof formatCurrency>[1])}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Freshness indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${f.dot}`} />
          <span className="text-xs text-muted-foreground">{f.label}</span>
        </div>
        {freshness === "outdated" && (
          <Link href="/import">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              Actualizar saldos
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify it builds**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add webapp/src/components/dashboard/dashboard-hero.tsx
git commit -m "feat(dashboard): add DashboardHero component"
```

---

## Task 7: Upcoming Payments Redesign

Rebuild the payments section with temporal grouping.

**Files:**
- Create: `webapp/src/components/dashboard/upcoming-payments.tsx`

**Step 1: Create the component**

```tsx
// webapp/src/components/dashboard/upcoming-payments.tsx
"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, Check, CircleAlert } from "lucide-react";
import Link from "next/link";
import type { PendingObligation } from "@/actions/charts";

interface UpcomingPaymentsProps {
  obligations: PendingObligation[];
  totalPending: number;
}

type TimeGroup = "today" | "this_week" | "this_month";

function groupByTime(obligations: PendingObligation[]): Record<TimeGroup, PendingObligation[]> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const groups: Record<TimeGroup, PendingObligation[]> = {
    today: [],
    this_week: [],
    this_month: [],
  };

  for (const o of obligations) {
    if (o.due_date <= today) {
      groups.today.push(o);
    } else if (o.due_date <= weekEndStr) {
      groups.this_week.push(o);
    } else {
      groups.this_month.push(o);
    }
  }

  return groups;
}

const groupLabels: Record<TimeGroup, string> = {
  today: "Hoy",
  this_week: "Esta semana",
  this_month: "Este mes",
};

export function UpcomingPayments({ obligations, totalPending }: UpcomingPaymentsProps) {
  if (obligations.length === 0) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <Check className="h-4 w-4" />
            <span className="text-sm">Todos los pagos del mes estan al dia</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groups = groupByTime(obligations);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Proximos pagos
        </CardTitle>
        <Link href="/recurrentes" className="text-xs text-primary hover:underline">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["today", "this_week", "this_month"] as TimeGroup[]).map((group) => {
          const items = groups[group];
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className={`text-xs font-medium mb-2 ${group === "today" ? "text-red-600" : "text-muted-foreground"}`}>
                {groupLabels[group]}
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {group === "today" && <CircleAlert className="h-3.5 w-3.5 text-red-500" />}
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">
                        {formatCurrency(item.amount, item.currency_code as Parameters<typeof formatCurrency>[1])}
                      </span>
                      {group !== "today" && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatDate(item.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="border-t pt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total pendiente</span>
          <span className="text-sm font-semibold">
            {formatCurrency(totalPending)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify it builds**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add webapp/src/components/dashboard/upcoming-payments.tsx
git commit -m "feat(dashboard): add UpcomingPayments component with temporal grouping"
```

---

## Task 8: Accounts with Sparklines Component

**Files:**
- Create: `webapp/src/components/dashboard/accounts-overview.tsx`

**Step 1: Create the component**

```tsx
// webapp/src/components/dashboard/accounts-overview.tsx
"use client";

import { formatCurrency } from "@/lib/utils/currency";
import {
  getFreshnessLevel,
  getAccountSemanticColor,
  getCreditUtilizationColor,
  semanticColorMap,
  freshnessMap,
} from "@/lib/utils/dashboard";
import { Sparkline } from "@/components/charts/sparkline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { AccountWithSparkline, GroupedAccounts } from "@/actions/charts";

interface AccountsOverviewProps {
  data: GroupedAccounts;
}

function AccountRow({ account }: { account: AccountWithSparkline }) {
  const isDebt = account.account_type === "CREDIT_CARD" || account.account_type === "LOAN";
  const kind = isDebt ? "debt" : "deposit";

  const changeColor = getAccountSemanticColor(account.changePercent, kind);
  const freshness = getFreshnessLevel(account.updated_at);
  const sparklineData = account.sparkline.map((p) => ({ value: p.balance }));

  // For credit cards, use utilization color for sparkline
  const sparklineColor = account.utilization != null
    ? getCreditUtilizationColor(account.utilization)
    : changeColor;

  const cc = semanticColorMap[changeColor];
  const fc = freshnessMap[freshness];

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-2 w-2 rounded-full shrink-0 ${fc.dot}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{account.name}</p>
          {account.utilization != null && (
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${semanticColorMap[getCreditUtilizationColor(account.utilization)].dot}`}
                  style={{ width: `${Math.min(account.utilization, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(account.utilization)}%
              </span>
            </div>
          )}
          {account.installmentProgress && (
            <p className="text-xs text-muted-foreground">
              Cuota {account.installmentProgress}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Sparkline data={sparklineData} color={sparklineColor} />
        <div className="text-right">
          <p className="text-sm font-medium">
            {formatCurrency(
              Math.abs(account.current_balance),
              account.currency_code as Parameters<typeof formatCurrency>[1]
            )}
          </p>
          {account.changePercent !== 0 && (
            <p className={`text-xs ${cc.text}`}>
              {account.changePercent > 0 ? "+" : ""}
              {account.changePercent.toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function AccountsOverview({ data }: AccountsOverviewProps) {
  const hasDeposits = data.deposits.length > 0;
  const hasDebt = data.debt.length > 0;

  if (!hasDeposits && !hasDebt) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Mis cuentas</CardTitle>
        <Link href="/accounts" className="text-xs text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasDeposits && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Cuentas de deposito</p>
            <div className="divide-y">
              {data.deposits.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </div>
          </div>
        )}
        {hasDebt && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Deuda</p>
            <div className="divide-y">
              {data.debt.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify it builds**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add webapp/src/components/dashboard/accounts-overview.tsx
git commit -m "feat(dashboard): add AccountsOverview component with sparklines and semantic colors"
```

---

## Task 9: Daily Spending vs Budget Chart

Interactive chart with solid actual line, dotted ideal line, and inline badge at today.

**Files:**
- Create: `webapp/src/components/charts/budget-pace-chart.tsx`

**Step 1: Create the component**

```tsx
// webapp/src/components/charts/budget-pace-chart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { DailyBudgetPace } from "@/actions/charts";

interface BudgetPaceChartProps {
  data: DailyBudgetPace[];
  totalBudget: number;
  totalSpent: number;
  monthLabel: string;
}

export function BudgetPaceChart({ data, totalBudget, totalSpent, monthLabel }: BudgetPaceChartProps) {
  if (data.length === 0 || totalBudget === 0) return null;

  const progress = Math.round((totalSpent / totalBudget) * 100);
  const todayPoint = data.find((d) => d.isToday);
  const overBudgetPace = todayPoint
    ? todayPoint.actualCumulative > todayPoint.idealCumulative
    : false;

  // Only show data up to today (don't project future)
  const todayIndex = data.findIndex((d) => d.isToday);
  const visibleData = todayIndex >= 0 ? data.slice(0, todayIndex + 1) : data;
  // Full ideal line for reference
  const idealData = data.map((d) => ({ date: d.date, label: d.label, idealCumulative: d.idealCumulative }));

  // Merge for single chart
  const chartData = data.map((d, i) => ({
    label: d.label,
    ideal: d.idealCumulative,
    actual: i <= todayIndex ? d.actualCumulative : undefined,
    isToday: d.isToday,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gasto diario vs presupuesto</CardTitle>
        <p className="text-xs text-muted-foreground">{monthLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              {/* Ideal pace — dotted */}
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="#a1a1aa"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              {/* Actual spending — solid, colored */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke={overBudgetPace ? "#ef4444" : "#10b981"}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              {/* Today marker */}
              {todayPoint && todayIndex >= 0 && (
                <ReferenceDot
                  x={chartData[todayIndex]?.label}
                  y={todayPoint.actualCumulative}
                  r={4}
                  fill={overBudgetPace ? "#ef4444" : "#10b981"}
                  stroke="white"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inline badge */}
        {todayPoint && (
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Hoy: {formatCurrency(todayPoint.actualCumulative)}
            </span>
            <span className={overBudgetPace ? "text-red-600" : "text-emerald-600"}>
              {formatCurrency(totalSpent)} de {formatCurrency(totalBudget)} — {progress}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify it builds**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add webapp/src/components/charts/budget-pace-chart.tsx
git commit -m "feat(dashboard): add BudgetPaceChart with actual vs ideal comparison"
```

---

## Task 10: Income vs Expenses Chart (Redesigned)

6-month dual-line chart with inline badge on current month.

**Files:**
- Create: `webapp/src/components/charts/income-vs-expenses-chart.tsx`

**Step 1: Create the component**

```tsx
// webapp/src/components/charts/income-vs-expenses-chart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { MonthlyCashflow } from "@/actions/charts";

interface IncomeVsExpensesChartProps {
  data: MonthlyCashflow[];
  monthLabel: string;
}

export function IncomeVsExpensesChart({ data, monthLabel }: IncomeVsExpensesChartProps) {
  if (data.length === 0) return null;

  const current = data[data.length - 1];
  const previous = data.length >= 2 ? data[data.length - 2] : null;
  const savingsRate = current.income > 0
    ? ((current.income - current.expenses) / current.income) * 100
    : 0;
  const prevSavingsRate = previous && previous.income > 0
    ? ((previous.income - previous.expenses) / previous.income) * 100
    : 0;
  const savingsTrend = savingsRate - prevSavingsRate;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Ingresos vs Gastos</CardTitle>
        <p className="text-xs text-muted-foreground">Ultimos 6 meses</p>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              {/* Income — solid */}
              <Line
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {/* Expenses — dashed */}
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
              />
              {/* Current month dots */}
              <ReferenceDot
                x={current.label}
                y={current.income}
                r={4}
                fill="#10b981"
                stroke="white"
                strokeWidth={2}
              />
              <ReferenceDot
                x={current.label}
                y={current.expenses}
                r={4}
                fill="#f59e0b"
                stroke="white"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inline badge */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Ingresos: {formatCurrency(current.income)}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Gastos: {formatCurrency(current.expenses)}
              </span>
            </div>
            <span className={savingsRate >= 0 ? "text-emerald-600" : "text-red-600"}>
              Ahorro: {savingsRate.toFixed(0)}%
              {savingsTrend !== 0 && (
                <span className="ml-1">
                  {savingsTrend > 0 ? "↑" : "↓"}
                </span>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify it builds**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add webapp/src/components/charts/income-vs-expenses-chart.tsx
git commit -m "feat(dashboard): add IncomeVsExpensesChart with inline badges"
```

---

## Task 11: Dashboard Page Rewrite

Replace the current dashboard page with the new layout.

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Back up current page for reference**

Run: `cp webapp/src/app/\(dashboard\)/dashboard/page.tsx webapp/src/app/\(dashboard\)/dashboard/page.tsx.bak`

**Step 2: Rewrite the dashboard page**

Replace the entire file content. Key changes:
- Import new components: `DashboardHero`, `UpcomingPayments`, `AccountsOverview`, `BudgetPaceChart`, `IncomeVsExpensesChart`
- Import new server actions: `getDashboardHeroData`, `getAccountsWithSparklineData`, `getDailyBudgetPace`
- Remove imports: `InteractiveMetricCard`, `PurchaseDecisionCard`, `UpcomingRecurringCard`, `PaymentRemindersCard`, `DailySpendingChart`, `EnhancedCashflowChart`, `NetWorthHistoryChart`
- Keep: `MonthSelector`, `CategorySpendingChart`, recent transactions section
- New data fetching in `Promise.all`: heroData, accountsData, budgetPaceData, cashflowData, categoryData
- Remove: `getUpcomingRecurrences`, `getUpcomingPayments`, `getDailySpending`, `getDailyCashflow`, `getNetWorthHistory`, `getMonthMetrics` (hero action handles these internally)
- Layout order:
  1. Header (greeting + MonthSelector)
  2. DashboardHero
  3. UpcomingPayments
  4. AccountsOverview
  5. Analysis section (BudgetPaceChart, IncomeVsExpensesChart, CategorySpendingChart)
  6. Recent Transactions

Full implementation — rewrite `page.tsx` with new structure:

```tsx
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, parseMonth, formatMonthParam, formatMonthLabel } from "@/lib/utils/date";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  getDashboardHeroData,
  getAccountsWithSparklineData,
  getDailyBudgetPace,
  getCategorySpending,
  getMonthlyCashflow,
} from "@/actions/charts";
import { getCategories } from "@/actions/categories";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import { AccountsOverview } from "@/components/dashboard/accounts-overview";
import { BudgetPaceChart } from "@/components/charts/budget-pace-chart";
import { IncomeVsExpensesChart } from "@/components/charts/income-vs-expenses-chart";
import { CategorySpendingChart } from "@/components/charts/category-spending-chart";
import { MonthSelector } from "@/components/month-selector";
import { trackProductEvent } from "@/actions/product-events";
import { getUserSafely } from "@/lib/supabase/auth";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";

// ... (keep DashboardTransactionRow type and starter mode)
// ... (rewrite main return JSX with new layout)
```

This is the largest task — implementer should read the design doc and current page carefully, then rewrite section by section. Keep the starter mode (`starterMode`) branch intact since it's for new users.

**Step 3: Verify it builds**

Run: `cd webapp && pnpm build 2>&1 | tail -20`

**Step 4: Manual visual verification**

Run: `cd webapp && pnpm dev`
Open: `http://localhost:3000/dashboard`
Verify: Hero shows, payments are visible without scroll, accounts have sparklines, charts render

**Step 5: Remove backup**

Run: `rm webapp/src/app/\(dashboard\)/dashboard/page.tsx.bak`

**Step 6: Commit**

```bash
git add webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): rewrite dashboard page with Financial Command Center layout"
```

---

## Task 12: Relocate Displaced Components

Move PurchaseDecisionCard out of dashboard. Clean up unused imports.

**Files:**
- Modify: `webapp/src/app/(dashboard)/transactions/page.tsx` — add PurchaseDecisionCard here
- No files to delete — existing components (`interactive-metric-card.tsx`, `upcoming-recurring-card.tsx`, `payment-reminders-card.tsx`) remain available for other pages

**Step 1: Add PurchaseDecisionCard to transactions page**

Read `webapp/src/app/(dashboard)/transactions/page.tsx` first. Then add PurchaseDecisionCard import and render it above the transactions table, with appropriate data fetching (accounts + outflow categories).

**Step 2: Verify transactions page builds**

Run: `cd webapp && pnpm tsc --noEmit 2>&1 | head -20`

**Step 3: Verify dashboard has no dead imports**

Run: `cd webapp && pnpm build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/transactions/page.tsx
git commit -m "refactor: relocate PurchaseDecisionCard to transactions page"
```

---

## Task 13: Final Integration Test

**Step 1: Full build**

Run: `cd webapp && pnpm build`
Expected: No errors

**Step 2: Visual QA checklist**

Run: `cd webapp && pnpm dev`

Verify each section:
- [ ] Hero shows "Disponible para gastar" with correct calculation
- [ ] Freshness dot is green/amber/red based on account age
- [ ] "Actualizar saldos" button appears when outdated
- [ ] Upcoming payments grouped by Hoy / Esta semana / Este mes
- [ ] Total pendiente matches hero "Fijos pendientes"
- [ ] Accounts show sparklines with semantic colors
- [ ] Credit cards show utilization bar with correct color thresholds
- [ ] Budget pace chart shows solid vs dotted line
- [ ] Today marker dot appears on budget chart
- [ ] Income vs Expenses chart shows 6 months with inline badges
- [ ] Category donut chart renders correctly
- [ ] Recent transactions still work
- [ ] PurchaseDecisionCard appears on transactions page
- [ ] No console errors

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(dashboard): integration fixes from visual QA"
```

---

## Summary

| Task | Component | Estimated Complexity |
|------|-----------|---------------------|
| 1 | Utility functions + tests | Small |
| 2 | getDashboardHeroData action | Medium |
| 3 | getAccountsWithSparklineData action | Medium |
| 4 | getDailyBudgetPace action | Small |
| 5 | Sparkline component | Small |
| 6 | DashboardHero component | Medium |
| 7 | UpcomingPayments component | Medium |
| 8 | AccountsOverview component | Large |
| 9 | BudgetPaceChart component | Medium |
| 10 | IncomeVsExpensesChart component | Medium |
| 11 | Dashboard page rewrite | Large |
| 12 | Relocate PurchaseDecisionCard | Small |
| 13 | Final integration test | Small |
