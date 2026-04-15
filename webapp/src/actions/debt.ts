"use server";

import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import {
  extractDebtAccounts,
  calcUtilization,
  estimateMonthlyInterest,
  generateInsights,
  sanitizeInterestRate,
  type DebtOverview,
  type DebtAccount,
} from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import { toColombiaDateString } from "@/lib/utils/date";

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

/** Check if month string (YYYY-MM) is the current or future month, or absent */
function isCurrentOrFutureMonth(month?: string): boolean {
  if (!month) return true;
  const current = toColombiaDateString(new Date()).slice(0, 7);
  return month >= current;
}

// ─── Build DebtOverview from DebtAccount[] ───────────────────────────────────

function buildOverview(
  debtAccounts: DebtAccount[],
  baseCurrency: CurrencyCode
): DebtOverview {
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

// ─── Cached: current month (live account data) ──────────────────────────────

async function getDebtOverviewLiveCached(
  userId: string,
  currency: CurrencyCode,
  accessToken: string
): Promise<DebtOverview> {
  "use cache";
  cacheTag("debt");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("account_type", ["CREDIT_CARD", "LOAN"])
    .order("display_order");

  if (error) throw error;
  if (!accounts) return EMPTY_DEBT_OVERVIEW;

  return buildOverview(extractDebtAccounts(accounts), currency);
}

// ─── Cached: past month (statement snapshots) ───────────────────────────────

async function getDebtOverviewForMonthCached(
  userId: string,
  currency: CurrencyCode,
  month: string,
  accessToken: string
): Promise<DebtOverview> {
  "use cache";
  cacheTag("snapshots");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  // Parse month to get end-of-month date
  const [year, mon] = month.split("-").map(Number);
  const endOfMonth = new Date(year, mon, 0); // last day of month
  const endStr = `${year}-${String(mon).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

  // Fetch debt accounts (for static fields: name, type, color, payment_day, etc.)
  // and snapshots for the month in parallel
  const [accountsResult, snapshotsResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, account_type, currency_code, payment_day, cutoff_day, color, institution_name, loan_amount, display_order")
      .eq("user_id", userId)
      .in("account_type", ["CREDIT_CARD", "LOAN"])
      .order("display_order"),
    supabase
      .from("statement_snapshots")
      .select("account_id, final_balance, remaining_balance, credit_limit, interest_rate, minimum_payment, total_payment_due, currency_code, period_to, initial_amount")
      .eq("user_id", userId)
      .lte("period_to", endStr)
      .order("period_to", { ascending: false })
      .limit(200),
  ]);

  if (accountsResult.error) throw accountsResult.error;
  if (snapshotsResult.error) throw snapshotsResult.error;

  const accounts = accountsResult.data ?? [];
  const snapshots = snapshotsResult.data ?? [];

  if (accounts.length === 0) return EMPTY_DEBT_OVERVIEW;

  // Take the most recent snapshot per account (first seen wins since ordered DESC)
  const latestSnap = new Map<string, (typeof snapshots)[number]>();
  for (const snap of snapshots) {
    if (!latestSnap.has(snap.account_id)) {
      latestSnap.set(snap.account_id, snap);
    }
  }

  // Build DebtAccount[] by merging static account data with snapshot financials
  const debtAccounts: DebtAccount[] = [];
  for (const acct of accounts) {
    const snap = latestSnap.get(acct.id);
    if (!snap) continue; // No snapshot data for this account in/before this month

    const acctType = acct.account_type as "CREDIT_CARD" | "LOAN";
    const balance = snap.final_balance ?? snap.remaining_balance ?? 0;

    debtAccounts.push({
      id: acct.id,
      name: acct.name,
      type: acctType,
      balance: Math.abs(balance),
      creditLimit: snap.credit_limit ?? null,
      interestRate: sanitizeInterestRate(snap.interest_rate, acctType),
      monthlyPayment: snap.minimum_payment ?? snap.total_payment_due ?? null,
      paymentDay: acct.payment_day,
      cutoffDay: acct.cutoff_day,
      currency: (snap.currency_code ?? acct.currency_code) as CurrencyCode,
      color: acct.color,
      institutionName: acct.institution_name,
      currencyBreakdown: null, // Snapshots don't have multi-currency breakdown
      loanAmount: snap.initial_amount ?? acct.loan_amount,
    });
  }

  if (debtAccounts.length === 0) return EMPTY_DEBT_OVERVIEW;
  return buildOverview(debtAccounts, currency);
}

// ─── Public wrapper ───────────────────────────────────────────────────────────

export async function getDebtOverview(
  currency?: CurrencyCode,
  month?: string
): Promise<DebtOverview> {
  const baseCurrency = currency ?? "COP";
  const { user, accessToken } = await getAuthenticatedClient();

  if (!user || !accessToken) return EMPTY_DEBT_OVERVIEW;

  if (isCurrentOrFutureMonth(month)) {
    return getDebtOverviewLiveCached(user.id, baseCurrency, accessToken);
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month!)) {
    return EMPTY_DEBT_OVERVIEW;
  }
  return getDebtOverviewForMonthCached(user.id, baseCurrency, month!, accessToken);
}
