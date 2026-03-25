"use server";

import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatDate,
  parseMonth,
  monthStartStr,
  monthEndStr,
  monthsBeforeStart,
} from "@/lib/utils/date";
import { computeDebtBalance } from "@zeta/shared";
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
  userId: string,
  month: string | undefined,
  currency: CurrencyCode | undefined
): Promise<CategorySpending[]> {
  "use cache";
  cacheTag("dashboard:charts");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const target = parseMonth(month);

  // Fetch transactions and budgets in parallel
  const [txRes, budgetsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, category_id, categories!category_id(name_es, name, color, expense_type)")
      .eq("user_id", userId)
      .eq("direction", "OUTFLOW")
      .eq("is_excluded", false)
      .eq("currency_code", currency ?? "COP")
      .gte("transaction_date", monthStartStr(target))
      .lte("transaction_date", monthEndStr(target))
      .is("reconciled_into_transaction_id", null),

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
  userId: string,
  month: string | undefined,
  currency: CurrencyCode | undefined
): Promise<MonthlyCashflow[]> {
  "use cache";
  cacheTag("dashboard:cashflow");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const target = parseMonth(month);

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("transaction_date, amount, direction, accounts!account_id(account_type)")
    .eq("user_id", userId)
    .eq("is_excluded", false)
    .eq("currency_code", currency ?? "COP")
    .gte("transaction_date", monthsBeforeStart(target, 5))
    .lte("transaction_date", monthEndStr(target))
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null);

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
  userId: string,
  month: string | undefined,
  currency: CurrencyCode | undefined
): Promise<DailySpending[]> {
  "use cache";
  cacheTag("dashboard:charts");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const target = parseMonth(month);

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("transaction_date, amount")
    .eq("user_id", userId)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .eq("currency_code", currency ?? "COP")
    .gte("transaction_date", monthStartStr(target))
    .lte("transaction_date", monthEndStr(target))
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null);

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
  userId: string,
  month: string | undefined
): Promise<MonthMetrics> {
  "use cache";
  cacheTag("dashboard:charts");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const target = parseMonth(month);

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("amount, direction, accounts!account_id(account_type)")
    .eq("user_id", userId)
    .eq("is_excluded", false)
    .gte("transaction_date", monthStartStr(target))
    .lte("transaction_date", monthEndStr(target))
    .is("reconciled_into_transaction_id", null);

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
  userId: string,
  month: string | undefined
): Promise<DailyCashflow[]> {
  "use cache";
  cacheTag("dashboard:cashflow");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const target = parseMonth(month);
  const startStr = monthStartStr(target);
  const endStr = monthEndStr(target);

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("transaction_date, amount, direction, accounts!account_id(account_type)")
    .eq("user_id", userId)
    .eq("is_excluded", false)
    .gte("transaction_date", startStr)
    .lte("transaction_date", endStr)
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null);

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
  userId: string
): Promise<GroupedAccounts> {
  "use cache";
  cacheTag("accounts");
  cacheTag("dashboard:accounts");
  cacheLife("zeta");

  const supabase = createAdminClient();

  // 1. Fetch active accounts marked for dashboard
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
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

async function getDashboardAccountsCached(userId: string): Promise<{
  liquidAccounts: { id: string; name: string; current_balance: number; currency_code: string; updated_at: string }[];
  allActiveAccounts: { currency_code: string }[];
}> {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");

  const supabase = createAdminClient();

  const [{ data: liquidAccounts, error: liquidError }, { data: allActiveAccounts, error: allError }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, current_balance, currency_code, updated_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .not("account_type", "in", '("CREDIT_CARD","LOAN")'),
      supabase
        .from("accounts")
        .select("currency_code")
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

  if (liquidError) throw liquidError;
  if (allError) throw allError;

  return {
    liquidAccounts: liquidAccounts ?? [],
    allActiveAccounts: allActiveAccounts ?? [],
  };
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

/**
 * Expense breakdown by category for the given month (defaults to current).
 * Returns top categories sorted by total amount descending.
 */
export async function getCategorySpending(month?: string, currency?: CurrencyCode): Promise<CategorySpending[]> {
  const { user } = await getAuthenticatedClient();
  if (!user) return [];
  return getCategorySpendingCached(user.id, month, currency);
}

/**
 * Monthly income vs expenses for the 6 months ending at the given month.
 */
export async function getMonthlyCashflow(month?: string, currency?: CurrencyCode): Promise<MonthlyCashflow[]> {
  const { user } = await getAuthenticatedClient();
  if (!user) return [];
  return getMonthlyCashflowCached(user.id, month, currency);
}

/**
 * Daily spending (OUTFLOW) for the given month (defaults to current).
 */
export async function getDailySpending(month?: string, currency?: CurrencyCode): Promise<DailySpending[]> {
  const { user } = await getAuthenticatedClient();
  if (!user) return [];
  return getDailySpendingCached(user.id, month, currency);
}

/**
 * Get total income and expenses for a given month.
 * Used for computing trend percentages vs previous period.
 */
export async function getMonthMetrics(month?: string): Promise<MonthMetrics> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { income: 0, expenses: 0 };
  return getMonthMetricsCached(user.id, month);
}

/**
 * Daily cashflow (income and expenses) for the given month.
 * Returns data for each day with both income and expenses.
 */
export async function getDailyCashflow(month?: string): Promise<DailyCashflow[]> {
  const { user } = await getAuthenticatedClient();
  if (!user) return [];
  return getDailyCashflowCached(user.id, month);
}

export async function getAccountsWithSparklineData(): Promise<GroupedAccounts> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { deposits: [], debt: [] };
  return getAccountsWithSparklineDataCached(user.id);
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
  const { data: accounts } = await supabase
    .from("accounts")
    .select("current_balance, available_balance, account_type, credit_limit, currency_code")
    .eq("user_id", user.id)
    .eq("is_active", true);

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
  source: "recurring" | "statement";
}

export interface DashboardHeroData {
  totalLiquid: number;
  pendingObligations: PendingObligation[];
  totalPending: number;
  availableToSpend: number;
  freshness: "fresh" | "stale" | "outdated";
  oldestUpdate: string | null;
  currency: string;
  hasOtherCurrencies: boolean;
}

export async function getDashboardHeroData(
  month?: string,
  currency?: CurrencyCode
): Promise<DashboardHeroData> {
  const { user } = await getAuthenticatedClient();
  if (!user) {
    return {
      totalLiquid: 0,
      pendingObligations: [],
      totalPending: 0,
      availableToSpend: 0,
      freshness: "outdated",
      oldestUpdate: null,
      currency: "COP",
      hasOtherCurrencies: false,
    };
  }

  const baseCurrency = currency ?? "COP";

  // 1. Get liquid accounts + all active accounts for currency detection (cached)
  const { liquidAccounts: accounts, allActiveAccounts } = await getDashboardAccountsCached(user.id);

  const currencyAccounts = accounts.filter((a) => a.currency_code === baseCurrency);
  const hasOtherCurrencies = allActiveAccounts.some((a) => a.currency_code !== baseCurrency);
  const totalLiquid = currencyAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  // 2. Compute freshness from oldest updated_at among liquid accounts
  const { getFreshnessLevel } = await import("@/lib/utils/dashboard");
  const timestamps = currencyAccounts.map((a) => a.updated_at).filter(Boolean);
  const oldestUpdate = timestamps.length > 0
    ? timestamps.sort()[0]
    : null;
  const freshness = getFreshnessLevel(oldestUpdate);

  // 3. Get pending obligations from upcoming recurring (OUTFLOW only)
  const { getUpcomingRecurrences } = await import("@/actions/recurring-templates");
  const upcomingRecurrences = await getUpcomingRecurrences(30);
  const recurringObligations: PendingObligation[] = upcomingRecurrences
    .filter((r) => r.template.direction === "OUTFLOW" && (r.template.currency_code ?? "COP") === baseCurrency)
    .map((r) => ({
      id: r.template.id,
      name: r.template.merchant_name ?? "Recurrente",
      amount: r.template.amount,
      currency_code: r.template.currency_code ?? "COP",
      due_date: r.next_date,
      source: "recurring" as const,
    }));

  // 4. Get pending obligations from statement payment due dates
  const { getUpcomingPayments } = await import("@/actions/payment-reminders");
  const statementPayments = await getUpcomingPayments();
  const statementObligations: PendingObligation[] = statementPayments
    .filter((p) => p.currency_code === baseCurrency)
    .map((p) => ({
      id: p.id,
      name: p.account_name,
      amount: p.total_payment_due,
      currency_code: p.currency_code,
      due_date: p.payment_due_date,
      source: "statement" as const,
    }));

  // 5. Merge and sort by due date
  const allObligations = [...recurringObligations, ...statementObligations]
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalPending = allObligations.reduce((sum, o) => sum + o.amount, 0);
  const availableToSpend = totalLiquid - totalPending;
  return {
    totalLiquid,
    pendingObligations: allObligations,
    totalPending,
    availableToSpend,
    freshness,
    oldestUpdate,
    currency: baseCurrency,
    hasOtherCurrencies,
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
  const target = parseMonth(month);
  const dailyData = await getDailySpending(month, currency);
  const { getBudgetSummary } = await import("@/actions/budgets");
  const budgetSummary = await getBudgetSummary(month);

  const totalBudget = budgetSummary.totalTarget;
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const dailyIdeal = totalBudget / daysInMonth;

  const todayStr = new Date().toISOString().slice(0, 10);
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
