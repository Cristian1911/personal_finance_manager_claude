"use server";

import "server-only";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { getDailyCashflow } from "@/actions/charts";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import { getAccounts } from "@/actions/accounts";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { parseMonth } from "@/lib/utils/date";

// --- Types ---

export interface TimelineDay {
  day: number;
  income: number;
  expense: number;
  isReal: boolean; // true for past, false for projected
}

export interface PlanTimelineData {
  days: TimelineDay[];
  cumulativeBalance: Array<{ day: number; balance: number }>;
  startingBalance: number;
  totalIncome: number;
  totalExpense: number;
  dangerZone: { startDay: number; endDay: number } | null;
  daysInMonth: number;
  dayOfMonth: number;
}

// --- Helpers ---

const LIQUID_ACCOUNT_TYPES = new Set(["SAVINGS", "CHECKING", "CASH"]);

function emptyTimeline(): PlanTimelineData {
  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();

  return {
    days: [],
    cumulativeBalance: [],
    startingBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    dangerZone: null,
    daysInMonth,
    dayOfMonth: now.getDate(),
  };
}

// --- Main ---

export async function getPlanTimelineData(
  month?: string,
  _currency?: string
): Promise<PlanTimelineData> {
  const { user } = await getAuthenticatedClient();
  if (!user) return emptyTimeline();

  const target = parseMonth(month);
  const now = new Date();
  const daysInMonth = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();

  const isCurrentMonth =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth();
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;

  const remainingDays = isCurrentMonth ? daysInMonth - dayOfMonth : daysInMonth;

  const [dailyCashflow, upcomingRecurrences, accountsResult] =
    await Promise.all([
      getDailyCashflow(month),
      getUpcomingRecurrences(remainingDays > 0 ? remainingDays : 0),
      getAccounts(),
    ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const currentBalance = accounts
    .filter((a) => LIQUID_ACCOUNT_TYPES.has(a.account_type))
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  const dayMap = new Map<
    number,
    { income: number; expense: number; isReal: boolean }
  >();

  for (const entry of dailyCashflow) {
    const dayNum = new Date(entry.date + "T12:00:00").getDate();
    // Days up to today (inclusive) with actual data are "real"
    const isReal = isCurrentMonth ? dayNum <= dayOfMonth : true;
    dayMap.set(dayNum, {
      income: entry.income,
      expense: entry.expenses,
      isReal,
    });
  }

  // Filter recurrences to the target month
  const monthStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;

  for (const recurrence of upcomingRecurrences) {
    // Only include recurrences within the target month
    if (!recurrence.next_date.startsWith(monthStr)) continue;

    const recDay = new Date(recurrence.next_date + "T12:00:00").getDate();

    // Skip past days — they already have real data
    if (isCurrentMonth && recDay <= dayOfMonth) continue;

    const t = recurrence.template;
    const isDebtAccount = isDebtAccountType(t.account.account_type);

    const existing = dayMap.get(recDay) ?? {
      income: 0,
      expense: 0,
      isReal: false,
    };

    if (t.direction === "INFLOW" && !isDebtAccount) {
      existing.income += t.amount;
    } else if (t.direction === "OUTFLOW") {
      existing.expense += t.amount;
    }
    // Debt INFLOW is neither income nor expense (consistent with charts.ts)

    existing.isReal = false;
    dayMap.set(recDay, existing);
  }

  const days: TimelineDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = dayMap.get(d);
    if (!entry) continue;
    // Skip days with zero activity
    if (entry.income === 0 && entry.expense === 0) continue;
    days.push({
      day: d,
      income: entry.income,
      expense: entry.expense,
      isReal: entry.isReal,
    });
  }

  // startingBalance = currentBalance - pastNet (back-derive month start from current balance)
  const pastNet = days
    .filter((d) => d.isReal)
    .reduce((sum, d) => sum + d.income - d.expense, 0);
  const startingBalance = currentBalance - pastNet;

  let runningBalance = startingBalance;
  const cumulativeBalance: Array<{ day: number; balance: number }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const entry = dayMap.get(d);
    if (entry) {
      runningBalance += entry.income - entry.expense;
    }
    cumulativeBalance.push({ day: d, balance: runningBalance });
  }

  let dangerZone: PlanTimelineData["dangerZone"] = null;
  let currentDangerStart: number | null = null;

  for (const point of cumulativeBalance) {
    if (point.balance < 0) {
      if (currentDangerStart === null) {
        currentDangerStart = point.day;
      }
      // Update danger zone if this run is longer than existing
      const currentLength = point.day - currentDangerStart + 1;
      const existingLength = dangerZone
        ? dangerZone.endDay - dangerZone.startDay + 1
        : 0;
      if (currentLength > existingLength) {
        dangerZone = { startDay: currentDangerStart, endDay: point.day };
      }
    } else {
      currentDangerStart = null;
    }
  }

  const totalIncome = days.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = days.reduce((sum, d) => sum + d.expense, 0);

  return {
    days,
    cumulativeBalance,
    startingBalance,
    totalIncome,
    totalExpense,
    dangerZone,
    daysInMonth,
    dayOfMonth,
  };
}
