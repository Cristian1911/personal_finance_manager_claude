# Burn Rate + Runway Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a forward-looking "Ritmo de gasto" card to the dashboard showing runway days, projected zero date, trend, and a burndown chart — with toggle between Total and Disponible modes.

**Architecture:** Server action computes burn rate from existing transactions + accounts. Returns both modes in one call. UI card with recharts burndown chart sits below the dashboard hero.

**Tech Stack:** Next.js 15 server actions, TypeScript, recharts via shadcn ChartContainer, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-14-burn-rate-fab-salary-chart-design.md` (Feature 1)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `webapp/src/actions/burn-rate.ts` | Server action: fetch accounts + transactions, compute BurnRateResult for both modes |
| Create | `webapp/src/components/dashboard/burn-rate-card.tsx` | UI card: headline, subtitle, toggle, recharts burndown chart |
| Modify | `webapp/src/app/(dashboard)/dashboard/page.tsx:210-321` | Add getBurnRate() to parallel fetch, render BurnRateCard below hero |
| Modify | `webapp/src/components/mobile/mobile-dashboard.tsx` | Add BurnRateCard to mobile dashboard layout |

---

## Chunk 1: Server Action

### Task 1: Create burn rate server action

**Files:**
- Create: `webapp/src/actions/burn-rate.ts`

- [ ] **Step 1: Create the server action file with types and getBurnRate()**

```typescript
// webapp/src/actions/burn-rate.ts
"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import type { CurrencyCode } from "@/types/domain";

export interface BurnRateDataPoint {
  date: string;       // "YYYY-MM-DD"
  balance: number;
}

export interface BurnRateResult {
  mode: "total" | "discretionary";
  dailyAverage: number;
  runwayDays: number;
  runwayDate: string;  // ISO date string
  trend: "accelerating" | "stable" | "decelerating";
  dataPoints: BurnRateDataPoint[];
  monthsOfData: number;
}

export interface BurnRateResponse {
  total: BurnRateResult;
  discretionary: BurnRateResult;
  liquidBalance: number;
  disponible: number;
  currency: CurrencyCode;
}

export async function getBurnRate(
  currency?: string
): Promise<BurnRateResponse | null> {
  const { supabase, user } = await getAuthenticatedClient();

  // 1. Fetch liquid accounts (checking + savings, not credit cards or loans)
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, current_balance, currency_code, account_type")
    .eq("user_id", user.id)
    .in("account_type", ["checking", "savings"]);

  if (!accounts || accounts.length === 0) return null;

  const baseCurrency = currency ?? "COP";
  const liquidAccounts = accounts.filter(
    (a) => a.currency_code === baseCurrency
  );
  const liquidBalance = liquidAccounts.reduce(
    (sum, a) => sum + (a.current_balance ?? 0),
    0
  );

  // 2. Fetch outflow transactions over all available months
  //    Use is_recurring flag to distinguish fixed vs discretionary (no recurring_template_id column exists)
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, amount, transaction_date, direction, is_recurring")
    .eq("user_id", user.id)
    .eq("direction", "OUTFLOW")
    .eq("currency_code", baseCurrency)
    .order("transaction_date", { ascending: true });

  if (!transactions || transactions.length === 0) return null;

  // 3. Get upcoming recurrences for pending obligations calculation
  const recurrences = await getUpcomingRecurrences(30);

  // 4. Compute pending obligations for disponible
  const totalPending = recurrences
    .filter(
      (r) =>
        r.template.direction === "OUTFLOW" &&
        (r.template.currency_code ?? "COP") === baseCurrency
    )
    .reduce((sum, r) => sum + r.template.amount, 0);

  const disponible = liquidBalance - totalPending;

  // 5. Split transactions into total vs discretionary using is_recurring flag
  const allOutflows = transactions;
  const discretionaryOutflows = transactions.filter((t) => !t.is_recurring);

  // 6. Compute both modes
  const today = new Date();
  const total = computeBurnRate(allOutflows, liquidBalance, today, "total");
  const discretionary = computeBurnRate(
    discretionaryOutflows,
    Math.max(disponible, 0),
    today,
    "discretionary"
  );

  return { total, discretionary, liquidBalance, disponible, currency: baseCurrency as CurrencyCode };
}

