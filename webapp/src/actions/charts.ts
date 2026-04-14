"use server";

import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { addDays } from "date-fns";
import { toColombiaDateString, getColombiaDayOfMonth } from "@/lib/utils/date";
import { getAccounts } from "@/actions/accounts";
import { getPendingOccurrencesCached, getNextIncomeOccurrenceCached } from "@/actions/occurrences";
import { PAY_CYCLE_LOOKAHEAD_DAYS } from "@/lib/constants/occurrences";
import { getFreshnessLevel } from "@/lib/utils/dashboard";
import { getIsDemoFilter, getDemoAccountIds } from "@/lib/demo-filter";
import {
  formatDate,
  parseMonth,
  monthStartStr,
  monthEndStr,
  monthsBeforeStart,
} from "@/lib/utils/date";
import { computeDebtBalance } from "@zeta/shared";
import type { Json } from "@/types/database";
import type { CurrencyCode } from "@/types/domain";

// --- Types ---

export interface CategorySpending {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
  count: number;
  percentage: number;
  budgetTarget?: number;
  expense_type: "fixed" | "variable" | null;
}

export interface MonthlyCashflow {
  month: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface DailySpending {
  date: string;
  label: string;
  amount: number;
}

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getCategorySpendingCached(
  accessToken: string,
  userId: string,
  month: string | undefined,
  currency: CurrencyCode | undefined,
  isDemo: boolean
): Promise<CategorySpending[]> {
  "use cache";
  cacheTag("dashboard:charts");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const target = parseMonth(month);

  const accountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!accountIds) return [];

