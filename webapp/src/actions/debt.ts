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
  computeDebtTrend,
  detectExtraPayments,
  type DebtOverview,
  type DebtAccount,
  type DebtTrendStatus,
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

// ─── Debt trend (honest MoM cuota comparison) ────────────────────────────────

export interface DebtTrendData {
  deltaPct: number | null;
  status: DebtTrendStatus | null;
  currentCuota: number | null;
  previousCuota: number | null;
  /** Ascending by period (YYYY-MM), up to 6 entries. */
  sparkline: { period: string; total: number }[];
  extraPayments: { count: number; totalExtra: number };
}

const EMPTY_DEBT_TREND: DebtTrendData = {
  deltaPct: null,
  status: null,
  currentCuota: null,
  previousCuota: null,
  sparkline: [],
  extraPayments: { count: 0, totalExtra: 0 },
};

async function getDebtTrendCached(
  userId: string,
  currency: CurrencyCode,
  accessToken: string
): Promise<DebtTrendData> {
  "use cache";
  cacheTag("debt", "snapshots");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, monthly_payment, currency_code")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("account_type", ["CREDIT_CARD", "LOAN"]);

  if (accountsError) throw accountsError;

  const debtIds = (accounts ?? [])
    .filter((a) => a.currency_code === currency)
    .map((a) => a.id);
  if (debtIds.length === 0) return EMPTY_DEBT_TREND;

  const monthStart = `${toColombiaDateString(new Date()).slice(0, 7)}-01`;

  // Bound snapshots by date (sparkline needs 6 months) — a bare row limit
  // could let one snapshot-heavy account starve another's recent months.
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() - 7);
  const horizonStr = toColombiaDateString(horizon);

  const [snapshotsResult, paymentsResult] = await Promise.all([
    supabase
      .from("statement_snapshots")
      .select("account_id, total_payment_due, minimum_payment, period_to")
      .eq("user_id", userId)
      .in("account_id", debtIds)
      .gte("period_to", horizonStr)
      .order("period_to", { ascending: false }),
    supabase
      .from("transactions")
      .select("account_id, amount, transaction_date")
      .eq("user_id", userId)
      .eq("direction", "INFLOW")
      .in("account_id", debtIds)
      .gte("transaction_date", monthStart),
  ]);

  if (snapshotsResult.error) throw snapshotsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const snapshots = snapshotsResult.data ?? [];

  // Latest snapshot cuota per (account, month) — first seen wins (ordered DESC).
  const cuotaByMonthAccount = new Map<string, Map<string, number>>();
  for (const snap of snapshots) {
    if (!snap.period_to) continue;
    const month = snap.period_to.slice(0, 7);
    const cuota = snap.total_payment_due ?? snap.minimum_payment;
    if (cuota == null) continue;
    let perAccount = cuotaByMonthAccount.get(month);
    if (!perAccount) {
      perAccount = new Map();
      cuotaByMonthAccount.set(month, perAccount);
    }
    if (!perAccount.has(snap.account_id)) {
      perAccount.set(snap.account_id, Math.abs(cuota));
    }
  }

  const sparkline = [...cuotaByMonthAccount.entries()]
    .map(([period, perAccount]) => ({
      period,
      total: [...perAccount.values()].reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-6);

  const currentCuota = sparkline.at(-1)?.total ?? null;
  const previousCuota = sparkline.at(-2)?.total ?? null;
  const { deltaPct, status } = computeDebtTrend(currentCuota, previousCuota);

  // Expected cuota per account = latest snapshot cuota, fallback account.monthly_payment.
  const latestCuotaByAccount = new Map<string, number>();
  for (const snap of snapshots) {
    const cuota = snap.total_payment_due ?? snap.minimum_payment;
    if (cuota != null && !latestCuotaByAccount.has(snap.account_id)) {
      latestCuotaByAccount.set(snap.account_id, Math.abs(cuota));
    }
  }
  const expected = debtIds.map((id) => ({
    accountId: id,
    cuota:
      latestCuotaByAccount.get(id) ??
      Math.abs((accounts ?? []).find((a) => a.id === id)?.monthly_payment ?? 0),
  }));

  const extraPayments = detectExtraPayments(
    (paymentsResult.data ?? []).map((tx) => ({
      accountId: tx.account_id,
      amount: Math.abs(tx.amount),
      date: tx.transaction_date,
    })),
    expected
  );

  return { deltaPct, status, currentCuota, previousCuota, sparkline, extraPayments };
}

export async function getDebtTrend(
  currency?: CurrencyCode
): Promise<DebtTrendData> {
  const baseCurrency = currency ?? "COP";
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return EMPTY_DEBT_TREND;

  try {
    return await getDebtTrendCached(user.id, baseCurrency, accessToken);
  } catch (error) {
    console.error("Error computing debt trend:", error);
    return EMPTY_DEBT_TREND;
  }
}
