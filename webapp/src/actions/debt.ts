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
  /** Month-over-month delta of ACTUAL payments (drives the header line). */
  deltaPct: number | null;
  /** Cuota-trend chip (mejorando/estable/mes_pesado) from the expected series. */
  status: DebtTrendStatus | null;
  currentCuota: number | null;
  previousCuota: number | null;
  /**
   * Ascending by period (YYYY-MM), up to 6 entries.
   * `total` = actual payments made that month (INFLOW to debt accounts,
   * including extra payments and archived obligations).
   * `expected` = sum of cuotas due that month per recurring occurrences
   * (null when no occurrence data exists for that month).
   * `payments` = per-debt breakdown of that month's payments, sorted desc.
   */
  sparkline: {
    period: string;
    total: number;
    expected: number | null;
    payments: { name: string; amount: number }[];
  }[];
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
  cacheTag("debt", "snapshots", "occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  // Include ARCHIVED debt accounts: their payment history is part of the
  // trend even after the obligation is closed.
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name, monthly_payment, currency_code, is_active")
    .eq("user_id", userId)
    .in("account_type", ["CREDIT_CARD", "LOAN"]);

  if (accountsError) throw accountsError;

  const debtAccounts = (accounts ?? []).filter((a) => a.currency_code === currency);
  const debtIds = debtAccounts.map((a) => a.id);
  const activeDebtIds = debtAccounts.filter((a) => a.is_active).map((a) => a.id);
  if (debtIds.length === 0) return EMPTY_DEBT_TREND;

  const monthStart = `${toColombiaDateString(new Date()).slice(0, 7)}-01`;

  // 6-month window in Colombia time.
  const currentMonth = toColombiaDateString(new Date()).slice(0, 7);
  const [curYear, curMonthNum] = currentMonth.split("-").map(Number);
  const windowStart = new Date(curYear, curMonthNum - 1 - 5, 1);
  const windowStartStr = `${windowStart.getFullYear()}-${String(windowStart.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(curYear, curMonthNum, 1);
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  // Bound snapshots by date (expected-cuota fallback) — a bare row limit
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
    // Whole window: feeds both the monthly paid series and this month's
    // extra-payment detection.
    supabase
      .from("transactions")
      .select("account_id, amount, transaction_date")
      .eq("user_id", userId)
      .eq("direction", "INFLOW")
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null)
      .in("account_id", debtIds)
      .gte("transaction_date", windowStartStr)
      .lt("transaction_date", nextMonthStr),
  ]);

  if (snapshotsResult.error) throw snapshotsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const snapshots = snapshotsResult.data ?? [];

  // Sparkline = ACTUAL payments per month (covers extra abonos and archived
  // obligations — sourced from each debt account's transaction history).
  // Overlay = expected cuota per month from recurring_occurrences.
  const nameById = new Map(debtAccounts.map((a) => [a.id, a.name ?? "Obligación"]));
  const paidByMonth = new Map<string, number>();
  const paidByMonthAccount = new Map<string, Map<string, number>>();
  for (const tx of paymentsResult.data ?? []) {
    const month = tx.transaction_date.slice(0, 7);
    paidByMonth.set(month, (paidByMonth.get(month) ?? 0) + Math.abs(tx.amount));
    let perAccount = paidByMonthAccount.get(month);
    if (!perAccount) {
      perAccount = new Map();
      paidByMonthAccount.set(month, perAccount);
    }
    perAccount.set(tx.account_id, (perAccount.get(tx.account_id) ?? 0) + Math.abs(tx.amount));
  }

  const { data: debtTemplates } = await supabase
    .from("recurring_transaction_templates")
    .select("id")
    .eq("user_id", userId)
    .in("account_id", debtIds);
  const debtTemplateIds = (debtTemplates ?? []).map((t) => t.id);

  const expectedByMonth = new Map<string, number>();
  if (debtTemplateIds.length > 0) {
    const { data: occurrences, error: occError } = await supabase
      .from("recurring_occurrences")
      .select("expected_amount, occurrence_date, status")
      .eq("user_id", userId)
      .in("template_id", debtTemplateIds)
      .gte("occurrence_date", windowStartStr)
      .lt("occurrence_date", nextMonthStr);
    if (occError) throw occError;

    for (const occ of occurrences ?? []) {
      if (occ.status === "skipped") continue;
      const month = occ.occurrence_date.slice(0, 7);
      expectedByMonth.set(
        month,
        (expectedByMonth.get(month) ?? 0) + Math.abs(occ.expected_amount ?? 0)
      );
    }
  }

  const fullWindow = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(curYear, curMonthNum - 1 - (5 - i), 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const payments = [...(paidByMonthAccount.get(period) ?? new Map<string, number>())]
      .map(([accountId, amount]) => ({
        name: nameById.get(accountId) ?? "Obligación",
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
    return {
      period,
      total: paidByMonth.get(period) ?? 0,
      expected: expectedByMonth.get(period) ?? null,
      payments,
    };
  });
  // Trim leading months with no data at all (pre-adoption) so they don't
  // read as "no debt".
  const firstWithData = fullWindow.findIndex((m) => m.total > 0 || (m.expected ?? 0) > 0);
  const sparkline = firstWithData === -1 ? [] : fullWindow.slice(firstWithData);

  // Header delta: actual payments month-over-month.
  const paidCurrent = sparkline.at(-1)?.total ?? null;
  const paidPrevious = sparkline.at(-2)?.total ?? null;
  const { deltaPct } = computeDebtTrend(paidCurrent, paidPrevious);

  // Chip keeps the spec'd cuota-trend semantics: expected series MoM.
  const currentCuota = sparkline.at(-1)?.expected ?? null;
  const previousCuota = sparkline.at(-2)?.expected ?? null;
  const { status } = computeDebtTrend(currentCuota, previousCuota);

  // Expected cuota per account = latest snapshot cuota, fallback account.monthly_payment.
  const latestCuotaByAccount = new Map<string, number>();
  for (const snap of snapshots) {
    const cuota = snap.total_payment_due ?? snap.minimum_payment;
    if (cuota != null && !latestCuotaByAccount.has(snap.account_id)) {
      latestCuotaByAccount.set(snap.account_id, Math.abs(cuota));
    }
  }
  const expected = activeDebtIds.map((id) => ({
    accountId: id,
    cuota:
      latestCuotaByAccount.get(id) ??
      Math.abs((accounts ?? []).find((a) => a.id === id)?.monthly_payment ?? 0),
  }));

  // Extra-payment detection only looks at the CURRENT month's payments.
  const extraPayments = detectExtraPayments(
    (paymentsResult.data ?? [])
      .filter((tx) => tx.transaction_date >= monthStart)
      .map((tx) => ({
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

// ─── Archived (fully paid) obligations ───────────────────────────────────────

export interface ArchivedObligation {
  id: string;
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  currency: CurrencyCode;
  /** Lifetime payments made to this obligation (INFLOW transactions). */
  totalPaid: number;
  /** When the obligation was archived (account row's last update). */
  archivedAt: string | null;
}

async function getArchivedDebtObligationsCached(
  userId: string,
  accessToken: string
): Promise<ArchivedObligation[]> {
  "use cache";
  cacheTag("debt", "accounts");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, name, account_type, currency_code, updated_at")
    .eq("user_id", userId)
    .eq("is_active", false)
    .in("account_type", ["CREDIT_CARD", "LOAN"]);

  if (error) throw error;
  if (!accounts || accounts.length === 0) return [];

  const ids = accounts.map((a) => a.id);
  const { data: payments, error: payError } = await supabase
    .from("transactions")
    .select("account_id, amount")
    .eq("user_id", userId)
    .eq("direction", "INFLOW")
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .in("account_id", ids);

  if (payError) throw payError;

  const paidById = new Map<string, number>();
  for (const tx of payments ?? []) {
    paidById.set(tx.account_id, (paidById.get(tx.account_id) ?? 0) + Math.abs(tx.amount));
  }

  return accounts
    .map((a) => ({
      id: a.id,
      name: a.name ?? "Obligación",
      type: a.account_type as "CREDIT_CARD" | "LOAN",
      currency: (a.currency_code ?? "COP") as CurrencyCode,
      totalPaid: paidById.get(a.id) ?? 0,
      archivedAt: a.updated_at ?? null,
    }))
    .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
}

export async function getArchivedDebtObligations(): Promise<ArchivedObligation[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  try {
    return await getArchivedDebtObligationsCached(user.id, accessToken);
  } catch (error) {
    console.error("Error fetching archived obligations:", error);
    return [];
  }
}
