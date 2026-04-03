# Debt Page Quick Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the debt page's verbose insights and scattered hero cards with a dense hero section (total debt + monthly payment + interest banner) and a categorized quick stats grid with per-account popovers.

**Architecture:** Rewrite `DebtHeroCard` to include monthly payment. Create `DebtQuickStats` component with `StatTile` sub-component for the 3x3 categorized metrics grid. Delete `InterestCostCard`, `UtilizationGauge`, and `DebtInsights`. Add `computeDebtStats()` pure function in `@zeta/shared` for all derived metrics. Update the page to wire new components. Update skeletons to match new layout.

**Tech Stack:** Next.js 15 (Server Components), React 19, TypeScript, Tailwind v4, shadcn/ui (Popover), `@zeta/shared` utilities, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/src/utils/debt-stats.ts` | Create | Pure functions: `computeDebtStats()` returning all derived metrics |
| `packages/shared/src/utils/__tests__/debt-stats.test.ts` | Create | Tests for `computeDebtStats()` |
| `packages/shared/src/index.ts` | Modify | Add `export * from "./utils/debt-stats"` |
| `webapp/src/components/debt/stat-tile.tsx` | Create | Reusable tile with popover |
| `webapp/src/components/debt/debt-hero-card.tsx` | Rewrite | Dense hero: debt + payment + interest banner |
| `webapp/src/components/debt/debt-quick-stats.tsx` | Create | 3-row categorized metrics grid |
| `webapp/src/components/debt/debt-skeletons.tsx` | Modify | Update skeletons to match new layout |
| `webapp/src/app/(dashboard)/deudas/page.tsx` | Modify | Wire new components, remove old imports |
| `webapp/src/components/debt/interest-cost-card.tsx` | Delete | Replaced by interest banner in hero |
| `webapp/src/components/debt/utilization-gauge.tsx` | Delete | Replaced by SVG ring tile |
| `webapp/src/components/debt/debt-insights.tsx` | Delete | Replaced by quick stats grid |

---

### Task 1: Add `computeDebtStats()` to `@zeta/shared`

**Files:**
- Create: `packages/shared/src/utils/debt-stats.ts`
- Create: `packages/shared/src/utils/__tests__/debt-stats.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write tests for `computeDebtStats()`**

