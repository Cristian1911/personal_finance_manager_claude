# Debt Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two critical bugs — debt payments inflating income metrics, and debt simulator showing exponential growth instead of payoff.

**Architecture:** Two independent fixes. Fix #1 adds account_id filtering to dashboard income calculations. Fix #2 persists minimum_payment from imports to the account scalar field and improves the simulator fallback.

**Tech Stack:** Next.js (Server Components + Server Actions), TypeScript, Supabase, shared package (`@venti5/shared`)

---

## Task 1: Fix dashboard income calculation to exclude debt account INFLOW

The dashboard currently sums ALL `INFLOW` transactions as income. Payments to credit cards/loans appear as INFLOW in the extracto context but should not count as user income.

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx:72-77` (query) and `123-132` (calculation)

**Step 1: Update monthTransactions query to include account_id**

In `webapp/src/app/(dashboard)/dashboard/page.tsx`, the query at line 72-77 currently selects `amount, direction`. Add `account_id`:

```typescript
const { data: monthTransactions } = await supabase
  .from("transactions")
  .select("amount, direction, account_id")
  .eq("is_excluded", false)
  .gte("transaction_date", monthStartStr(target))
  .lte("transaction_date", monthEndStr(target));
```

**Step 2: Build a Set of debt account IDs**

After line 108 (`// Calculate metrics`), the code already computes `liabilityAccounts`. Create a Set for fast lookup:

```typescript
const debtAccountIds = new Set(
  liabilityAccounts.map((a) => a.id)
);
```

**Step 3: Filter debt INFLOW from income calculation**

Replace the monthIncome calculation (lines 123-125):

```typescript
// OLD:
const monthIncome = monthTx
  .filter((t) => t.direction === "INFLOW")
  .reduce((sum, t) => sum + t.amount, 0);

// NEW:
const monthIncome = monthTx
  .filter((t) => t.direction === "INFLOW" && !debtAccountIds.has(t.account_id))
  .reduce((sum, t) => sum + t.amount, 0);
```

**Step 4: Optionally compute debt payments metric**

After monthExpenses calculation, add:

```typescript
const monthDebtPayments = monthTx
  .filter((t) => t.direction === "INFLOW" && debtAccountIds.has(t.account_id))
  .reduce((sum, t) => sum + t.amount, 0);
```

This can be displayed later when dashboards are redesigned. For now it keeps the data available.

**Step 5: Verify build compiles**

Run: `cd webapp && pnpm build`
Expected: No TypeScript errors.

**Step 6: Commit**

```bash
git add webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "fix: exclude debt account INFLOW from monthly income calculation"
```

---

## Task 2: Fix income calculation in charts server actions

The same bug exists in `getMonthlyCashflow` and `getMonthMetrics` — they count all INFLOW as income without filtering debt accounts.

**Files:**
- Modify: `webapp/src/actions/charts.ts:129-154` (getMonthlyCashflow) and `223-238` (getMonthMetrics)

**Step 1: Update getMonthlyCashflow to join account type**

In `getMonthlyCashflow` (line 129), update the query to include account type:

```typescript
const { data: transactions } = await supabase
  .from("transactions")
  .select("transaction_date, amount, direction, accounts!account_id(account_type)")
  .eq("is_excluded", false)
  .gte("transaction_date", monthsBeforeStart(target, 5))
  .lte("transaction_date", monthEndStr(target))
  .order("transaction_date");
```

**Step 2: Filter debt INFLOW in the aggregation loop**

In the loop at lines 141-154, add a check:

```typescript
for (const tx of transactions) {
  const month = tx.transaction_date.substring(0, 7);

  if (!map.has(month)) {
    map.set(month, { income: 0, expenses: 0 });
  }

  const entry = map.get(month)!;
  const acctType = (tx.accounts as { account_type: string } | null)?.account_type;
  const isDebtAccount = acctType === "CREDIT_CARD" || acctType === "LOAN";

  if (tx.direction === "INFLOW" && !isDebtAccount) {
    entry.income += tx.amount;
  } else if (tx.direction === "OUTFLOW") {
    entry.expenses += tx.amount;
  }
  // Debt INFLOW is neither income nor expense in this context
}
```

**Step 3: Apply same fix to getMonthMetrics**

In `getMonthMetrics` (line 223), update the query:

