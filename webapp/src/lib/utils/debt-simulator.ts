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
  snowball: SimulationResult;
  avalanche: SimulationResult;
  interestSaved: number;
  monthsDifference: number;
  bestStrategy: PayoffStrategy;
}

const MAX_MONTHS = 360;
const DEFAULT_MIN_PAYMENT_RATE = 0.02;

function getMinimumPayment(account: DebtAccount): number {
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    return account.monthlyPayment;
  }
  return Math.max(account.balance * DEFAULT_MIN_PAYMENT_RATE, 10000);
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

export function compareStrategies(
  accounts: DebtAccount[],
  extraMonthlyPayment: number
): SimulationComparison {
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
    snowball,
    avalanche,
    interestSaved,
    monthsDifference,
    bestStrategy: interestSaved > 0 ? "avalanche" : "snowball",
  };
}