Create `packages/shared/src/utils/__tests__/debt-stats.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeDebtStats } from "../debt-stats";
import { makeAccount } from "./helpers";

const cc1 = makeAccount({
  id: "cc1", name: "Nu", type: "CREDIT_CARD",
  balance: 3_000_000, creditLimit: 8_000_000, interestRate: 28,
  monthlyPayment: 890_000, paymentDay: 15,
});
const cc2 = makeAccount({
  id: "cc2", name: "Falabella", type: "CREDIT_CARD",
  balance: 5_000_000, creditLimit: 6_000_000, interestRate: 42.5,
  monthlyPayment: 450_000, paymentDay: 20,
});
const loan1 = makeAccount({
  id: "loan1", name: "Bancolombia", type: "LOAN",
  balance: 6_200_000, creditLimit: 18_000_000, interestRate: 18,
  monthlyPayment: 650_000, paymentDay: 5,
});

describe("computeDebtStats", () => {
  const stats = computeDebtStats([cc1, cc2, loan1]);

  it("computes totalMonthlyPayment across all accounts", () => {
    expect(stats.totalMonthlyPayment).toBe(890_000 + 450_000 + 650_000);
  });

  it("finds highest payment account", () => {
    expect(stats.highestPayment.accountName).toBe("Nu");
    expect(stats.highestPayment.amount).toBe(890_000);
  });

  it("finds highest rate account", () => {
    expect(stats.highestRate.accountName).toBe("Falabella");
    expect(stats.highestRate.rate).toBe(42.5);
  });

  it("finds next upcoming payment", () => {
    expect(stats.nextPayment).not.toBeNull();
    expect(stats.nextPayment!.accountName).toBeDefined();
    expect(stats.nextPayment!.daysUntil).toBeGreaterThanOrEqual(0);
  });

  it("computes credit card totals", () => {
    expect(stats.creditCards.monthlyPayment).toBe(890_000 + 450_000);
    expect(stats.creditCards.count).toBe(2);
    expect(stats.creditCards.monthlyInterest).toBeGreaterThan(0);
  });

  it("computes loan totals", () => {
    expect(stats.loans.monthlyPayment).toBe(650_000);
    expect(stats.loans.count).toBe(1);
  });

  it("computes loan progress when creditLimit is available", () => {
    expect(stats.loans.progress).not.toBeNull();
    expect(stats.loans.progress!.percentage).toBeCloseTo(
      (1 - 6_200_000 / 18_000_000) * 100, 0
    );
  });

  it("computes loan remaining months estimate", () => {
    expect(stats.loans.remainingMonths).not.toBeNull();
    expect(stats.loans.remainingMonths!.months).toBe(
      Math.ceil(6_200_000 / 650_000)
    );
  });

  it("returns per-account breakdowns for popovers", () => {
    expect(stats.allByPayment).toHaveLength(3);
    expect(stats.allByPayment[0].amount).toBeGreaterThanOrEqual(
      stats.allByPayment[1].amount
    );
    expect(stats.allByRate).toHaveLength(3);
    expect(stats.allByRate[0].rate).toBeGreaterThanOrEqual(
      stats.allByRate[1].rate
    );
  });
});

describe("computeDebtStats edge cases", () => {
  it("returns null for loans progress when creditLimit is null", () => {
    const loan = makeAccount({
      type: "LOAN", balance: 5_000_000, creditLimit: null,
      monthlyPayment: 500_000,
    });
    const stats = computeDebtStats([loan]);
    expect(stats.loans.progress).toBeNull();
  });

  it("returns null for loan remaining months when monthlyPayment is null", () => {
    const loan = makeAccount({
      type: "LOAN", balance: 5_000_000, monthlyPayment: null,
    });
    const stats = computeDebtStats([loan]);
    expect(stats.loans.remainingMonths).toBeNull();
  });

  it("hides nextPayment when no account has paymentDay", () => {
    const acc = makeAccount({ paymentDay: null });
    const stats = computeDebtStats([acc]);
    expect(stats.nextPayment).toBeNull();
  });

  it("handles empty accounts array", () => {
    const stats = computeDebtStats([]);
    expect(stats.totalMonthlyPayment).toBe(0);
    expect(stats.highestPayment.amount).toBe(0);
    expect(stats.creditCards.count).toBe(0);
    expect(stats.loans.count).toBe(0);
  });

  it("handles accounts with zero balance", () => {
    const acc = makeAccount({ balance: 0, monthlyPayment: 0 });
    const stats = computeDebtStats([acc]);
    expect(stats.totalMonthlyPayment).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && npx vitest run src/utils/__tests__/debt-stats.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `computeDebtStats()`**

Create `packages/shared/src/utils/debt-stats.ts`:

```typescript
/**
 * Derived metrics for the debt quick stats grid.
 * Pure function — no side effects, no DB calls.
 */
import type { DebtAccount } from "./debt";
import { estimateMonthlyInterest, calcUtilization, daysUntilPayment } from "./debt";
import { getMinPayment } from "./scenario-engine";

export interface AccountPaymentEntry {
  accountId: string;
  accountName: string;
  amount: number;
}

export interface AccountRateEntry {
  accountId: string;
  accountName: string;
  rate: number;
}

export interface AccountInterestEntry {
  accountId: string;
  accountName: string;
  interest: number;
}

export interface AccountUtilizationEntry {
  accountId: string;
  accountName: string;
  utilization: number;
  used: number;
  limit: number;
}

export interface AccountProgressEntry {
  accountId: string;
  accountName: string;
  percentage: number;
  paid: number;
  original: number;
}

export interface AccountRemainingEntry {
  accountId: string;
  accountName: string;
  months: number;
}

export interface UpcomingPaymentEntry {
  accountId: string;
  accountName: string;
  daysUntil: number;
  paymentDay: number;
}

export interface DebtStats {
  totalMonthlyPayment: number;

  highestPayment: { accountName: string; amount: number };
  highestRate: { accountName: string; rate: number };
  nextPayment: UpcomingPaymentEntry | null;

