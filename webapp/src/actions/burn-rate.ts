"use server";

import { subMonths, addDays } from "date-fns";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { toColombiaDateString } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import { getNextIncomeOccurrenceCached, getPendingOccurrencesCached } from "@/actions/occurrences";
import { PAY_CYCLE_LOOKAHEAD_DAYS } from "@/lib/constants/occurrences";

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

export interface ObligationMarker {
  date: string;
  name: string;
  amount: number;
}

export interface BurnRateResponse {
  total: BurnRateResult;
  discretionary: BurnRateResult;
  liquidBalance: number;
  disponible: number;
  currency: CurrencyCode;
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  obligations: ObligationMarker[];
}

// ─── Cached inner function ────────────────────────────────────────────────────

async function getBurnRateCached(
  accessToken: string,
  userId: string,
  currency: string
): Promise<BurnRateResponse | null> {
  "use cache";
  cacheTag("dashboard:hero");
  cacheTag("accounts");
  cacheTag("recurring");
  cacheTag("occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const baseCurrency = currency as CurrencyCode;

  const today = new Date();
  const todayStr = toColombiaDateString(today);
  const threeMonthsAgo = toColombiaDateString(subMonths(today, 3));
  const rangeEnd = toColombiaDateString(addDays(today, PAY_CYCLE_LOOKAHEAD_DAYS));

  const [
    { data: accounts, error: accountsError },
    { data: transactions, error: txError },
    nextIncome,
    pendingOccurrences,
  ] = await Promise.all([
    supabase.from("accounts")
      .select("id, current_balance, currency_code, account_type")
      .eq("user_id", userId).eq("is_active", true)
      .in("account_type", ["CHECKING", "SAVINGS"]),
    supabase.from("transactions")
      .select("id, amount, transaction_date, direction, is_recurring")
      .eq("user_id", userId).eq("direction", "OUTFLOW")
      .eq("is_excluded", false).is("reconciled_into_transaction_id", null)
      .eq("currency_code", baseCurrency).gte("transaction_date", threeMonthsAgo)
      .order("transaction_date", { ascending: true }),
    getNextIncomeOccurrenceCached(userId, todayStr, baseCurrency, accessToken),
    getPendingOccurrencesCached(userId, todayStr, rangeEnd, accessToken),
  ]);

  if (accountsError) throw accountsError;
  if (!accounts || accounts.length === 0) return null;
  if (txError) throw txError;
  if (!transactions || transactions.length === 0) return null;

  // Window end for obligation scoping
  let windowEndDate: string;
  if (nextIncome) {
    windowEndDate = nextIncome.date;
  } else {
    // Use Colombia timezone for month-end fallback
    const [yearStr, monthStr] = todayStr.split("-");
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    windowEndDate = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;
  }

  const obligationMarkers: ObligationMarker[] = (pendingOccurrences ?? [])
    .filter((o) => o.direction === "OUTFLOW" && o.occurrence_date >= todayStr && o.occurrence_date <= windowEndDate)
    .map((o) => ({
      date: o.occurrence_date,
      name: o.merchant_name ?? o.description ?? "Recurrente",
      amount: o.expected_amount,
    }));

  // Compute disponible using window-scoped pending occurrences (same window as chart)
  const windowOutflows = (pendingOccurrences ?? [])
    .filter((o) => o.direction === "OUTFLOW" && o.occurrence_date >= todayStr && o.occurrence_date <= windowEndDate
      && o.currency_code === baseCurrency && o.account_type !== "CREDIT_CARD");
  const totalPending = windowOutflows.reduce((sum, o) => sum + o.expected_amount, 0);

  const liquidAccounts = accounts.filter(
    (a) => a.currency_code === baseCurrency
  );
  const liquidBalance = liquidAccounts.reduce(
    (sum, a) => sum + (a.current_balance ?? 0),
    0
  );
  const disponible = liquidBalance - totalPending;

  // Split transactions into total vs discretionary using is_recurring flag
  const discretionaryOutflows = transactions.filter((t) => !t.is_recurring);

  const total = computeBurnRate(transactions, liquidBalance, today, "total", windowEndDate);
  const discretionary = computeBurnRate(
    discretionaryOutflows,
    Math.max(disponible, 0),
    today,
    "discretionary",
    windowEndDate,
  );

  return {
    total, discretionary, liquidBalance, disponible, currency: baseCurrency,
    nextIncomeDate: nextIncome?.date ?? null,
    nextIncomeAmount: nextIncome?.amount ?? 0,
    obligations: obligationMarkers,
  };
}

// ─── Public wrapper ───────────────────────────────────────────────────────────

export async function getBurnRate(
  currency?: string
): Promise<BurnRateResponse | null> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return null;

  try {
    return await getBurnRateCached(accessToken, user.id, currency ?? "COP");
  } catch (error) {
    console.error("Error loading burn rate:", error);
    return null;
  }
}

