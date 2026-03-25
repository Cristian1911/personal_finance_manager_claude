"use server";

import { subMonths } from "date-fns";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toISODateString } from "@/lib/utils/date";
import type { CurrencyCode } from "@zeta/shared";

export interface IncomeEstimate {
  monthlyAverage: number;
  currency: CurrencyCode;
  monthsOfData: number;
  totalIncome: number;
  source: "profile" | "transactions"; // where the income figure came from
  recentTransactions: {
    id: string;
    description: string;
    amount: number;
    date: string;
  }[];
}

// ─── Cached inner function ────────────────────────────────────────────────────

async function getEstimatedIncomeCached(
  userId: string,
  currency: CurrencyCode,
  month: string | undefined
): Promise<IncomeEstimate | null> {
  "use cache";
  cacheTag("debt");
  cacheTag("profile");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const baseCurrency = currency;

  // Fetch profile salary and liquid accounts in parallel
  const [{ data: profile, error: profileError }, { data: liquidAccounts, error: accountsError }] =
    await Promise.all([
      supabase.from("profiles").select("monthly_salary, estimated_monthly_income").eq("id", userId).single(),
      supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .in("account_type", ["CHECKING", "SAVINGS"]),
    ]);

  if (profileError && profileError.code !== "PGRST116") throw profileError;
  if (accountsError) throw accountsError;

  // Priority: estimated_monthly_income (onboarding) > monthly_salary (settings) > transaction inference
  const profileIncome = (profile?.estimated_monthly_income && profile.estimated_monthly_income > 0)
    ? profile.estimated_monthly_income
    : (profile?.monthly_salary && profile.monthly_salary > 0)
      ? profile.monthly_salary
      : null;

  if (profileIncome !== null) {
    return {
      monthlyAverage: profileIncome,
      currency: baseCurrency,
      monthsOfData: 0,
      totalIncome: 0,
      source: "profile" as const,
      recentTransactions: [],
    };
  }

  const liquidAccountIds = liquidAccounts?.map((a) => a.id) ?? [];
  if (liquidAccountIds.length === 0) return null;

  // Fetch INFLOW transactions from last 12 months (enough for stable average)
  const twelveMonthsAgo = toISODateString(subMonths(new Date(), 12));
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("id, clean_description, raw_description, amount, transaction_date, account_id")
    .eq("user_id", userId)
    .eq("direction", "INFLOW")
    .eq("is_excluded", false)
    .neq("status", "CANCELLED")
    .eq("currency_code", baseCurrency)
    .in("account_id", liquidAccountIds)
    .gte("transaction_date", twelveMonthsAgo)
    .order("transaction_date", { ascending: false });

  if (txError) throw txError;
  if (!transactions || transactions.length === 0) return null;

  // Group by "YYYY-MM" and compute monthly totals
  const monthlyTotals = new Map<string, number>();
  for (const tx of transactions) {
    const m = tx.transaction_date.slice(0, 7); // "YYYY-MM"
    monthlyTotals.set(m, (monthlyTotals.get(m) ?? 0) + tx.amount);
  }

  const monthsOfData = monthlyTotals.size;
  const totalIncome = [...monthlyTotals.values()].reduce((s, v) => s + v, 0);
  const monthlyAverage = monthsOfData > 0 ? totalIncome / monthsOfData : 0;

  // If a specific month is requested, return that month's income (or average as fallback)
  const effectiveIncome = month && monthlyTotals.has(month)
    ? monthlyTotals.get(month)!
    : monthlyAverage;

  // Return income transactions for the requested month (or most recent)
  const filteredTransactions = month
    ? transactions.filter((tx) => tx.transaction_date.startsWith(month))
    : transactions;
  const recentTransactions = filteredTransactions.slice(0, 10).map((tx) => ({
    id: tx.id,
    description: tx.clean_description ?? tx.raw_description ?? "Ingreso",
    amount: tx.amount,
    date: tx.transaction_date,
  }));

  return {
    monthlyAverage: effectiveIncome,
    currency: baseCurrency,
    monthsOfData,
    totalIncome,
    source: "transactions" as const,
    recentTransactions,
  };
}

// ─── Public wrapper ───────────────────────────────────────────────────────────

/**
 * Estimate monthly income from INFLOW transactions.
 * Queries all income transactions in the user's preferred currency,
 * groups by month, and returns the average.
 *
 * Excludes debt account inflows (credit card payments received, etc.)
 * by filtering to only checking/savings accounts.
 */
export async function getEstimatedIncome(
  currency?: CurrencyCode,
  month?: string // "YYYY-MM" — if provided, return income for that specific month
): Promise<IncomeEstimate | null> {
  const { user } = await getAuthenticatedClient();
  if (!user) return null;
  return getEstimatedIncomeCached(user.id, currency ?? "COP", month);
}