  creditCards: {
    count: number;
    monthlyPayment: number;
    monthlyInterest: number;
    utilization: AccountUtilizationEntry[];
    payments: AccountPaymentEntry[];
    interests: AccountInterestEntry[];
  };

  loans: {
    count: number;
    monthlyPayment: number;
    payments: AccountPaymentEntry[];
    remainingMonths: { months: number; accountName: string } | null;
    progress: { percentage: number; accountName: string } | null;
    remainingList: AccountRemainingEntry[];
    progressList: AccountProgressEntry[];
  };

  // Popover data (pre-sorted)
  allByPayment: AccountPaymentEntry[];
  allByRate: AccountRateEntry[];
  upcomingPayments: UpcomingPaymentEntry[];
}

export function computeDebtStats(accounts: DebtAccount[]): DebtStats {
  const active = accounts.filter((a) => a.balance > 0);
  const creditCards = active.filter((a) => a.type === "CREDIT_CARD");
  const loans = active.filter((a) => a.type === "LOAN");

  // Per-account payment amounts
  const paymentEntries: AccountPaymentEntry[] = active.map((a) => ({
    accountId: a.id,
    accountName: a.name,
    amount: getMinPayment(a),
  }));

  const totalMonthlyPayment = paymentEntries.reduce((s, e) => s + e.amount, 0);

  // Sorted by payment (descending)
  const allByPayment = [...paymentEntries].sort((a, b) => b.amount - a.amount);

  // Highest payment
  const highestPayment = allByPayment.length > 0
    ? { accountName: allByPayment[0].accountName, amount: allByPayment[0].amount }
    : { accountName: "", amount: 0 };

  // Per-account rates (descending)
  const allByRate: AccountRateEntry[] = active
    .filter((a) => a.interestRate != null && a.interestRate > 0)
    .map((a) => ({
      accountId: a.id,
      accountName: a.name,
      rate: a.interestRate!,
    }))
    .sort((a, b) => b.rate - a.rate);

  const highestRate = allByRate.length > 0
    ? { accountName: allByRate[0].accountName, rate: allByRate[0].rate }
    : { accountName: "", rate: 0 };

  // Upcoming payments
  const upcomingPayments: UpcomingPaymentEntry[] = active
    .filter((a) => a.paymentDay != null)
    .map((a) => ({
      accountId: a.id,
      accountName: a.name,
      daysUntil: daysUntilPayment(a.paymentDay)!,
      paymentDay: a.paymentDay!,
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const nextPayment = upcomingPayments.length > 0 ? upcomingPayments[0] : null;

  // Credit card stats
  const ccPayments: AccountPaymentEntry[] = creditCards.map((a) => ({
    accountId: a.id, accountName: a.name, amount: getMinPayment(a),
  }));
  const ccInterests: AccountInterestEntry[] = creditCards.map((a) => ({
    accountId: a.id, accountName: a.name,
    interest: estimateMonthlyInterest(a.balance, a.interestRate),
  }));
  const ccUtilization: AccountUtilizationEntry[] = creditCards
    .filter((a) => a.creditLimit && a.creditLimit > 0)
    .map((a) => ({
      accountId: a.id, accountName: a.name,
      utilization: calcUtilization(a.balance, a.creditLimit),
      used: a.balance,
      limit: a.creditLimit!,
    }));

  // Loan stats
  const loanPayments: AccountPaymentEntry[] = loans.map((a) => ({
    accountId: a.id, accountName: a.name, amount: getMinPayment(a),
  }));

  const loanRemainingList: AccountRemainingEntry[] = loans
    .filter((a) => a.monthlyPayment && a.monthlyPayment > 0)
    .map((a) => ({
      accountId: a.id, accountName: a.name,
      months: Math.ceil(a.balance / a.monthlyPayment!),
    }));

  const loanProgressList: AccountProgressEntry[] = loans
    .filter((a) => a.creditLimit && a.creditLimit > 0)
    .map((a) => ({
      accountId: a.id, accountName: a.name,
      percentage: (1 - a.balance / a.creditLimit!) * 100,
      paid: a.creditLimit! - a.balance,
      original: a.creditLimit!,
    }));

  // Pick the "headline" loan for remaining months and progress (longest remaining / first)
  const loanRemainingHeadline = loanRemainingList.length > 0
    ? { months: loanRemainingList[0].months, accountName: loanRemainingList[0].accountName }
    : null;
  const loanProgressHeadline = loanProgressList.length > 0
    ? { percentage: loanProgressList[0].percentage, accountName: loanProgressList[0].accountName }
    : null;

  return {
    totalMonthlyPayment,
    highestPayment,
    highestRate,
    nextPayment,
    creditCards: {
      count: creditCards.length,
      monthlyPayment: ccPayments.reduce((s, e) => s + e.amount, 0),
      monthlyInterest: ccInterests.reduce((s, e) => s + e.interest, 0),
      utilization: ccUtilization,
      payments: ccPayments,
      interests: ccInterests,
    },
    loans: {
      count: loans.length,
      monthlyPayment: loanPayments.reduce((s, e) => s + e.amount, 0),
      payments: loanPayments,
      remainingMonths: loanRemainingHeadline,
      progress: loanProgressHeadline,
      remainingList: loanRemainingList,
      progressList: loanProgressList,
    },
    allByPayment,
    allByRate,
    upcomingPayments,
  };
}
```

- [ ] **Step 4: Export from index**

Add to `packages/shared/src/index.ts` after the `debt-simulator` export:

```typescript
export * from "./utils/debt-stats";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/shared && npx vitest run src/utils/__tests__/debt-stats.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/debt-stats.ts packages/shared/src/utils/__tests__/debt-stats.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add computeDebtStats() for debt quick stats grid"
```

---

### Task 2: Create `StatTile` component

**Files:**
- Create: `webapp/src/components/debt/stat-tile.tsx`

- [ ] **Step 1: Create the StatTile component**

Create `webapp/src/components/debt/stat-tile.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Info } from "lucide-react";

interface StatTileProps {
  label: string;
  children: React.ReactNode;
  popoverContent?: React.ReactNode;
}

export function StatTile({ label, children, popoverContent }: StatTileProps) {
  const [open, setOpen] = useState(false);

  const tile = (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {popoverContent && (
          <Info className="h-3 w-3 text-muted-foreground/50" />
        )}
      </div>
      {children}
    </div>
  );

  if (!popoverContent) {
    return (
      <div className="bg-[#0f0f11] border border-[#1f1f23] rounded-lg p-4">
        {tile}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="bg-[#0f0f11] border border-[#1f1f23] rounded-lg p-4 text-left w-full cursor-pointer hover:border-muted-foreground/30 transition-colors"
        >
          {tile}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-auto min-w-[200px] p-3">
        {popoverContent}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && npx tsc --noEmit --pretty`
Expected: No errors related to stat-tile

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/stat-tile.tsx
git commit -m "feat(debt): add StatTile component with popover support"
```

---

### Task 3: Rewrite `DebtHeroCard`

**Files:**
- Modify: `webapp/src/components/debt/debt-hero-card.tsx`

- [ ] **Step 1: Rewrite DebtHeroCard**

Replace the entire content of `webapp/src/components/debt/debt-hero-card.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { Landmark, Flame } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";
import type { DebtByCurrency } from "@zeta/shared";

interface DebtHeroCardProps {
  totalDebt: number;
  totalMonthlyPayment: number;
  monthlyInterest: number;
  secondaryCurrencies?: DebtByCurrency[];
  currency: CurrencyCode;
}

export function DebtHeroCard({
  totalDebt,
  totalMonthlyPayment,
  monthlyInterest,
  secondaryCurrencies,
  currency,
}: DebtHeroCardProps) {
  return (
    <Card className="rounded-2xl p-3">
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
        {/* Left: Debt + Monthly Payment */}
        <div className="rounded-xl border border-z-expense/15 bg-gradient-to-br from-z-expense/8 to-z-expense/4 p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-z-expense/10">
              <Landmark className="h-7 w-7 text-z-expense" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Deuda total</p>
              <p className="text-2xl sm:text-3xl font-bold truncate">
                {formatCurrency(totalDebt, currency)}
              </p>
              {secondaryCurrencies && secondaryCurrencies.length > 0 && (
                <div className="flex gap-2 mt-1">
                  {secondaryCurrencies.map((d) => (
                    <p key={d.currency} className="text-sm text-muted-foreground">
                      + {formatCurrency(d.totalDebt, d.currency as CurrencyCode)}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Pagas al mes</p>
              <p className="text-xl sm:text-2xl font-bold">
                {formatCurrency(totalMonthlyPayment, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Interest Banner */}
        <div className="rounded-xl border border-z-expense/25 bg-gradient-to-br from-z-expense/12 to-z-expense/6 p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-z-expense/15">
              <Flame className="h-4 w-4 text-z-expense" />
            </div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Intereses / mes
            </p>
          </div>
          <p className="text-2xl font-bold text-z-expense">
            {formatCurrency(monthlyInterest, currency)}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Dinero que no reduce tu deuda
          </p>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && npx tsc --noEmit --pretty`
Expected: Errors in `deudas/page.tsx` (old props) — expected, will fix in Task 5

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/debt-hero-card.tsx
git commit -m "feat(debt): rewrite DebtHeroCard with monthly payment and interest banner"
```

---

### Task 4: Create `DebtQuickStats` component

**Files:**
- Create: `webapp/src/components/debt/debt-quick-stats.tsx`

- [ ] **Step 1: Create the DebtQuickStats component**

Create `webapp/src/components/debt/debt-quick-stats.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { CreditCard, HandCoins, Layers } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { StatTile } from "./stat-tile";
import type { DebtStats } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

interface DebtQuickStatsProps {
  stats: DebtStats;
  currency: CurrencyCode;
  overallUtilization: number;
  totalCreditUsed: number;
  totalCreditLimit: number;
}

function UtilizationRing({ percentage }: { percentage: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percentage / 100);

  const color = percentage <= 30
    ? "var(--z-income)"
    : percentage <= 70
      ? "var(--z-alert)"
      : "var(--z-debt)";

  return (
    <div className="relative w-12 h-12 mx-auto mb-1">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24" cy="24" r={r}
          fill="none" stroke="hsl(var(--muted))" strokeWidth="4"
        />
        <circle
          cx="24" cy="24" r={r}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-bold"
        style={{ color }}
      >
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}

function PopoverList({
  items,
}: {
  items: { label: string; value: string; detail?: string }[];
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i}>
          {i > 0 && <div className="border-t border-border mb-2" />}
          <div className="flex justify-between items-center gap-4">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              {item.detail && (
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              )}
            </div>
            <p className="text-sm font-semibold shrink-0">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DebtQuickStats({
  stats,
  currency,
  overallUtilization,
  totalCreditUsed,
  totalCreditLimit,
}: DebtQuickStatsProps) {
  const hasCreditCards = stats.creditCards.count > 0;
  const hasLoans = stats.loans.count > 0;

  return (
    <Card className="rounded-2xl p-4">
      {/* ── General Row ── */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            General
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Mayor cuota */}
          {stats.highestPayment.amount > 0 && (
            <StatTile
              label="Mayor cuota"
              popoverContent={
                <PopoverList
                  items={stats.allByPayment.map((e) => ({
                    label: e.accountName,
                    value: formatCurrency(e.amount, currency),
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {formatCurrency(stats.highestPayment.amount, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.highestPayment.accountName}
              </p>
            </StatTile>
          )}

          {/* Deuda más cara */}
          {stats.highestRate.rate > 0 && (
            <StatTile
              label="Deuda más cara"
              popoverContent={
                <PopoverList
                  items={stats.allByRate.map((e) => ({
                    label: e.accountName,
                    value: `${e.rate.toFixed(1)}% EA`,
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {stats.highestRate.rate.toFixed(1)}%{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  EA
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.highestRate.accountName}
              </p>
            </StatTile>
          )}

          {/* Próximo pago */}
          {stats.nextPayment && (
            <StatTile
              label="Próximo pago"
              popoverContent={
                <PopoverList
                  items={stats.upcomingPayments.slice(0, 3).map((e) => ({
                    label: e.accountName,
                    value: e.daysUntil === 0
                      ? "Hoy"
                      : `${e.daysUntil} día${e.daysUntil === 1 ? "" : "s"}`,
                    detail: `Día ${e.paymentDay} del mes`,
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {stats.nextPayment.daysUntil}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {stats.nextPayment.daysUntil === 1 ? "día" : "días"}
                </span>
              </p>
              <p
                className={`text-xs mt-1 ${
                  stats.nextPayment.daysUntil <= 5
                    ? "text-z-alert"
                    : "text-muted-foreground"
                }`}
              >
                {stats.nextPayment.accountName}
              </p>
            </StatTile>
          )}
        </div>
      </div>

      {/* ── Tarjetas Row ── */}
      {hasCreditCards && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <CreditCard className="h-3 w-3 text-[#8b5cf6]" />
            <p className="text-[11px] text-[#8b5cf6] uppercase tracking-wider">
              Tarjetas de crédito
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Uso de tarjetas */}
            <StatTile
              label="Uso de tarjetas"
              popoverContent={
                <PopoverList
                  items={stats.creditCards.utilization.map((e) => ({
                    label: e.accountName,
                    value: `${e.utilization.toFixed(0)}%`,
                    detail: `${formatCurrency(e.used, currency)} / ${formatCurrency(e.limit, currency)}`,
                  }))}
                />
              }
            >
              <div className="text-center">
                <UtilizationRing percentage={overallUtilization} />
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalCreditUsed, currency)} /{" "}
                  {formatCurrency(totalCreditLimit, currency)}
                </p>
              </div>
            </StatTile>

            {/* Tarjetas / mes */}
            <StatTile
              label="Tarjetas / mes"
              popoverContent={
                <PopoverList
                  items={stats.creditCards.payments.map((e) => ({
                    label: e.accountName,
                    value: formatCurrency(e.amount, currency),
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {formatCurrency(stats.creditCards.monthlyPayment, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.creditCards.count} tarjeta
                {stats.creditCards.count !== 1 ? "s" : ""}
              </p>
            </StatTile>

            {/* Intereses TC / mes */}
            <StatTile
              label="Intereses TC / mes"
              popoverContent={
                <PopoverList
                  items={stats.creditCards.interests.map((e) => ({
                    label: e.accountName,
                    value: formatCurrency(e.interest, currency),
                  }))}
                />
              }
            >
              <p className="text-xl font-bold text-z-expense">
                {formatCurrency(stats.creditCards.monthlyInterest, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                de {stats.creditCards.count} tarjeta
                {stats.creditCards.count !== 1 ? "s" : ""}
              </p>
            </StatTile>
          </div>
        </div>
      )}

      {/* ── Préstamos Row ── */}
      {hasLoans && (
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <HandCoins className="h-3 w-3 text-[#3b82f6]" />
            <p className="text-[11px] text-[#3b82f6] uppercase tracking-wider">
              Préstamos
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Préstamos / mes */}
            <StatTile
              label="Préstamos / mes"
              popoverContent={
                <PopoverList
                  items={stats.loans.payments.map((e) => ({
                    label: e.accountName,
                    value: formatCurrency(e.amount, currency),
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {formatCurrency(stats.loans.monthlyPayment, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.loans.count} préstamo
                {stats.loans.count !== 1 ? "s" : ""}
              </p>
            </StatTile>

            {/* Plazo restante */}
            {stats.loans.remainingMonths ? (
              <StatTile
                label="Plazo restante"
                popoverContent={
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      Estimado
                    </p>
                    <PopoverList
                      items={stats.loans.remainingList.map((e) => ({
                        label: e.accountName,
                        value: `${e.months} meses`,
                      }))}
                    />
                  </>
                }
              >
                <p className="text-xl font-bold">
                  {stats.loans.remainingMonths.months}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    meses
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.loans.remainingMonths.accountName}
                </p>
              </StatTile>
            ) : (
              <StatTile label="Plazo restante">
                <p className="text-sm text-muted-foreground">Sin datos</p>
              </StatTile>
            )}

            {/* Progreso */}
            {stats.loans.progress ? (
              <StatTile
                label="Progreso"
                popoverContent={
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      Estimado
                    </p>
                    <PopoverList
                      items={stats.loans.progressList.map((e) => ({
                        label: e.accountName,
                        value: `${e.percentage.toFixed(0)}%`,
                        detail: `${formatCurrency(e.paid, currency)} de ${formatCurrency(e.original, currency)}`,
                      }))}
                    />
                  </>
                }
              >
                <div className="flex items-baseline gap-1.5 mb-2">
                  <p className="text-xl font-bold text-z-income">
                    {stats.loans.progress.percentage.toFixed(0)}%
                  </p>
                  <span className="text-xs text-muted-foreground">pagado</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-z-income rounded-full"
                    style={{
                      width: `${Math.min(stats.loans.progress.percentage, 100)}%`,
                    }}
                  />
                </div>
              </StatTile>
            ) : (
              <StatTile label="Progreso">
                <p className="text-sm text-muted-foreground">Sin datos</p>
              </StatTile>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && npx tsc --noEmit --pretty`
Expected: Errors only in `deudas/page.tsx` (old wiring) — will fix in Task 5

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/debt/debt-quick-stats.tsx
git commit -m "feat(debt): add DebtQuickStats component with categorized metric rows"
```

---

### Task 5: Wire new components into the page

**Files:**
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`

- [ ] **Step 1: Update the page**

Replace the imports and `DebtOverviewSection` in `webapp/src/app/(dashboard)/deudas/page.tsx`.

Remove these imports:
```typescript
import dynamic from "next/dynamic";

const UtilizationGauge = dynamic(
  () => import("@/components/debt/utilization-gauge").then((m) => ({ default: m.UtilizationGauge })),
  { loading: () => <div className="h-[200px] w-full rounded-xl bg-muted animate-pulse" /> }
);
import { InterestCostCard } from "@/components/debt/interest-cost-card";
import { DebtInsights } from "@/components/debt/debt-insights";
```

Add these imports:
```typescript
import { DebtQuickStats } from "@/components/debt/debt-quick-stats";
import { computeDebtStats } from "@zeta/shared";
```

Replace the `DebtOverviewSection` return JSX (the fragment inside the `return` after the empty-state check). The new return should be:

```tsx
  const stats = computeDebtStats(overview.accounts);

  return (
    <>
      <DebtHeroCard
        totalDebt={overview.totalDebt}
        totalMonthlyPayment={stats.totalMonthlyPayment}
        monthlyInterest={overview.monthlyInterestEstimate}
        secondaryCurrencies={secondaryCurrencies}
        currency={currency}
      />

      {exchangeRate && secondaryCurrencies.length > 0 && (
        <ExchangeRateNudge
          rate={exchangeRate.rate}
          avg30d={exchangeRate.avg30d}
          percentVsAvg={exchangeRate.percentVsAvg}
          from={secondaryCurrencies[0].currency as CurrencyCode}
          to={currency}
        />
      )}

      <DebtQuickStats
        stats={stats}
        currency={currency}
        overallUtilization={overview.overallUtilization}
        totalCreditUsed={totalCreditUsed}
        totalCreditLimit={overview.totalCreditLimit}
      />

      {salaryBreakdown && incomeEstimate && (
        <SalaryBar breakdown={salaryBreakdown} currency={currency} />
      )}

      {creditCards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Tarjetas de crédito</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creditCards.map((acct) => (
              <DebtAccountCard key={acct.id} account={acct} />
            ))}
          </div>
        </div>
      )}

      {loans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Préstamos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loans.map((acct) => (
              <DebtAccountCard key={acct.id} account={acct} />
            ))}
          </div>
        </div>
      )}
    </>
  );
```

Also remove `totalCreditUsed` from `preferredCurrencyCreditCards` computation — keep it as-is since `DebtQuickStats` needs it. Just remove the `overallUtilization` grid-cols-3 wrapper that no longer exists.

- [ ] **Step 2: Remove unused imports**

Clean up: remove `dynamic` import (no longer needed), remove `DebtInsights` import, remove `InterestCostCard` import, remove the `UtilizationGauge` dynamic import block. Keep `DebtAccountCard`, `SalaryBar`, `ExchangeRateNudge`.

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes clean

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/deudas/page.tsx
git commit -m "feat(debt): wire DebtHeroCard and DebtQuickStats into debt page"
```

---

### Task 6: Update skeletons

**Files:**
- Modify: `webapp/src/components/debt/debt-skeletons.tsx`

- [ ] **Step 1: Update skeletons to match new layout**

Replace `DebtOverviewSkeleton` and `DebtInsightsSkeleton` in `webapp/src/components/debt/debt-skeletons.tsx`:

```tsx
/** Hero section — mirrors 2/3 + 1/3 grid */
export function DebtOverviewSkeleton() {
  return (
    <Card className="rounded-2xl p-3">
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
        <div className="rounded-xl bg-muted/30 p-5">
          <div className="h-[60px] w-full rounded-md bg-muted animate-pulse" />
        </div>
        <div className="rounded-xl bg-muted/30 p-5">
          <div className="h-[60px] w-full rounded-md bg-muted animate-pulse" />
        </div>
      </div>
    </Card>
  );
}

/** Quick stats — mirrors 3-row categorized grid */
export function DebtQuickStatsSkeleton() {
  return (
    <Card className="rounded-2xl p-4">
      {[...Array(3)].map((_, row) => (
        <div key={row} className={row < 2 ? "mb-4" : ""}>
          <div className="h-3 w-24 rounded bg-muted animate-pulse mb-2 ml-1" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[...Array(3)].map((_, col) => (
              <div
                key={col}
                className="bg-[#0f0f11] border border-[#1f1f23] rounded-lg p-4"
              >
                <div className="h-3 w-16 rounded bg-muted animate-pulse mb-2" />
                <div className="h-6 w-24 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}
```

Remove the old `DebtInsightsSkeleton` export.

- [ ] **Step 2: Update the page's Suspense fallback**

In `webapp/src/app/(dashboard)/deudas/page.tsx`, update the fallback import and usage:

Replace:
```tsx
import {
  DebtOverviewSkeleton,
  DebtInsightsSkeleton,
  SalaryBarSkeleton,
  DebtAccountsSkeleton,
} from "@/components/debt/debt-skeletons";
```

With:
```tsx
import {
  DebtOverviewSkeleton,
  DebtQuickStatsSkeleton,
  SalaryBarSkeleton,
  DebtAccountsSkeleton,
} from "@/components/debt/debt-skeletons";
```

Replace the Suspense fallback:
```tsx
<Suspense
  fallback={
    <div className="space-y-6">
      <DebtOverviewSkeleton />
      <DebtQuickStatsSkeleton />
      <SalaryBarSkeleton />
      <DebtAccountsSkeleton />
    </div>
  }
>
```

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes clean

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/debt/debt-skeletons.tsx webapp/src/app/\(dashboard\)/deudas/page.tsx
git commit -m "feat(debt): update skeletons to match new hero + quick stats layout"
```

---

### Task 7: Delete old components

**Files:**
- Delete: `webapp/src/components/debt/interest-cost-card.tsx`
- Delete: `webapp/src/components/debt/utilization-gauge.tsx`
- Delete: `webapp/src/components/debt/debt-insights.tsx`

- [ ] **Step 1: Verify no remaining imports of deleted components**

Run:
```bash
cd webapp && grep -r "InterestCostCard\|UtilizationGauge\|DebtInsights\|interest-cost-card\|utilization-gauge\|debt-insights" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: No files listed (all imports were removed in prior tasks). If any file still imports them, fix the import before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm webapp/src/components/debt/interest-cost-card.tsx
rm webapp/src/components/debt/utilization-gauge.tsx
rm webapp/src/components/debt/debt-insights.tsx
```

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes clean

- [ ] **Step 4: Commit**

```bash
git add -u webapp/src/components/debt/interest-cost-card.tsx webapp/src/components/debt/utilization-gauge.tsx webapp/src/components/debt/debt-insights.tsx
git commit -m "chore(debt): remove InterestCostCard, UtilizationGauge, DebtInsights"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run shared package tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run full build**

Run: `cd webapp && pnpm build`
Expected: Clean build, no errors

- [ ] **Step 3: Visual check**

Run: `cd webapp && pnpm dev`

Open `/deudas` and verify:
1. Hero shows total debt (left) + monthly payment (right) + interest banner (right panel)
2. Metrics grid shows 3 rows: General, Tarjetas, Préstamos
3. Each tile is clickable and shows a popover with per-account breakdown
4. SalaryBar renders below metrics unchanged
5. Account cards render below salary bar unchanged
6. Responsive: resize to mobile width — hero stacks, tiles go single-column
