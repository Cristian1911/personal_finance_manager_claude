"use server";

import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractDebtAccounts,
  calcUtilization,
  estimateMonthlyInterest,
  generateInsights,
  type DebtOverview,
} from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_DEBT_OVERVIEW: DebtOverview = {
  totalDebt: 0,
  totalCreditLimit: 0,
  overallUtilization: 0,
  monthlyInterestEstimate: 0,
  accounts: [],
  insights: [],
  debtByCurrency: [],
};

// ─── Cached inner function ────────────────────────────────────────────────────

async function getDebtOverviewCached(
  userId: string,
  currency: CurrencyCode
): Promise<DebtOverview> {
  "use cache";
  cacheTag("debt");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const baseCurrency = currency;

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("display_order");

  if (error) throw error;
  if (!accounts) return EMPTY_DEBT_OVERVIEW;

  const debtAccounts = extractDebtAccounts(accounts);

  // Group debt totals by currency (using breakdowns when available)
  const byCurrency = new Map<CurrencyCode, { debt: number; limit: number }>();
  for (const a of debtAccounts) {
    if (a.currencyBreakdown) {
      for (const cb of a.currencyBreakdown) {
        const entry = byCurrency.get(cb.currency) ?? { debt: 0, limit: 0 };
        entry.debt += cb.balance;
        if (a.type === "CREDIT_CARD") entry.limit += cb.creditLimit ?? 0;
        byCurrency.set(cb.currency, entry);
      }
    } else {
      const entry = byCurrency.get(a.currency) ?? { debt: 0, limit: 0 };
      entry.debt += a.balance;
      if (a.type === "CREDIT_CARD") entry.limit += a.creditLimit ?? 0;
      byCurrency.set(a.currency, entry);
    }
  }
  const debtByCurrency = [...byCurrency.entries()].map(([currency, { debt, limit }]) => ({
    currency,
    totalDebt: debt,
    totalCreditLimit: limit,
  }));

  // Primary totals use baseCurrency if available, otherwise sum all
  const copEntry = byCurrency.get(baseCurrency);
  const totalDebt = copEntry ? copEntry.debt : debtAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalCreditLimit = copEntry
    ? copEntry.limit
    : debtAccounts
        .filter((a) => a.type === "CREDIT_CARD")
        .reduce((sum, a) => sum + (a.creditLimit ?? 0), 0);

  const overallUtilization = calcUtilization(
    debtAccounts
      .filter((a) => a.type === "CREDIT_CARD" && a.currency === baseCurrency)
      .reduce((sum, a) => sum + a.balance, 0),
    totalCreditLimit
  );

  const monthlyInterestEstimate = debtAccounts
    .filter((a) => a.currency === baseCurrency)
    .reduce(
      (sum, a) => sum + estimateMonthlyInterest(a.balance, a.interestRate),
      0
    );

  const insights = generateInsights(debtAccounts);

  return {
    totalDebt,
    totalCreditLimit,
    overallUtilization,
    monthlyInterestEstimate,
    accounts: debtAccounts,
    insights,
    debtByCurrency,
  };
}

// ─── Public wrapper ───────────────────────────────────────────────────────────

export async function getDebtOverview(currency?: CurrencyCode): Promise<DebtOverview> {
  const baseCurrency = currency ?? "COP";
  const { user } = await getAuthenticatedClient();

  if (!user) return EMPTY_DEBT_OVERVIEW;
  return getDebtOverviewCached(user.id, baseCurrency);
}
