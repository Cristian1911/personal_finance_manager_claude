"use server";

import "server-only";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDailyCashflow } from "@/actions/charts";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import { getExchangeRate } from "@/actions/exchange-rate";
import { getAccounts } from "@/actions/accounts";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { parseMonth } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

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

// --- Planned entries helper ---

async function getPlannedEntriesForMonth(
  userId: string,
  monthStart: string,
  monthEnd: string
): Promise<
  Array<{
    entry_type: "INCOME" | "EXPENSE";
    expected_date: string;
    amount: number;
    currency_code: string;
    recurring_template_id: string | null;
  }>
> {
  const supabase = createAdminClient();

  const { data: period } = await supabase
    .from("planning_periods")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .lte("start_date", monthEnd)
    .gte("end_date", monthStart)
    .limit(1)
    .maybeSingle();

  if (!period) return [];

  const { data: entries } = await supabase
    .from("planning_entries")
    .select(
      "entry_type, expected_date, amount, currency_code, recurring_template_id"
    )
    .eq("period_id", period.id)
    .eq("user_id", userId)
    .eq("status", "PLANNED")
    .gte("expected_date", monthStart)
    .lte("expected_date", monthEnd);

  return (entries ?? []).map((e) => ({
    entry_type: e.entry_type as "INCOME" | "EXPENSE",
    expected_date: e.expected_date,
    amount: Number(e.amount),
    currency_code: e.currency_code,
    recurring_template_id: e.recurring_template_id,
  }));
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

  const monthPad = String(target.getMonth() + 1).padStart(2, "0");
  const monthStart = `${target.getFullYear()}-${monthPad}-01`;
  const monthEnd = `${target.getFullYear()}-${monthPad}-${String(daysInMonth).padStart(2, "0")}`;

  const [dailyCashflow, upcomingRecurrences, accountsResult, plannedEntries] =
    await Promise.all([
      getDailyCashflow(month),
      getUpcomingRecurrences(remainingDays > 0 ? remainingDays : 0),
      getAccounts(),
      getPlannedEntriesForMonth(user.id, monthStart, monthEnd),
    ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const chartCurrency = (_currency || "COP") as CurrencyCode;
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

  // --- Merge planning entries (PLANNED only, future days) ---
  const planningTemplateKeys = new Set<string>();

  // Batch-fetch exchange rates for foreign-currency planning entries
  const foreignCurrencies = new Set<string>();
  for (const pe of plannedEntries) {
    if (pe.currency_code !== chartCurrency) {
      foreignCurrencies.add(pe.currency_code);
    }
  }
  const rateMap = new Map<string, number>();
  if (foreignCurrencies.size > 0) {
    const rates = await Promise.all(
      [...foreignCurrencies].map(async (fc) => {
        const r = await getExchangeRate(
          fc as CurrencyCode,
          chartCurrency
        );
        return [fc, r?.rate ?? 1] as const;
      })
    );
    for (const [fc, rate] of rates) rateMap.set(fc, rate);
  }

  for (const pe of plannedEntries) {
    const peDay = new Date(pe.expected_date + "T12:00:00").getDate();

    // Skip past days — they already have real data
    if (isCurrentMonth && peDay <= dayOfMonth) continue;

    // Track template-based entries for deduplication with recurrences
    if (pe.recurring_template_id) {
      planningTemplateKeys.add(`${pe.recurring_template_id}|${peDay}`);
    }

    const amount =
      pe.currency_code !== chartCurrency
        ? pe.amount * (rateMap.get(pe.currency_code) ?? 1)
        : pe.amount;

    const existing = dayMap.get(peDay) ?? {
      income: 0,
      expense: 0,
      isReal: false,
    };

    if (pe.entry_type === "INCOME") {
      existing.income += amount;
    } else {
      existing.expense += amount;
    }

    existing.isReal = false;
    dayMap.set(peDay, existing);
  }

  // --- Merge recurring template projections (skip if covered by planning entry) ---
  const monthStr = `${target.getFullYear()}-${monthPad}`;

  for (const recurrence of upcomingRecurrences) {
    // Only include recurrences within the target month
    if (!recurrence.next_date.startsWith(monthStr)) continue;

    const recDay = new Date(recurrence.next_date + "T12:00:00").getDate();

    // Skip past days — they already have real data
    if (isCurrentMonth && recDay <= dayOfMonth) continue;

    // Skip if a planning entry already covers this template+day
    if (planningTemplateKeys.has(`${recurrence.template.id}|${recDay}`))
      continue;

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