```typescript
const { data: transactions } = await supabase
  .from("transactions")
  .select("amount, direction, accounts!account_id(account_type)")
  .eq("is_excluded", false)
  .gte("transaction_date", monthStartStr(target))
  .lte("transaction_date", monthEndStr(target));
```

Update the aggregation loop (lines 234-237):

```typescript
for (const tx of transactions) {
  const acctType = (tx.accounts as { account_type: string } | null)?.account_type;
  const isDebtAccount = acctType === "CREDIT_CARD" || acctType === "LOAN";
  if (tx.direction === "INFLOW" && !isDebtAccount) income += tx.amount;
  else if (tx.direction === "OUTFLOW") expenses += tx.amount;
}
```

**Step 4: Apply same fix to getDailyCashflow**

In `getDailyCashflow` (line 265), update query to include account type and filter the same way in the loop at lines 277-284.

**Step 5: Verify build compiles**

Run: `cd webapp && pnpm build`

**Step 6: Commit**

```bash
git add webapp/src/actions/charts.ts
git commit -m "fix: exclude debt INFLOW from income in all chart calculations"
```

---

## Task 3: Persist minimum_payment to account scalar field on import

The import action saves `minimum_payment` to `currency_balances` JSONB but never to the account's `monthly_payment` scalar field. The debt simulator reads the scalar field.

**Files:**
- Modify: `webapp/src/actions/import-transactions.ts:214-226`

**Step 1: Add minimum_payment persistence for credit cards**

In `import-transactions.ts`, inside the `if (meta.creditCardMetadata && isPrimaryCurrency)` block (around line 214), add:

```typescript
if (meta.creditCardMetadata && isPrimaryCurrency) {
  const cc = meta.creditCardMetadata;
  if (cc.credit_limit != null) accountUpdate.credit_limit = cc.credit_limit;
  if (cc.interest_rate != null) accountUpdate.interest_rate = cc.interest_rate;
  // ... existing code ...
  if (cc.minimum_payment != null) accountUpdate.monthly_payment = cc.minimum_payment;  // ADD THIS
}
```

**Step 2: Add minimum_payment persistence for loans**

In the `else if (meta.loanMetadata && isPrimaryCurrency)` block (around line 227), add:

```typescript
if (ln.minimum_payment != null) accountUpdate.monthly_payment = ln.minimum_payment;
```

**Step 3: Verify build compiles**

Run: `cd webapp && pnpm build`

**Step 4: Commit**

```bash
git add webapp/src/actions/import-transactions.ts
git commit -m "fix: persist minimum_payment from statement import to account monthly_payment field"
```

---

## Task 4: Fix simulator fallback and add baseline comparison

**Files:**
- Modify: `packages/shared/src/utils/debt-simulator.ts:44-51` (fallback), `317-342` (compareStrategies)

**Step 1: Improve getMinimumPayment fallback**

Replace lines 44-51:

```typescript
const DEFAULT_MIN_PAYMENT_RATE = 0.05; // 5% is more realistic for Colombian banks
const DEFAULT_MIN_PAYMENT_FLOOR = 50000; // $50,000 COP minimum

function getMinimumPayment(account: DebtAccount): number {
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    return account.monthlyPayment;
  }
  return Math.max(account.balance * DEFAULT_MIN_PAYMENT_RATE, DEFAULT_MIN_PAYMENT_FLOOR);
}
```

**Step 2: Add baseline simulation to compareStrategies**

Update the `SimulationComparison` interface and `compareStrategies` function:

```typescript
export interface SimulationComparison {
  baseline: SimulationResult;
  snowball: SimulationResult;
  avalanche: SimulationResult;
  interestSaved: number;
  monthsDifference: number;
  bestStrategy: PayoffStrategy;
}

export function compareStrategies(
  accounts: DebtAccount[],
  extraMonthlyPayment: number
): SimulationComparison {
  // Baseline: only minimum payments, no extra, no strategy
  const baseline = runSimulation({
    accounts,
    extraMonthlyPayment: 0,
    strategy: "avalanche", // strategy doesn't matter with 0 extra
  });
  const snowball = runSimulation({
    accounts,
    extraMonthlyPayment,
    strategy: "snowball",
  });
  const avalanche = runSimulation({
    accounts,
    extraMonthlyPayment,
    strategy: "avalanche",
  });

  const interestSaved = snowball.totalInterestPaid - avalanche.totalInterestPaid;
  const monthsDifference = snowball.totalMonths - avalanche.totalMonths;

  return {
    baseline,
    snowball,
    avalanche,
    interestSaved,
    monthsDifference,
    bestStrategy: interestSaved > 0 ? "avalanche" : "snowball",
  };
}
```