function computeBurnRate(
  transactions: { amount: number; transaction_date: string }[],
  balance: number,
  today: Date,
  mode: "total" | "discretionary"
): BurnRateResult {
  if (transactions.length === 0) {
    return {
      mode,
      dailyAverage: 0,
      runwayDays: 999,  // Infinity is not valid JSON — Next.js serializes it as null
      runwayDate: "",
      trend: "stable",
      dataPoints: [],
      monthsOfData: 0,
    };
  }

  // Date range
  const firstDate = new Date(transactions[0].transaction_date);
  const totalDays = Math.max(
    1,
    Math.ceil((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Group by day, sum spending per day (exclude zero-spend days)
  const dailySpending = new Map<string, number>();
  for (const t of transactions) {
    const key = t.transaction_date;
    dailySpending.set(key, (dailySpending.get(key) ?? 0) + t.amount);
  }

  const spendingDays = dailySpending.size;
  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const dailyAverage = spendingDays > 0 ? totalSpent / spendingDays : 0;

  // Runway
  const runwayDays =
    dailyAverage > 0 ? Math.round(balance / dailyAverage) : Infinity;
  const runwayDate = new Date(today);
  runwayDate.setDate(runwayDate.getDate() + (isFinite(runwayDays) ? runwayDays : 365));

  // Trend: last 14 days vs overall
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().slice(0, 10);

  let recentTotal = 0;
  let recentDays = 0;
  for (const [date, amount] of dailySpending) {
    if (date >= twoWeeksAgoStr) {
      recentTotal += amount;
      recentDays++;
    }
  }
  const recentAverage = recentDays > 0 ? recentTotal / recentDays : dailyAverage;

  let trend: BurnRateResult["trend"] = "stable";
  if (dailyAverage > 0) {
    const ratio = recentAverage / dailyAverage;
    if (ratio > 1.1) trend = "accelerating";
    else if (ratio < 0.9) trend = "decelerating";
  }

  // Months of data
  const monthsOfData = Math.max(1, Math.ceil(totalDays / 30));

  // Chart data points: reconstruct daily balance for current month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  // Walk backwards from current balance
  const currentMonthTxns = transactions.filter(
    (t) => t.transaction_date >= monthStartStr && t.transaction_date <= todayStr
  );
  // Sum spending after each day to reconstruct balances
  const dailySums = new Map<string, number>();
  for (const t of currentMonthTxns) {
    dailySums.set(
      t.transaction_date,
      (dailySums.get(t.transaction_date) ?? 0) + t.amount
    );
  }

  const dataPoints: BurnRateDataPoint[] = [];

  // Build array of dates from month start to today
  const dates: string[] = [];
  for (
    let d = new Date(monthStart);
    d <= today;
    d.setDate(d.getDate() + 1)
  ) {
    dates.push(d.toISOString().slice(0, 10));
  }

  // Reconstruct daily balances by walking backwards from today's known balance.
  // For each earlier day, add back the spending that happened AFTER that day.
  let b = balance;
  const balances = new Map<string, number>();
  for (let i = dates.length - 1; i >= 0; i--) {
    balances.set(dates[i], b);
    // Add back spending on this day (it reduced the balance from previous day)
    b += dailySums.get(dates[i]) ?? 0;
  }

  for (const date of dates) {
    dataPoints.push({ date, balance: balances.get(date) ?? balance });
  }

  // Add projected point at zero
  if (isFinite(runwayDays) && runwayDays > 0) {
    dataPoints.push({
      date: runwayDate.toISOString().slice(0, 10),
      balance: 0,
    });
  }

  return {
    mode,
    dailyAverage,
    runwayDays: isFinite(runwayDays) ? runwayDays : 999,
    runwayDate: runwayDate.toISOString().slice(0, 10),
    trend,
    dataPoints,
    monthsOfData,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to burn-rate.ts

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/burn-rate.ts
git commit -m "feat: add burn rate server action with total and discretionary modes"
```

---

## Chunk 2: UI Component

### Task 2: Create BurnRateCard component

**Files:**
- Create: `webapp/src/components/dashboard/burn-rate-card.tsx`

- [ ] **Step 1: Create the burn rate card component**

```typescript
// webapp/src/components/dashboard/burn-rate-card.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { BurnRateResponse } from "@/actions/burn-rate";

interface BurnRateCardProps {
  data: BurnRateResponse;
}

const chartConfig = {
  balance: { label: "Balance", color: "hsl(var(--chart-1))" },
};

export function BurnRateCard({ data }: BurnRateCardProps) {
  const [mode, setMode] = useState<"discretionary" | "total">("discretionary");
  const result = mode === "discretionary" ? data.discretionary : data.total;

  const trendLabel = {
    accelerating: "↑ Acelerando",
    stable: "→ Estable",
    decelerating: "↓ Desacelerando",
  }[result.trend];

  const trendColor = {
    accelerating: "text-red-400",
    stable: "text-zinc-400",
    decelerating: "text-green-400",
  }[result.trend];

  // Split data points into actual (past) and projected (future)
  const today = new Date().toISOString().slice(0, 10);
  const actualPoints = result.dataPoints.filter((p) => p.date <= today);
  const projectedPoints = result.dataPoints.filter((p) => p.date >= today);

  // Merge for chart: actual has balance, projected has projectedBalance
  const chartData = [
    ...actualPoints.map((p) => ({
      date: p.date,
      balance: p.balance,
      projected: undefined as number | undefined,
    })),
    ...projectedPoints.map((p, i) => ({
      date: p.date,
      balance: i === 0 ? p.balance : undefined as number | undefined,
      projected: p.balance,
    })),
  ];

  const isNegativeDisponible = mode === "discretionary" && data.disponible < 0;

  const runwayText =
    isNegativeDisponible
      ? "0 días"
      : result.runwayDays >= 999
        ? "∞"
        : `${result.runwayDays} días`;

  const runwayDateFormatted =
    result.runwayDays >= 999
      ? ""
      : `llegas a $0 el ${formatDate(new Date(result.runwayDate))}`;

  return (
    <Card>
      <CardContent className="p-5">
        {/* Header with toggle */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ritmo de gasto
          </span>
          <div className="flex rounded-md bg-muted p-0.5">
            <button
              onClick={() => setMode("discretionary")}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                mode === "discretionary"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Disponible
            </button>
            <button
              onClick={() => setMode("total")}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                mode === "total"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Total
            </button>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-1">
          <span className={`text-3xl font-bold ${isNegativeDisponible ? "text-destructive" : ""}`}>
            {runwayText}
          </span>
          <span className={`text-sm ml-2 font-medium ${trendColor}`}>
            {trendLabel}
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-sm text-muted-foreground mb-4">
          {runwayDateFormatted && (
            <>
              Al ritmo actual, {runwayDateFormatted} ·{" "}
            </>
          )}
          Promedio diario:{" "}
          <span className="text-foreground">
            {formatCurrency(result.dailyAverage, data.currency)}
          </span>
          {result.monthsOfData <= 1 && (
            <span className="text-xs text-muted-foreground/60 ml-1">
              · Basado en {result.monthsOfData} mes de datos
            </span>
          )}
        </p>

        {/* Burndown chart */}
        {chartData.length > 1 && (
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getDate()} ${d.toLocaleDateString("es", { month: "short" })}`;
                }}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v, data.currency)}
                tick={{ fontSize: 10 }}
                width={60}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeOpacity={0.3} />
              {/* Actual trajectory */}
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#burnGradient)"
                connectNulls={false}
              />
              {/* Projected trajectory */}
              <Area
                type="monotone"
                dataKey="projected"
                stroke="hsl(var(--chart-1))"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                connectNulls={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function BurnRateCardEmpty() {
  return (
    <Card>
      <CardContent className="p-5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Ritmo de gasto
        </span>
        <p className="text-sm text-muted-foreground mt-3">
          Importa tu primer extracto para ver tu ritmo de gasto.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to burn-rate-card.tsx

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/dashboard/burn-rate-card.tsx
git commit -m "feat: add BurnRateCard component with burndown chart"
```

---

### Task 3: Integrate into dashboard

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx:210-321`
- Modify: `webapp/src/components/mobile/mobile-dashboard.tsx`

- [ ] **Step 1: Add burn rate fetch to dashboard page**

In `webapp/src/app/(dashboard)/dashboard/page.tsx`:

1. Add imports at top:
```typescript
import { getBurnRate } from "@/actions/burn-rate";
import type { BurnRateResponse } from "@/actions/burn-rate";
import { BurnRateCard, BurnRateCardEmpty } from "@/components/dashboard/burn-rate-card";
```

2. Update the `Promise.all()` at line 210. Add `getBurnRate(currency)` as the 8th item and destructure it:
```typescript
const [heroData, accountsData, budgetPaceData, cashflowData, categoryData, allAccountsResult, latestSnapshotDates, burnRateData] =
  await Promise.all([
    getDashboardHeroData(month, currency),
    getAccountsWithSparklineData(),
    getDailyBudgetPace(month, currency),
    getMonthlyCashflow(month, currency),
    getCategorySpending(month, currency),
    getAccounts(),
    getLatestSnapshotDates(),
    getBurnRate(currency),
  ]);
```

3. Render the card in the desktop section, after `<DashboardHero>` (after line ~275) and before the 2-col grid (line ~278):
```tsx
{/* Burn Rate Card - below hero */}
{burnRateData ? (
  <BurnRateCard data={burnRateData} />
) : (
  <BurnRateCardEmpty />
)}
```

- [ ] **Step 2: Add to mobile dashboard**

1. In `webapp/src/components/mobile/mobile-dashboard.tsx`, add a new optional prop to `MobileDashboardProps` (line 15):
```typescript
interface MobileDashboardProps {
  heroData: { /* existing fields */ };
  upcomingPayments: Array<{ /* existing */ }>;
  recentTransactions: Array<{ /* existing */ }>;
  burnRateData?: BurnRateResponse | null;  // ADD THIS
}
```

2. Import the components:
```typescript
import type { BurnRateResponse } from "@/actions/burn-rate";
import { BurnRateCard, BurnRateCardEmpty } from "@/components/dashboard/burn-rate-card";
```

3. Render the card after the hero section in the mobile layout, before "Próximos pagos":
```tsx
{burnRateData ? (
  <BurnRateCard data={burnRateData} />
) : (
  <BurnRateCardEmpty />
)}
```

4. In `page.tsx`, pass the data where `<MobileDashboard>` is rendered (around line 253):
```tsx
<MobileDashboard
  heroData={mobileHeroData}
  upcomingPayments={mobileUpcomingPayments}
  recentTransactions={mobileRecentTx}
  burnRateData={burnRateData}  // ADD THIS
/>
```

- [ ] **Step 3: Verify build passes**

Run: `cd webapp && pnpm build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 4: Manual test**

Run: `cd webapp && pnpm dev`
Open dashboard in browser. Verify:
- Card appears below hero with "Ritmo de gasto" header
- Toggle switches between Disponible and Total
- Chart shows burndown line
- Runway days and date display correctly
- Mobile view shows the card too

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/(dashboard)/dashboard/page.tsx webapp/src/components/mobile/mobile-dashboard.tsx
git commit -m "feat: integrate burn rate card into dashboard and mobile view"
```