function computeBurnRate(
  transactions: { amount: number; transaction_date: string }[],
  balance: number,
  today: Date,
  mode: "total" | "discretionary",
  windowEndDate: string,
): BurnRateResult {
  if (transactions.length === 0) {
    return {
      mode,
      dailyAverage: 0,
      runwayDays: 999,
      runwayDate: "",
      trend: "stable",
      dataPoints: [],
      monthsOfData: 0,
    };
  }

  const todayStr = toColombiaDateString(today);

  // Date range
  const firstDate = new Date(transactions[0].transaction_date);
  const totalDays = Math.max(
    1,
    Math.ceil((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Group by day and accumulate total in one pass
  const dailySpending = new Map<string, number>();
  let totalSpent = 0;
  for (const t of transactions) {
    dailySpending.set(t.transaction_date, (dailySpending.get(t.transaction_date) ?? 0) + t.amount);
    totalSpent += t.amount;
  }

  const spendingDays = dailySpending.size;
  const dailyAverage = spendingDays > 0 ? totalSpent / spendingDays : 0;

  // Runway
  const runwayDays =
    dailyAverage > 0 ? Math.round(balance / dailyAverage) : 999;
  const runwayDate = new Date(today);
  runwayDate.setDate(runwayDate.getDate() + (runwayDays < 999 ? runwayDays : 365));

  // Trend: last 14 days vs overall
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = toColombiaDateString(twoWeeksAgo);

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
  const monthStartStr = toColombiaDateString(monthStart);

  const currentMonthTxns = transactions.filter(
    (t) => t.transaction_date >= monthStartStr && t.transaction_date <= todayStr
  );
  const dailySums = new Map<string, number>();
  for (const t of currentMonthTxns) {
    dailySums.set(
      t.transaction_date,
      (dailySums.get(t.transaction_date) ?? 0) + t.amount
    );
  }

  // Build date array from month start to today
  const dates: string[] = [];
  for (
    let d = new Date(monthStart);
    d <= today;
    d.setDate(d.getDate() + 1)
  ) {
    dates.push(toColombiaDateString(d));
  }

  // Reconstruct daily balances by walking backwards from today's known balance
  let b = balance;
  const balances = new Map<string, number>();
  for (let i = dates.length - 1; i >= 0; i--) {
    balances.set(dates[i], b);
    b += dailySums.get(dates[i]) ?? 0;
  }

  const dataPoints: BurnRateDataPoint[] = dates.map((date) => ({
    date,
    balance: balances.get(date) ?? balance,
  }));

  // Add projected point at window end (next income or month end)
  if (windowEndDate > todayStr) {
    const daysToEnd = Math.max(1, Math.ceil(
      (new Date(windowEndDate + "T12:00:00").getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    ));
    const projectedBalance = Math.max(0, balance - dailyAverage * daysToEnd);
    dataPoints.push({ date: windowEndDate, balance: projectedBalance });
  }

  return {
    mode,
    dailyAverage,
    runwayDays,
    runwayDate: toColombiaDateString(runwayDate),
    trend,
    dataPoints,
    monthsOfData,
  };
}
