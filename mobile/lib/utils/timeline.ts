/**
 * Compute daily income/expense bars + cumulative balance for the cashflow chart.
 * Past data comes from transactions, future projections from recurring occurrences.
 */

interface MinimalTransaction {
  amount: number;
  direction: string;
  transaction_date: string;
  is_excluded: number | boolean;
  account_id: string;
  transfer_group_id?: string | null;
  reconciled_into_transaction_id?: string | null;
}

interface MinimalAccount {
  id: string;
  account_type: string;
}

interface MinimalOccurrence {
  expected_amount: number;
  occurrence_date: string;
  direction: string;
  account_id: string;
  status: string;
}

export interface TimelineDay {
  day: number;
  income: number;
  expense: number;
  isReal: boolean; // false for projected future days
}

export interface BalancePoint {
  day: number;
  balance: number;
}

export interface TimelineData {
  days: TimelineDay[];
  cumulativeBalance: BalancePoint[];
  totalIncome: number;
  totalExpense: number;
  daysInMonth: number;
  dayOfMonth: number;
}

import { DEBT_ACCOUNT_TYPES } from "../constants/accounts";

export function computeTimeline(
  transactions: MinimalTransaction[],
  accounts: MinimalAccount[],
  occurrences: MinimalOccurrence[],
  now: Date = new Date(),
  liquidBalance: number = 0
): TimelineData {
  const year = now.getFullYear();
  const month = now.getMonth();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const debtAccountIds = new Set(
    accounts.filter((a) => DEBT_ACCOUNT_TYPES.has(a.account_type)).map((a) => a.id)
  );
  const accountTypeMap = new Map(accounts.map((a) => [a.id, a.account_type]));

  // Accumulate real (past) data by day
  const dailyIncome = new Float64Array(daysInMonth + 1);
  const dailyExpense = new Float64Array(daysInMonth + 1);
  const isRealDay = new Uint8Array(daysInMonth + 1); // track which days have real data
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    if (tx.is_excluded) continue;
    if (tx.transfer_group_id) continue;
    if (tx.reconciled_into_transaction_id) continue;
    const amount = Math.abs(tx.amount);
    const txDay = parseInt(tx.transaction_date.slice(8, 10), 10);
    if (txDay < 1 || txDay > daysInMonth) continue;

    if (tx.direction === "INFLOW" && !debtAccountIds.has(tx.account_id)) {
      dailyIncome[txDay] += amount;
      totalIncome += amount;
    } else if (tx.direction === "OUTFLOW") {
      dailyExpense[txDay] += amount;
      totalExpense += amount;
    }
    isRealDay[txDay] = 1;
  }

  // Project future from pending occurrences (days > today)
  for (const occ of occurrences) {
    if (occ.status !== "pending") continue;
    const occDay = parseInt(occ.occurrence_date.slice(8, 10), 10);
    if (occDay < 1 || occDay > daysInMonth || occDay <= dayOfMonth) continue;

    const acctType = accountTypeMap.get(occ.account_id) ?? "";
    const isDebtInflow = occ.direction === "INFLOW" && DEBT_ACCOUNT_TYPES.has(acctType);
    const amount = Math.abs(occ.expected_amount);

    if (occ.direction === "INFLOW" && !isDebtInflow) {
      dailyIncome[occDay] += amount;
    } else if (occ.direction === "OUTFLOW" || isDebtInflow) {
      dailyExpense[occDay] += amount;
    }
  }

  // Build day entries — include days with activity + today
  const days: TimelineDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (dailyIncome[d] > 0 || dailyExpense[d] > 0 || d === dayOfMonth) {
      days.push({
        day: d,
        income: dailyIncome[d],
        expense: dailyExpense[d],
        isReal: d <= dayOfMonth && isRealDay[d] === 1,
      });
    }
  }

  // Reconstruct daily balances from today's known liquid balance.
  // Walk backwards from today to get historical balances,
  // then forward from today using projected occurrences.
  const dailyBalance = new Float64Array(daysInMonth + 1);
  dailyBalance[dayOfMonth] = liquidBalance;

  // Walk backwards: balance[d-1] = balance[d] - net[d]
  for (let d = dayOfMonth; d >= 2; d--) {
    dailyBalance[d - 1] = dailyBalance[d] - (dailyIncome[d] - dailyExpense[d]);
  }
  // Day 1: balance before day 1's activity
  if (dayOfMonth >= 1) {
    dailyBalance[0] = dailyBalance[1] - (dailyIncome[1] - dailyExpense[1]);
  }

  // Walk forward from today using projected data
  for (let d = dayOfMonth + 1; d <= daysInMonth; d++) {
    dailyBalance[d] = dailyBalance[d - 1] + (dailyIncome[d] - dailyExpense[d]);
  }

  const cumulativeBalance: BalancePoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (dailyIncome[d] > 0 || dailyExpense[d] > 0 || d === dayOfMonth) {
      cumulativeBalance.push({ day: d, balance: dailyBalance[d] });
    }
  }

  return {
    days,
    cumulativeBalance,
    totalIncome,
    totalExpense,
    daysInMonth,
    dayOfMonth,
  };
}
