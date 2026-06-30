"use server";

import { subMonths } from "date-fns";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { toISODateString } from "@/lib/utils/date";
import { toMonthlyAmount } from "@/lib/utils/recurring";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import type { CurrencyCode } from "@zeta/shared";

export interface IncomeEstimate {
  monthlyAverage: number;
  currency: CurrencyCode;
  monthsOfData: number;
  totalIncome: number;
  source: "profile" | "recurring" | "transactions";
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
  month: string | undefined,
  accessToken: string
): Promise<IncomeEstimate | null> {
  "use cache";
  cacheTag("debt");
  cacheTag("profile");
  cacheTag("recurring");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
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
  let profileIncome: number | null = null;
  if (profile?.estimated_monthly_income && profile.estimated_monthly_income > 0) {
    profileIncome = profile.estimated_monthly_income;
  } else if (profile?.monthly_salary && profile.monthly_salary > 0) {
    profileIncome = profile.monthly_salary;
  }

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

  // Priority 3: Recurring INFLOW templates (active, non-debt accounts, same currency)
  const { data: inflowTemplates } = await supabase
    .from("recurring_transaction_templates")
    .select("amount, frequency, currency_code, account:accounts!recurring_transaction_templates_account_id_fkey(account_type)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("direction", "INFLOW")
    .eq("currency_code", baseCurrency);

  if (inflowTemplates && inflowTemplates.length > 0) {
    let recurringMonthlyIncome = 0;
    for (const t of inflowTemplates) {
      const acctType = (t.account as { account_type?: string } | null)?.account_type;
      if (acctType && isDebtAccountType(acctType)) continue;
      recurringMonthlyIncome += toMonthlyAmount(t.amount, t.frequency);
    }
    if (recurringMonthlyIncome > 0) {
      return {
        monthlyAverage: recurringMonthlyIncome,
        currency: baseCurrency,
        monthsOfData: 0,
        totalIncome: 0,
        source: "recurring" as const,
        recentTransactions: [],
      };
    }
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
    .is("reconciled_into_transaction_id", null)
    .neq("status", "CANCELLED")
    .eq("currency_code", baseCurrency)
    .in("account_id", liquidAccountIds)
    .gte("transaction_date", twelveMonthsAgo)
    .is("personal_debt_id", null)
    .order("transaction_date", { ascending: false })
    .limit(500);

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

export async function getEstimatedIncome(
  currency?: CurrencyCode,
  month?: string // "YYYY-MM" — if provided, return income for that specific month
): Promise<IncomeEstimate | null> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return null;
  return getEstimatedIncomeCached(user.id, currency ?? "COP", month, accessToken);
}
