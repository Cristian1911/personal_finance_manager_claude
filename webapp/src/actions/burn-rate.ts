"use server";

import { subMonths } from "date-fns";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toISODateString } from "@/lib/utils/date";
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

// ─── Cached inner function ────────────────────────────────────────────────────

async function getBurnRateCached(
  userId: string,
  currency: string
): Promise<BurnRateResponse | null> {
  "use cache";
  cacheTag("dashboard");
  cacheTag("accounts");
  cacheTag("recurring");
  cacheLife("zeta");

  const supabase = createAdminClient()!;
  const baseCurrency = currency as CurrencyCode;

  // 0. Compute pending obligations from active recurring templates (OUTFLOW only)
  const { data: templates } = await supabase
    .from("recurring_transaction_templates")
    .select("amount, direction, currency_code")
    .eq("user_id", userId)
    .eq("is_active", true);

  const totalPending = (templates ?? [])
    .filter(t => t.direction === "OUTFLOW" && (t.currency_code ?? "COP") === baseCurrency)
    .reduce((sum, t) => sum + t.amount, 0);

  // 1. Fetch liquid accounts (checking + savings, not credit cards or loans)
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, current_balance, currency_code, account_type")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("account_type", ["CHECKING", "SAVINGS"]);

  if (accountsError) throw accountsError;
  if (!accounts || accounts.length === 0) return null;

  const liquidAccounts = accounts.filter(
    (a) => a.currency_code === baseCurrency
  );
  const liquidBalance = liquidAccounts.reduce(
    (sum, a) => sum + (a.current_balance ?? 0),
    0
  );

  // 2. Fetch outflow transactions (last 3 months — enough for stable average + chart)
  const threeMonthsAgo = toISODateString(subMonths(new Date(), 3));
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("id, amount, transaction_date, direction, is_recurring")
    .eq("user_id", userId)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .eq("currency_code", baseCurrency)
    .gte("transaction_date", threeMonthsAgo)
    .order("transaction_date", { ascending: true });

  if (txError) throw txError;
  if (!transactions || transactions.length === 0) return null;

  // 3. Compute disponible using pre-fetched pending obligations
  const disponible = liquidBalance - totalPending;

  // 4. Split transactions into total vs discretionary using is_recurring flag
  const discretionaryOutflows = transactions.filter((t) => !t.is_recurring);

  // 5. Compute both modes
  const today = new Date();
  const total = computeBurnRate(transactions, liquidBalance, today, "total");
  const discretionary = computeBurnRate(
    discretionaryOutflows,
    Math.max(disponible, 0),
    today,
    "discretionary"
  );

  return { total, discretionary, liquidBalance, disponible, currency: baseCurrency };
}

// ─── Public wrapper ───────────────────────────────────────────────────────────

export async function getBurnRate(
  currency?: string
): Promise<BurnRateResponse | null> {
  const { user } = await getAuthenticatedClient();
  if (!user) return null;

  return getBurnRateCached(user.id, currency ?? "COP");
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
      runwayDays: 999,
      runwayDate: "",
      trend: "stable",
      dataPoints: [],
      monthsOfData: 0,
    };
  }

  const todayStr = toISODateString(today);

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
  const twoWeeksAgoStr = toISODateString(twoWeeksAgo);

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
  const monthStartStr = toISODateString(monthStart);

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
    dates.push(toISODateString(d));
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

  // Add projected point at zero
  if (runwayDays < 999 && runwayDays > 0) {
    dataPoints.push({
      date: toISODateString(runwayDate),
      balance: 0,
    });
  }

  return {
    mode,
    dailyAverage,
    runwayDays,
    runwayDate: toISODateString(runwayDate),
    trend,
    dataPoints,
    monthsOfData,
  };
}
