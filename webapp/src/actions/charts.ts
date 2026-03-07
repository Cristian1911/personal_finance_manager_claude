"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserSafely } from "@/lib/supabase/auth";
import {
  formatDate,
  parseMonth,
  monthStartStr,
  monthEndStr,
  monthsBeforeStart,
} from "@/lib/utils/date";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";

// --- Types ---

export interface CategorySpending {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
  count: number;
  percentage: number;
  budgetTarget?: number;
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

// --- Server Actions ---

/**
 * Expense breakdown by category for the given month (defaults to current).
 * Returns top categories sorted by total amount descending.
 */
export async function getCategorySpending(month?: string): Promise<CategorySpending[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const target = parseMonth(month);

  // Fetch transactions and budgets in parallel
  const [txRes, budgetsRes] = await Promise.all([
    executeVisibleTransactionQuery(() =>
      supabase
      .from("transactions")
      .select("amount, category_id, categories!category_id(name_es, name, color)")
      .eq("direction", "OUTFLOW")
      .eq("is_excluded", false)
      .gte("transaction_date", monthStartStr(target))
      .lte("transaction_date", monthEndStr(target))
    ),

    supabase
      .from("budgets")
      .select("category_id, amount")
  ]);

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
    { name: string; color: string; amount: number; count: number; categoryId: string | null; budgetTarget?: number }
  >();
  let total = 0;

  for (const tx of transactions) {
    const id = tx.category_id ?? "uncategorized";
    const cat = tx.categories as { name_es: string | null; name: string; color: string } | null;

    if (!map.has(id)) {
      map.set(id, {
        categoryId: tx.category_id,
        name: cat?.name_es ?? cat?.name ?? "Sin categoría",
        color: cat?.color ?? "#94a3b8",
        amount: 0,
        count: 0,
        budgetTarget: tx.category_id ? budgetMap.get(tx.category_id) : undefined,
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

/**
 * Monthly income vs expenses for the 6 months ending at the given month.
 */
export async function getMonthlyCashflow(month?: string): Promise<MonthlyCashflow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const target = parseMonth(month);
  const { data: transactions } = await executeVisibleTransactionQuery(() =>
    supabase
    .from("transactions")
    .select("transaction_date, amount, direction, accounts!account_id(account_type)")
    .eq("is_excluded", false)
    .gte("transaction_date", monthsBeforeStart(target, 5))
    .lte("transaction_date", monthEndStr(target))
    .order("transaction_date")
  );

  if (!transactions || transactions.length === 0) return [];

  const map = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions) {
    const month = tx.transaction_date.substring(0, 7); // "2026-02"

    if (!map.has(month)) {
      map.set(month, { income: 0, expenses: 0 });
    }

    const entry = map.get(month)!;
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
    .map(([month, data]) => ({
      month,
      label: formatDate(new Date(month + "-15"), "MMM yyyy"),
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Daily spending (OUTFLOW) for the given month (defaults to current).
 */
export async function getDailySpending(month?: string): Promise<DailySpending[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const target = parseMonth(month);
  const { data: transactions } = await executeVisibleTransactionQuery(() =>
    supabase
    .from("transactions")
    .select("transaction_date, amount")
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .gte("transaction_date", monthStartStr(target))
    .lte("transaction_date", monthEndStr(target))
    .order("transaction_date")
  );

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

/**
 * Get total income and expenses for a given month.
 * Used for computing trend percentages vs previous period.
 */
export async function getMonthMetrics(month?: string): Promise<MonthMetrics> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { income: 0, expenses: 0 };

  const target = parseMonth(month);
  const { data: transactions } = await executeVisibleTransactionQuery(() =>
    supabase
    .from("transactions")
    .select("amount, direction, accounts!account_id(account_type)")
    .eq("is_excluded", false)
    .gte("transaction_date", monthStartStr(target))
    .lte("transaction_date", monthEndStr(target))
  );

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

/**
 * Daily cashflow (income and expenses) for the given month.
 * Returns data for each day with both income and expenses.
 */
export async function getDailyCashflow(month?: string): Promise<DailyCashflow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const target = parseMonth(month);
  const startStr = monthStartStr(target);
  const endStr = monthEndStr(target);

  const { data: transactions } = await executeVisibleTransactionQuery(() =>
    supabase
    .from("transactions")
    .select("transaction_date, amount, direction, accounts!account_id(account_type)")
    .eq("is_excluded", false)
    .gte("transaction_date", startStr)
    .lte("transaction_date", endStr)
    .order("transaction_date")
  );

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

export interface NetWorthHistory {
  month: string;
  label: string;
  netWorth: number;
}

/**
 * Historical net worth over the past 6 months ending at the given month.
 * Calculates current net worth, then steps backward using historical net cashflow.
 */
export async function getNetWorthHistory(month?: string): Promise<NetWorthHistory[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // 1. Get current active accounts balances to compute current net worth
  const { data: accounts } = await supabase
    .from("accounts")
    .select("current_balance, account_type, credit_limit")
    .eq("is_active", true);

  // If no accounts, return early
  if (!accounts || accounts.length === 0) return [];

  const totalAssets = accounts
    .filter((a) => a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN")
    .reduce((sum, a) => sum + a.current_balance, 0);

  const totalLiabilities = accounts
    .filter((a) => a.account_type === "CREDIT_CARD" || a.account_type === "LOAN")
    .reduce((sum, a) => {
      // Logic from `computeDebtBalance` proxy
      if (a.account_type === "CREDIT_CARD" && a.credit_limit) {
        return sum + Math.max(0, a.credit_limit - a.current_balance);
      }
      return sum + Math.abs(a.current_balance);
    }, 0);

  const currentNetWorth = totalAssets - totalLiabilities;

  // 2. Get monthly cashflow for the last 6 months
  const cashflows = await getMonthlyCashflow(month);

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
}

export async function getDashboardHeroData(
  month?: string
): Promise<DashboardHeroData> {
  const supabase = await createClient();
  const user = await getUserSafely(supabase);
  if (!user) {
    return {
      totalLiquid: 0,
      pendingObligations: [],
      totalPending: 0,
      availableToSpend: 0,
      freshness: "outdated",
      oldestUpdate: null,
      currency: "COP",
    };
  }

  // 1. Get liquid accounts (not credit card, not loan)
  const { data: liquidAccounts } = await supabase
    .from("accounts")
    .select("id, name, current_balance, currency_code, updated_at")
    .eq("is_active", true)
    .not("account_type", "in", '("CREDIT_CARD","LOAN")');

  const accounts = liquidAccounts ?? [];
  const totalLiquid = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  // 2. Compute freshness from oldest updated_at among liquid accounts
  const { getFreshnessLevel } = await import("@/lib/utils/dashboard");
  const timestamps = accounts.map((a) => a.updated_at).filter(Boolean);
  const oldestUpdate = timestamps.length > 0
    ? timestamps.sort()[0]
    : null;
  const freshness = getFreshnessLevel(oldestUpdate);

  // 3. Get pending obligations from upcoming recurring (OUTFLOW only)
  const { getUpcomingRecurrences } = await import("@/actions/recurring-templates");
  const upcomingRecurrences = await getUpcomingRecurrences(30);
  const recurringObligations: PendingObligation[] = upcomingRecurrences
    .filter((r) => r.template.direction === "OUTFLOW")
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
  const statementObligations: PendingObligation[] = statementPayments.map((p) => ({
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
  const currency = accounts[0]?.currency_code ?? "COP";

  return {
    totalLiquid,
    pendingObligations: allObligations,
    totalPending,
    availableToSpend,
    freshness,
    oldestUpdate,
    currency,
  };
}