  // Fetch transactions and budgets in parallel
  const [txRes, budgetsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, category_id, categories!category_id(name_es, name, color, expense_type)")
      .eq("user_id", userId)
      .in("account_id", accountIds)
      .eq("direction", "OUTFLOW")
      .eq("is_excluded", false)
      .eq("currency_code", currency ?? "COP")
      .gte("transaction_date", monthStartStr(target))
      .lte("transaction_date", monthEndStr(target))
      .is("reconciled_into_transaction_id", null)
      .is("transfer_group_id", null),

    supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("user_id", userId),
  ]);

  if (txRes.error) throw txRes.error;
  if (budgetsRes.error) throw budgetsRes.error;

  const transactions = txRes.data;
  const budgets = budgetsRes.data || [];

  if (!transactions || transactions.length === 0) return [];

  const budgetMap = new Map<string, number>();
  for (const b of budgets) {
    if (b.category_id) {
      budgetMap.set(b.category_id, Number(b.amount));
    }
  }

  // Aggregate by category
  const map = new Map<
    string,
    { name: string; color: string; amount: number; count: number; categoryId: string | null; budgetTarget?: number; expense_type: "fixed" | "variable" | null }
  >();
  let total = 0;

  for (const tx of transactions) {
    const id = tx.category_id ?? "uncategorized";
    const cat = tx.categories as { name_es: string | null; name: string; color: string; expense_type: string | null } | null;

    if (!map.has(id)) {
      const rawExpenseType = cat?.expense_type ?? null;
      map.set(id, {
        categoryId: tx.category_id,
        name: cat?.name_es ?? cat?.name ?? "Sin categoría",
        color: cat?.color ?? "#94a3b8",
        amount: 0,
        count: 0,
        budgetTarget: tx.category_id ? budgetMap.get(tx.category_id) : undefined,
        expense_type: rawExpenseType === "fixed" || rawExpenseType === "variable" ? rawExpenseType : null,
      });
    }

    const entry = map.get(id)!;
    entry.amount += tx.amount;
    entry.count += 1;
    total += tx.amount;
  }

  return Array.from(map.values())
    .map((e) => ({
      ...e,
      percentage: total > 0 ? (e.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

async function getMonthlyCashflowCached(
  accessToken: string,
  userId: string,
  month: string | undefined,
  currency: CurrencyCode | undefined,
  isDemo: boolean
): Promise<MonthlyCashflow[]> {
  "use cache";
  cacheTag("dashboard:cashflow");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const target = parseMonth(month);

  const accountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!accountIds) return [];

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("transaction_date, amount, direction, accounts!account_id(account_type)")
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .eq("is_excluded", false)
    .eq("currency_code", currency ?? "COP")
    .gte("transaction_date", monthsBeforeStart(target, 5))
    .lte("transaction_date", monthEndStr(target))
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null);

  if (error) throw error;
  if (!transactions || transactions.length === 0) return [];

  const map = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const m = tx.transaction_date.substring(0, 7); // "2026-02"

    if (!map.has(m)) {
      map.set(m, { income: 0, expenses: 0 });
    }

    const entry = map.get(m)!;
    const acctType = (tx.accounts as { account_type: string } | null)?.account_type;
    const isDebtAccount = acctType === "CREDIT_CARD" || acctType === "LOAN";

    if (tx.direction === "INFLOW" && !isDebtAccount) {
      entry.income += tx.amount;
    } else if (tx.direction === "OUTFLOW") {
      entry.expenses += tx.amount;
    }
    // Debt INFLOW is neither income nor expense in this context
  }

  return Array.from(map.entries())
    .map(([m, data]) => ({
      month: m,
      label: formatDate(new Date(m + "-15"), "MMM yyyy"),
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function getDailySpendingCached(
  accessToken: string,
  userId: string,
  month: string | undefined,
  currency: CurrencyCode | undefined,
  isDemo: boolean
): Promise<DailySpending[]> {
  "use cache";
  cacheTag("dashboard:charts");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const target = parseMonth(month);

  const accountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!accountIds) return [];

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("transaction_date, amount")
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .eq("currency_code", currency ?? "COP")
    .gte("transaction_date", monthStartStr(target))
    .lte("transaction_date", monthEndStr(target))
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null);

  if (error) throw error;
  if (!transactions || transactions.length === 0) return [];

  const map = new Map<string, number>();

  for (const tx of transactions) {
    map.set(tx.transaction_date, (map.get(tx.transaction_date) ?? 0) + tx.amount);
  }

  return Array.from(map.entries())
    .map(([date, amount]) => ({
      date,
      label: formatDate(date, "dd MMM"),
      amount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthMetrics {
  income: number;
  expenses: number;
}

async function getMonthMetricsCached(
  accessToken: string,
  userId: string,
  month: string | undefined,
  currency: CurrencyCode | undefined,
  isDemo: boolean
): Promise<MonthMetrics> {
  "use cache";
  cacheTag("dashboard:charts");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const target = parseMonth(month);

  // Get account IDs matching demo filter + optional currency
  let accountQuery = supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_demo", isDemo);
  if (currency) {
    accountQuery = accountQuery.eq("currency_code", currency);
  }
  const { data: filteredAccounts } = await accountQuery;
  const accountIds = (filteredAccounts ?? []).map((a) => a.id);
  if (accountIds.length === 0) return { income: 0, expenses: 0 };

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("amount, direction, accounts!account_id(account_type)")
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .eq("is_excluded", false)
    .gte("transaction_date", monthStartStr(target))
    .lte("transaction_date", monthEndStr(target))
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null);

  if (error) throw error;
  if (!transactions) return { income: 0, expenses: 0 };

  let income = 0;
  let expenses = 0;
  for (const tx of transactions) {
    const acctType = (tx.accounts as { account_type: string } | null)?.account_type;
    const isDebtAccount = acctType === "CREDIT_CARD" || acctType === "LOAN";
    if (tx.direction === "INFLOW" && !isDebtAccount) income += tx.amount;
    else if (tx.direction === "OUTFLOW") expenses += tx.amount;
  }

  return { income, expenses };
}

export interface DailyCashflow {
  date: string;
  label: string;
  income: number;
  expenses: number;
}

async function getDailyCashflowCached(
  accessToken: string,
  userId: string,
  month: string | undefined,
  isDemo: boolean
): Promise<DailyCashflow[]> {
  "use cache";
  cacheTag("dashboard:cashflow");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const target = parseMonth(month);
  const startStr = monthStartStr(target);
  const endStr = monthEndStr(target);

  const accountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!accountIds) return [];

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("transaction_date, amount, direction, accounts!account_id(account_type)")
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .eq("is_excluded", false)
    .gte("transaction_date", startStr)
    .lte("transaction_date", endStr)
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null);

  if (error) throw error;
  if (!transactions || transactions.length === 0) return [];

  const map = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const day = map.get(tx.transaction_date) ?? { income: 0, expenses: 0 };
    const acctType = (tx.accounts as { account_type: string } | null)?.account_type;
    const isDebtAccount = acctType === "CREDIT_CARD" || acctType === "LOAN";

    if (tx.direction === "INFLOW" && !isDebtAccount) {
      day.income += tx.amount;
    } else if (tx.direction === "OUTFLOW") {
      day.expenses += tx.amount;
    }
    // Debt INFLOW is neither income nor expense in this context
    map.set(tx.transaction_date, day);
  }

  // Fill in all days of the month
  const result: DailyCashflow[] = [];
  const year = target.getFullYear();
  const monthNum = target.getMonth();
  const lastDay = new Date(year, monthNum + 1, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(monthNum + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayData = map.get(dateStr) ?? { income: 0, expenses: 0 };
    result.push({
      date: dateStr,
      label: formatDate(dateStr, "dd MMM"),
      income: dayData.income,
      expenses: dayData.expenses,
    });
  }

  return result;
}

export interface SparklinePoint {
  date: string;
  balance: number;
}

export interface AccountWithSparkline {
  id: string;
  name: string;
  account_type: string;
  current_balance: number;
  currency_balances: Json | null;
  credit_limit: number | null;
  currency_code: string;
  updated_at: string;
  color: string | null;
  interest_rate: number | null;
  monthly_payment: number | null;
  loan_amount: number | null;
  // Computed fields
  sparkline: SparklinePoint[];
  changePercent: number;
  utilization: number | null; // credit cards only
  installmentProgress: string | null; // loans only (e.g., "18/48")
}

export interface GroupedAccounts {
  deposits: AccountWithSparkline[];
  debt: AccountWithSparkline[];
}

async function getAccountsWithSparklineDataCached(
  accessToken: string,
  userId: string,
  isDemo: boolean
): Promise<GroupedAccounts> {
  "use cache";
  cacheTag("accounts");
  cacheTag("dashboard:accounts");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  // 1. Fetch active accounts marked for dashboard (only columns we use)
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name, account_type, current_balance, currency_balances, credit_limit, currency_code, updated_at, color, interest_rate, monthly_payment, loan_amount")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_demo", isDemo)
    .eq("show_in_dashboard", true)
    .order("display_order");

  if (accountsError) throw accountsError;
  if (!accounts || accounts.length === 0) return { deposits: [], debt: [] };

  // 2. Fetch all statement snapshots for sparkline data
  const accountIds = accounts.map((a) => a.id);
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("statement_snapshots")
    .select("account_id, period_to, final_balance, created_at, remaining_balance")
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .order("period_to", { ascending: true });

  if (snapshotsError) throw snapshotsError;

  // 3. Group snapshots by account
  const snapshotsByAccount = new Map<string, SparklinePoint[]>();
  for (const snap of snapshots ?? []) {
    const key = snap.account_id;
    if (!snapshotsByAccount.has(key)) snapshotsByAccount.set(key, []);
    const balance = snap.final_balance ?? snap.remaining_balance ?? 0;
    snapshotsByAccount.get(key)!.push({
      date: snap.period_to ?? snap.created_at,
      balance,
    });
  }

  // 4. Build AccountWithSparkline for each account
  const isDebtType = (type: string) => type === "CREDIT_CARD" || type === "LOAN";

  const result: GroupedAccounts = { deposits: [], debt: [] };

  for (const account of accounts) {
    const points = snapshotsByAccount.get(account.id) ?? [];

    // Add current balance as last point
    points.push({ date: new Date().toISOString().slice(0, 10), balance: account.current_balance });

    // Compute change percent (current vs previous point)
    const prevBalance = points.length >= 2 ? points[points.length - 2].balance : account.current_balance;
    const changePercent = prevBalance !== 0
      ? ((account.current_balance - prevBalance) / Math.abs(prevBalance)) * 100
      : 0;

    // Credit utilization
    const utilization = account.account_type === "CREDIT_CARD" && account.credit_limit
      ? (Math.abs(account.current_balance) / account.credit_limit) * 100
      : null;

    // Installment progress for loans
    let installmentProgress: string | null = null;
    if (account.account_type === "LOAN" && account.loan_amount && account.monthly_payment) {
      const totalInstallments = Math.ceil(account.loan_amount / account.monthly_payment);
      const paidInstallments = points.length > 1 ? points.length - 1 : 0;
      installmentProgress = `${paidInstallments}/${totalInstallments}`;
    }

    const item: AccountWithSparkline = {
      id: account.id,
      name: account.name,
      account_type: account.account_type,
      current_balance: account.current_balance,
      currency_balances: account.currency_balances,
      credit_limit: account.credit_limit,
      currency_code: account.currency_code,
      updated_at: account.updated_at,
      color: account.color,
      interest_rate: account.interest_rate,
      monthly_payment: account.monthly_payment,
      loan_amount: account.loan_amount,
      sparkline: points,
      changePercent,
      utilization,
      installmentProgress,
    };

    if (isDebtType(account.account_type)) {
      result.debt.push(item);
    } else {
      result.deposits.push(item);
    }
  }

  return result;
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

/**
 * Expense breakdown by category for the given month (defaults to current).
 * Returns top categories sorted by total amount descending.
 */
export async function getCategorySpending(month?: string, currency?: CurrencyCode): Promise<CategorySpending[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  const isDemo = await getIsDemoFilter(user.id);
  return getCategorySpendingCached(accessToken, user.id, month, currency, isDemo);
}

/**
 * Monthly income vs expenses for the 6 months ending at the given month.
 */
export async function getMonthlyCashflow(month?: string, currency?: CurrencyCode): Promise<MonthlyCashflow[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  const isDemo = await getIsDemoFilter(user.id);
  return getMonthlyCashflowCached(accessToken, user.id, month, currency, isDemo);
}

/**
 * Daily spending (OUTFLOW) for the given month (defaults to current).
 */
export async function getDailySpending(month?: string, currency?: CurrencyCode): Promise<DailySpending[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  const isDemo = await getIsDemoFilter(user.id);
  return getDailySpendingCached(accessToken, user.id, month, currency, isDemo);
}

/**
 * Get total income and expenses for a given month.
 * Used for computing trend percentages vs previous period.
 */
export async function getMonthMetrics(month?: string, currency?: CurrencyCode): Promise<MonthMetrics> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { income: 0, expenses: 0 };
  const isDemo = await getIsDemoFilter(user.id);
  return getMonthMetricsCached(accessToken, user.id, month, currency, isDemo);
}

/**
 * Daily cashflow (income and expenses) for the given month.
 * Returns data for each day with both income and expenses.
 */
export async function getDailyCashflow(month?: string): Promise<DailyCashflow[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  const isDemo = await getIsDemoFilter(user.id);
  return getDailyCashflowCached(accessToken, user.id, month, isDemo);
}

export async function getAccountsWithSparklineData(): Promise<GroupedAccounts> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { deposits: [], debt: [] };
  const isDemo = await getIsDemoFilter(user.id);
  return getAccountsWithSparklineDataCached(accessToken, user.id, isDemo);
}

// --- Net Worth History ---

export interface NetWorthHistory {
  month: string;
  label: string;
  netWorth: number;
}

/**
 * Historical net worth over the past 6 months ending at the given month.
 * Calculates current net worth, then steps backward using historical net cashflow.
 * Calls getMonthlyCashflow (cached) + direct account queries — left uncached at top level.
 */
export async function getNetWorthHistory(month?: string, currency?: CurrencyCode): Promise<NetWorthHistory[]> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return [];

  const baseCurrency = currency ?? "COP";

  // 1. Get current active accounts balances to compute current net worth
  const isDemo = await getIsDemoFilter(user.id);
  const { data: accounts } = await supabase
    .from("accounts")
    .select("current_balance, available_balance, account_type, credit_limit, currency_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_demo", isDemo);

  // If no accounts, return early
  if (!accounts || accounts.length === 0) return [];

  const currencyAccounts = accounts.filter((a) => a.currency_code === baseCurrency);

  const totalAssets = currencyAccounts
    .filter((a) => a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN")
    .reduce((sum, a) => sum + a.current_balance, 0);

  const totalLiabilities = currencyAccounts
    .filter((a) => a.account_type === "CREDIT_CARD" || a.account_type === "LOAN")
    .reduce((sum, a) => sum + computeDebtBalance(a as Parameters<typeof computeDebtBalance>[0]), 0);

  const currentNetWorth = totalAssets - totalLiabilities;

  // 2. Get monthly cashflow for the last 6 months (cached)
  const cashflows = await getMonthlyCashflow(month, currency);

  if (cashflows.length === 0) {
    // If no transaction history, just return current net worth for current month
    const target = parseMonth(month);
    const monthStr = target.toISOString().substring(0, 7);
    return [
      {
        month: monthStr,
        label: formatDate(new Date(monthStr + "-15"), "MMM yyyy"),
        netWorth: currentNetWorth,
      },
    ];
  }

  // 3. Step backwards to reconstruct historical net worth
  // Cashflows are sorted chronologically (oldest first).
  // e.g., if we are in "2026-02", cashflows at the end might be "2026-02".
  // N_{current} = currentNetWorth.
  // For each month going backwards (n): N_{n-1} = N_n - NetCashflow_n.
  // This means the Net Worth AT THE START of month n (which is the end of n-1)
  // is the Net Worth at the end of month n MINUS the net cashflow that happened during month n.

  const result: NetWorthHistory[] = [];
  let runningNetWorth = currentNetWorth;

  // Iterate backwards from the most recent month
  for (let i = cashflows.length - 1; i >= 0; i--) {
    const cf = cashflows[i];
    result.push({
      month: cf.month,
      label: cf.label,
      netWorth: runningNetWorth,
    });
    // Step backwards to find the net worth before this month's cashflows occurred.
    // It becomes the running net worth for the end of the previous month.
    runningNetWorth -= cf.net;
  }

  // Ensure result is chronologically sorted (oldest first)
  return result.reverse();
}

// --- Dashboard Hero ---

export interface PendingObligation {
  id: string;
  name: string;
  amount: number;
  currency_code: string;
  due_date: string;
}

export interface DashboardHeroData {
  totalLiquid: number;
  pendingObligations: PendingObligation[];
  totalPending: number;
  availableToSpend: number;
  pendingIncome: number;
  pendingIncomeCount: number;
  monthlyIncome: number;
  monthlySpent: number;
  freshness: "fresh" | "stale" | "outdated";
  oldestUpdate: string | null;
  currency: string;
  hasOtherCurrencies: boolean;
  // Pay-cycle fields
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  nextIncomeName: string | null;
  daysUntilIncome: number;
  windowObligations: number;
  incomeConfigured: boolean;
}

export async function getDashboardHeroData(
  month?: string,
  currency?: CurrencyCode
): Promise<DashboardHeroData> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) {
    return {
      totalLiquid: 0,
      pendingObligations: [],
      totalPending: 0,
      availableToSpend: 0,
      pendingIncome: 0,
      pendingIncomeCount: 0,
      monthlyIncome: 0,
      monthlySpent: 0,
      freshness: "outdated",
      oldestUpdate: null,
      currency: "COP",
      hasOtherCurrencies: false,
      nextIncomeDate: null,
      nextIncomeAmount: 0,
      nextIncomeName: null,
      daysUntilIncome: 1,
      windowObligations: 0,
      incomeConfigured: false,
    };
  }

  const baseCurrency = currency ?? "COP";

  // Compute date strings before Promise.all (synchronous)
  const now = new Date();
  const colombiaToday = toColombiaDateString(now);
  const rangeEnd = toColombiaDateString(addDays(now, PAY_CYCLE_LOOKAHEAD_DAYS));

  // All 4 fetches in parallel — no sequential waterfall
  const [accountsResult, monthMetrics, nextIncome, pendingOccurrences] = await Promise.all([
    getAccounts(),
    getMonthMetrics(month, currency),
    getNextIncomeOccurrenceCached(user.id, colombiaToday, baseCurrency, accessToken).catch(() => null),
    getPendingOccurrencesCached(user.id, colombiaToday, rangeEnd, accessToken).catch(() => [] as never[]),
  ]);

  // 1. Process accounts
  const dashboardAccounts = accountsResult.success
    ? accountsResult.data.map((a) => ({
        id: a.id,
        name: a.name,
        account_type: a.account_type,
        current_balance: a.current_balance,
        currency_code: a.currency_code,
        updated_at: a.updated_at,
      }))
    : [];

  const currencyAccounts = dashboardAccounts.filter((a) => a.currency_code === baseCurrency);
  const liquidAccounts = currencyAccounts.filter(
    (account) => account.account_type !== "CREDIT_CARD" && account.account_type !== "LOAN"
  );
  const creditCardAccounts = currencyAccounts.filter(
    (account) => account.account_type === "CREDIT_CARD"
  );
  const trackedFreshnessAccounts = [...liquidAccounts, ...creditCardAccounts];
  const hasOtherCurrencies = dashboardAccounts.some((a) => a.currency_code !== baseCurrency);
  const totalLiquid = liquidAccounts.reduce(
    (sum, account) => sum + (account.current_balance ?? 0),
    0
  );

  // 2. Compute freshness
  const timestamps = trackedFreshnessAccounts.map((a) => a.updated_at).filter(Boolean);
  const oldestUpdate = timestamps.length > 0
    ? timestamps.sort()[0]
    : null;
  const freshness = getFreshnessLevel(oldestUpdate);

  // 3. Compute pay-cycle window
  const incomeConfigured = nextIncome !== null;
  let daysUntilIncome: number;
  let windowEndDate: string;

  if (nextIncome) {
    daysUntilIncome = nextIncome.daysUntil;
    windowEndDate = nextIncome.date;
  } else {
    const colombiaDay = getColombiaDayOfMonth(now);
    const [yearStr, monthStr] = colombiaToday.split("-");
    const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    daysUntilIncome = Math.max(daysInMonth - colombiaDay, 1);
    windowEndDate = `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;
  }

  // Filter cached occurrences to pay-cycle window + base currency
  const windowOccurrences = pendingOccurrences.filter(
    (o) => o.occurrence_date >= colombiaToday && o.occurrence_date <= windowEndDate && o.currency_code === baseCurrency
  );

  const recurringObligations: PendingObligation[] = windowOccurrences
    .filter((o) => o.direction === "OUTFLOW")
    .map((o) => ({
      id: o.id,
      name: o.merchant_name ?? o.description ?? "Recurrente",
      amount: o.expected_amount,
      currency_code: o.currency_code,
      due_date: o.occurrence_date,
    }));

  const windowObligationsTotal = windowOccurrences
    .filter((o) => o.direction === "OUTFLOW" && o.account_type !== "CREDIT_CARD")
    .reduce((sum, o) => sum + o.expected_amount, 0);

  // 4. Pending INFLOW occurrences within window (expected income, NOT added to availableToSpend)
  const pendingInflowOccurrences = windowOccurrences
    .filter((o) => o.direction === "INFLOW" && o.account_type !== "CREDIT_CARD" && o.account_type !== "LOAN");
  const pendingIncome = pendingInflowOccurrences.reduce((sum, o) => sum + o.expected_amount, 0);
  const pendingIncomeCount = pendingInflowOccurrences.length;

  // 5. Sort by due date
  const allObligations = recurringObligations.sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalPending = allObligations.reduce((sum, o) => sum + o.amount, 0);
  const availableToSpend = totalLiquid - windowObligationsTotal;

  return {
    totalLiquid,
    pendingObligations: allObligations,
    totalPending,
    availableToSpend,
    pendingIncome,
    pendingIncomeCount,
    monthlyIncome: monthMetrics.income,
    monthlySpent: monthMetrics.expenses,
    freshness,
    oldestUpdate,
    currency: baseCurrency,
    hasOtherCurrencies,
    nextIncomeDate: nextIncome?.date ?? null,
    nextIncomeAmount: nextIncome?.amount ?? 0,
    nextIncomeName: nextIncome?.name ?? null,
    daysUntilIncome,
    windowObligations: windowObligationsTotal,
    incomeConfigured,
  };
}

// --- Daily Budget Pace ---

export interface DailyBudgetPace {
  date: string;
  label: string;
  actualCumulative: number;
  idealCumulative: number;
  isToday: boolean;
}

export async function getDailyBudgetPace(
  month?: string,
  currency?: CurrencyCode
): Promise<{ data: DailyBudgetPace[]; totalBudget: number; totalSpent: number }> {
  const dailyData = await getDailySpending(month, currency);
  const { getBudgetSummary } = await import("@/actions/budgets");
  const budgetSummary = await getBudgetSummary(month);

  const totalBudget = budgetSummary.totalTarget;
  const todayStr = toColombiaDateString(new Date());
  // Derive daysInMonth from the month parameter or Colombia "today" to avoid
  // UTC mismatch at month boundaries (midnight-5AM UTC on the 1st).
  const refDate = month ?? todayStr.substring(0, 7);
  const [y, m] = refDate.split("-");
  const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
  const dailyIdeal = totalBudget / daysInMonth;
  let cumulativeActual = 0;

  const data: DailyBudgetPace[] = dailyData.map((d) => {
    cumulativeActual += d.amount;
    const dayOfMonth = new Date(d.date + "T12:00:00").getDate();
    return {
      date: d.date,
      label: d.label,
      actualCumulative: cumulativeActual,
      idealCumulative: dailyIdeal * dayOfMonth,
      isToday: d.date === todayStr,
    };
  });

  return { data, totalBudget, totalSpent: cumulativeActual };
}
