/**
 * Debt payoff simulation engine.
 * Compares Snowball (lowest balance first) vs Avalanche (highest rate first).
 * Pure functions — no React or server dependencies.
 */

import type { DebtAccount } from "./debt";

export type PayoffStrategy = "snowball" | "avalanche";

export interface SimulationInput {
  accounts: DebtAccount[];
  extraMonthlyPayment: number;
  strategy: PayoffStrategy;
}

export interface MonthSnapshot {
  month: number;
  balances: Record<string, number>;
  totalBalance: number;
  interestPaid: number;
  principalPaid: number;
  cumulativeInterest: number;
}

export interface SimulationResult {
  strategy: PayoffStrategy;
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  timeline: MonthSnapshot[];
  payoffOrder: { accountId: string; accountName: string; month: number }[];
}

export interface SimulationComparison {
  baseline: SimulationResult;
  snowball: SimulationResult;
  avalanche: SimulationResult;
  interestSaved: number;
  monthsDifference: number;
  bestStrategy: PayoffStrategy;
}

const MAX_MONTHS = 360;
const DEFAULT_MIN_PAYMENT_RATE = 0.05; // 5% is more realistic for Colombian banks
const DEFAULT_MIN_PAYMENT_FLOOR = 50000; // $50,000 COP minimum

function getMinimumPayment(account: DebtAccount): number {
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    return account.monthlyPayment;
  }
  return Math.max(account.balance * DEFAULT_MIN_PAYMENT_RATE, DEFAULT_MIN_PAYMENT_FLOOR);
}

function getPriorityAccountId(
  balances: Record<string, number>,
  accounts: DebtAccount[],
  strategy: PayoffStrategy
): string | null {
  const active = accounts.filter((a) => (balances[a.id] ?? 0) > 0);
  if (active.length === 0) return null;

  if (strategy === "snowball") {
    active.sort((a, b) => (balances[a.id] ?? 0) - (balances[b.id] ?? 0));
  } else {
    active.sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  }
  return active[0].id;
}

export function runSimulation(input: SimulationInput): SimulationResult {
  const { accounts, extraMonthlyPayment, strategy } = input;

  const balances: Record<string, number> = {};
  for (const a of accounts) {
    balances[a.id] = a.balance;
  }

  const timeline: MonthSnapshot[] = [];
  const payoffOrder: SimulationResult["payoffOrder"] = [];
  let cumulativeInterest = 0;
  let totalAmountPaid = 0;

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const totalBefore = Object.values(balances).reduce((s, b) => s + b, 0);
    if (totalBefore <= 0) break;

    let monthInterest = 0;
    let monthPrincipal = 0;

    // 1. Accrue interest
    for (const a of accounts) {
      if (balances[a.id] <= 0) continue;
      const rate = a.interestRate ?? 0;
      const interest = (balances[a.id] * (rate / 100)) / 12;
      balances[a.id] += interest;
      monthInterest += interest;
    }

    // 2. Pay minimums
    let freedMinimums = 0;
    for (const a of accounts) {
      if (balances[a.id] <= 0) {
        freedMinimums += getMinimumPayment(a);
        continue;
      }
      const minPayment = Math.min(getMinimumPayment(a), balances[a.id]);
      balances[a.id] -= minPayment;
      monthPrincipal += minPayment;
      totalAmountPaid += minPayment;

      if (balances[a.id] <= 0.01) {
        balances[a.id] = 0;
        payoffOrder.push({ accountId: a.id, accountName: a.name, month });
      }
    }

    // 3. Apply extra + freed minimums to priority account
    let extraPool = extraMonthlyPayment + freedMinimums;
    while (extraPool > 0.01) {
      const priorityId = getPriorityAccountId(balances, accounts, strategy);
      if (!priorityId) break;

      const payment = Math.min(extraPool, balances[priorityId]);
      balances[priorityId] -= payment;
      extraPool -= payment;
      monthPrincipal += payment;
      totalAmountPaid += payment;

      if (balances[priorityId] <= 0.01) {
        balances[priorityId] = 0;
        if (!payoffOrder.find((p) => p.accountId === priorityId)) {
          const acct = accounts.find((a) => a.id === priorityId)!;
          payoffOrder.push({ accountId: priorityId, accountName: acct.name, month });
        }
      }
    }

    cumulativeInterest += monthInterest;

    timeline.push({
      month,
      balances: { ...balances },
      totalBalance: Object.values(balances).reduce((s, b) => s + b, 0),
      interestPaid: monthInterest,
      principalPaid: monthPrincipal,
      cumulativeInterest,
    });

    if (Object.values(balances).every((b) => b <= 0)) break;
  }

  return {
    strategy,
    totalMonths: timeline.length,
    totalInterestPaid: cumulativeInterest,
    totalAmountPaid,
    timeline,
    payoffOrder,
  };
}

