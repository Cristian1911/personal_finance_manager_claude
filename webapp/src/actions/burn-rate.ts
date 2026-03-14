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

  if (!user) return null;

  // 1. Fetch liquid accounts (checking + savings, not credit cards or loans)
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, current_balance, currency_code, account_type")
    .eq("user_id", user.id)
    .in("account_type", ["CHECKING", "SAVINGS"]);

  if (!accounts || accounts.length === 0) return null;

  const baseCurrency = (currency ?? "COP") as CurrencyCode;
  const liquidAccounts = accounts.filter(
    (a) => a.currency_code === baseCurrency
  );
  const liquidBalance = liquidAccounts.reduce(
    (sum, a) => sum + (a.current_balance ?? 0),
    0
  );

  // 2. Fetch outflow transactions over all available months
  //    Use is_recurring flag to distinguish fixed vs discretionary
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

  return { total, discretionary, liquidBalance, disponible, currency: baseCurrency };
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
      runwayDays: 999,  // Infinity is not valid JSON -- Next.js serializes it as null
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