**Step 3: Verify shared package build**

Run: `cd packages/shared && pnpm build` (or `tsc --noEmit` if no build script)

**Step 4: Commit**

```bash
git add packages/shared/src/utils/debt-simulator.ts
git commit -m "fix: improve minimum payment fallback and add baseline to strategy comparison"
```

---

## Task 5: Update simulator UI with baseline chart line

**Files:**
- Modify: `webapp/src/components/debt/debt-simulator.tsx:366-401` (StrategiesTab chart)

**Step 1: Add baseline to chart config**

Update `strategyChartConfig` (line 366):

```typescript
const strategyChartConfig = {
  baseline: { label: "Solo mínimo", color: "var(--chart-3)" },
  snowball: { label: "Bola de Nieve", color: "var(--chart-1)" },
  avalanche: { label: "Avalancha", color: "var(--chart-2)" },
} satisfies ChartConfig;
```

**Step 2: Include baseline in chartData**

Update the `chartData` useMemo (lines 386-401):

```typescript
const chartData = useMemo(() => {
  if (!comparison) return [];
  const maxLen = Math.max(
    comparison.baseline.timeline.length,
    comparison.snowball.timeline.length,
    comparison.avalanche.timeline.length
  );
  const data: { month: string; baseline: number; snowball: number; avalanche: number }[] = [];
  for (let i = 0; i < maxLen; i++) {
    data.push({
      month: `${i + 1}`,
      baseline: comparison.baseline.timeline[i]?.totalBalance ?? 0,
      snowball: comparison.snowball.timeline[i]?.totalBalance ?? 0,
      avalanche: comparison.avalanche.timeline[i]?.totalBalance ?? 0,
    });
  }
  return data;
}, [comparison]);
```

**Step 3: Add baseline Area to the chart**

In the AreaChart component (around line 559-619), add a new gradient and Area for baseline:

```tsx
{/* Add gradient */}
<linearGradient id="fillBaseline" x1="0" y1="0" x2="0" y2="1">
  <stop offset="5%" stopColor="var(--color-baseline)" stopOpacity={0.15} />
  <stop offset="95%" stopColor="var(--color-baseline)" stopOpacity={0.02} />
</linearGradient>

{/* Add Area - render first so it's behind the other lines */}
<Area type="monotone" dataKey="baseline" stroke="var(--color-baseline)" fill="url(#fillBaseline)" strokeWidth={1.5} strokeDasharray="4 4" />
```

Update the tooltip to include baseline value.

**Step 4: Verify build compiles**

Run: `cd webapp && pnpm build`

**Step 5: Commit**

```bash
git add webapp/src/components/debt/debt-simulator.tsx
git commit -m "feat: add baseline (minimum payments only) line to strategy comparison chart"
```

---

## Task 6: Manual validation with real data

**Step 1: Import a credit card statement and verify minimum_payment is saved**

After importing, check the account record:
- `monthly_payment` field should now be populated (e.g., 310050)
- Verify via Supabase dashboard or a quick query

**Step 2: Verify dashboard income**

- Navigate to dashboard
- Check "Ingresos del mes" — should NOT include credit card payments
- Savings rate should reflect actual income only

**Step 3: Verify simulator**

- Go to `/deudas/simulador`
- Select credit card with ~$4.2M balance
- Tab "Una cuenta" with $0 extra → should show ~16-18 months payoff (not 360)
- Tab "Estrategias" → baseline line should be above snowball/avalanche lines
- All lines should trend downward, never upward

**Step 4: Final commit if any adjustments needed**

---

## Dependency Graph

```
Task 1 (dashboard page) ─────────────┐
Task 2 (charts actions) ─────────────┤── Fix #1 (independent)
                                      │
Task 3 (import persistence) ──┐       │
Task 4 (simulator engine) ────┤       ├── Fix #2 (independent)
Task 5 (simulator UI) ────────┘       │
                                      │
Task 6 (manual validation) ───────────┘── Depends on all above
```

Tasks 1-2 (Fix #1) and Tasks 3-5 (Fix #2) are fully independent and can be executed in parallel.