// --- Lump Sum Allocation ---

export interface LumpSumAllocation {
  accountId: string;
  accountName: string;
  currency: string;
  currentBalance: number;
  interestRate: number;
  payment: number;
  newBalance: number;
  monthlyInterestSaved: number;
}

export interface LumpSumResult {
  allocations: LumpSumAllocation[];
  totalMonthlyInterestBefore: number;
  totalMonthlyInterestAfter: number;
  totalMonthlyInterestSaved: number;
}

/**
 * Given a lump sum, allocate it optimally across debt accounts (highest rate first).
 */
export function allocateLumpSum(
  accounts: DebtAccount[],
  lumpSum: number
): LumpSumResult {
  // Sort by interest rate descending (avalanche strategy)
  const sorted = [...accounts]
    .filter((a) => a.balance > 0 && a.currency === "COP")
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));

  let remaining = lumpSum;
  const allocations: LumpSumAllocation[] = [];
  let totalBefore = 0;
  let totalAfter = 0;

  for (const a of sorted) {
    const rate = a.interestRate ?? 0;
    const monthlyBefore = (a.balance * (rate / 100)) / 12;
    totalBefore += monthlyBefore;

    if (remaining <= 0) {
      totalAfter += monthlyBefore;
      allocations.push({
        accountId: a.id,
        accountName: a.name,
        currency: a.currency,
        currentBalance: a.balance,
        interestRate: rate,
        payment: 0,
        newBalance: a.balance,
        monthlyInterestSaved: 0,
      });
      continue;
    }

    const payment = Math.min(remaining, a.balance);
    remaining -= payment;
    const newBalance = a.balance - payment;
    const monthlyAfter = (newBalance * (rate / 100)) / 12;
    totalAfter += monthlyAfter;

    allocations.push({
      accountId: a.id,
      accountName: a.name,
      currency: a.currency,
      currentBalance: a.balance,
      interestRate: rate,
      payment,
      newBalance,
      monthlyInterestSaved: monthlyBefore - monthlyAfter,
    });
  }

  return {
    allocations,
    totalMonthlyInterestBefore: totalBefore,
    totalMonthlyInterestAfter: totalAfter,
    totalMonthlyInterestSaved: totalBefore - totalAfter,
  };
}

// --- Single Account Extra Payment ---

export interface SingleAccountResult {
  accountName: string;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  monthsWithoutExtra: number;
  monthsWithExtra: number;
  interestWithoutExtra: number;
  interestWithExtra: number;
  interestSaved: number;
  monthsSaved: number;
  timeline: { month: number; withoutExtra: number; withExtra: number }[];
}

/**
 * Simulate paying off a single account with vs without an extra monthly payment.
 */
export function simulateSingleAccount(
  account: DebtAccount,
  extraMonthly: number
): SingleAccountResult {
  const rate = account.interestRate ?? 0;
  const minPayment = getMinimumPayment(account);

  function simulate(monthlyExtra: number) {
    let balance = account.balance;
    let totalInterest = 0;
    const balances: number[] = [];

    for (let m = 0; m < MAX_MONTHS && balance > 0.01; m++) {
      const interest = (balance * (rate / 100)) / 12;
      balance += interest;
      totalInterest += interest;

      const payment = Math.min(minPayment + monthlyExtra, balance);
      balance -= payment;
      if (balance < 0.01) balance = 0;
      balances.push(balance);
    }

    return { months: balances.length, totalInterest, balances };
  }

  const without = simulate(0);
  const withExtra = simulate(extraMonthly);
  const maxLen = Math.max(without.months, withExtra.months);

  const timeline: SingleAccountResult["timeline"] = [];
  for (let i = 0; i < maxLen; i++) {
    timeline.push({
      month: i + 1,
      withoutExtra: without.balances[i] ?? 0,
      withExtra: withExtra.balances[i] ?? 0,
    });
  }

  return {
    accountName: account.name,
    currentBalance: account.balance,
    interestRate: rate,
    minimumPayment: minPayment,
    monthsWithoutExtra: without.months,
    monthsWithExtra: withExtra.months,
    interestWithoutExtra: without.totalInterest,
    interestWithExtra: withExtra.totalInterest,
    interestSaved: without.totalInterest - withExtra.totalInterest,
    monthsSaved: without.months - withExtra.months,
    timeline,
  };
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
