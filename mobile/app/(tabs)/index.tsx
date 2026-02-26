import { ScrollView, RefreshControl, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { Account, Category, Transaction } from "@venti5/shared";
import { useSync } from "../../lib/sync/hooks";
import { useAppStore } from "../../lib/store";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { getTransactions } from "../../lib/repositories/transactions";
import {
  getAllCategories,
  type CategoryRow,
} from "../../lib/repositories/categories";
import { BalanceCard } from "../../components/dashboard/BalanceCard";
import { MonthSummary } from "../../components/dashboard/MonthSummary";
import {
  CategoryBreakdown,
  type CategorySpend,
} from "../../components/dashboard/CategoryBreakdown";
import { MonthSelector } from "../../components/common/MonthSelector";

export default function DashboardScreen() {
  const { sync, status } = useSync();
  const { setAccounts, setTransactions, setCategories } = useAppStore();

  const [totalBalance, setTotalBalance] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [topCategories, setTopCategories] = useState<CategorySpend[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date().toISOString().slice(0, 7) // "YYYY-MM"
  );

  type TransactionListRow = {
    id: string;
    user_id: string;
    account_id: string;
    category_id: string | null;
    amount: number;
    direction: string;
    description: string | null;
    merchant_name: string | null;
    raw_description: string | null;
    transaction_date: string;
    post_date: string | null;
    status: string;
    idempotency_key: string | null;
    is_excluded: number | boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
    category_name_es: string | null;
    category_color: string | null;
  };

  const toDomainAccount = (row: AccountRow): Account => ({
    ...row,
    account_type: row.account_type as Account["account_type"],
    currency_code: row.currency_code as Account["currency_code"],
    is_active: row.is_active === 1,
    connection_status: "DISCONNECTED",
    provider: "MANUAL",
    currency_balances: null,
    display_order: 0,
    expected_return_rate: null,
    initial_investment: null,
    last_synced_at: null,
    loan_amount: null,
    loan_end_date: null,
    loan_start_date: null,
    mask: null,
    maturity_date: null,
    monthly_payment: null,
    provider_account_id: null,
  });

  const toDomainTransaction = (row: TransactionListRow): Transaction => ({
    ...row,
    is_excluded: row.is_excluded === 1 || row.is_excluded === true,
    direction: row.direction as Transaction["direction"],
    status: row.status as Transaction["status"],
    posting_date: row.post_date,
    currency_code: "COP",
    exchange_rate: 1,
    idempotency_key: row.idempotency_key ?? "",
    categorization_confidence: null,
    categorization_source: "USER_CREATED",
    clean_description: null,
    amount_in_base_currency: null,
    installment_current: null,
    installment_group_id: null,
    installment_total: null,
    is_recurring: false,
    is_subscription: false,
    merchant_category_code: null,
    merchant_logo_url: null,
    provider: "MANUAL",
    provider_transaction_id: null,
    recurrence_group_id: null,
    secondary_category_id: null,
    tags: null,
  });

  const toDomainCategory = (row: CategoryRow): Category => ({
    ...row,
    is_system: row.is_system === 1,
    direction: null,
    is_active: true,
    is_essential: false,
    slug: row.name.toLowerCase().replace(/\s+/g, "-"),
    updated_at: row.created_at,
    icon: row.icon ?? "Tag",
    color: row.color ?? "#9CA3AF",
    name_es: row.name_es ?? row.name,
  });

  const loadData = useCallback(async () => {
    try {
      const [accounts, transactions, categories] = await Promise.all([
        getAllAccounts(),
        getTransactions({ month: currentMonth, limit: 500 }),
        getAllCategories(),
      ]);
      const transactionRows = transactions as TransactionListRow[];

      const domainAccounts = accounts.map(toDomainAccount);
      const domainTransactions = transactionRows.map(toDomainTransaction);
      const domainCategories = categories.map(toDomainCategory);

      // Update store
      setAccounts(domainAccounts);
      setTransactions(domainTransactions);
      setCategories(domainCategories);

      // Compute total balance
      const balance = domainAccounts.reduce(
        (sum, account) => sum + (account.current_balance ?? 0),
        0
      );
      setTotalBalance(balance);
      setAccountCount(domainAccounts.length);

      // Compute monthly income and expenses
      let income = 0;
      let expenses = 0;
      const categoryMap = new Map<
        string | null,
        { name_es: string | null; color: string | null; total: number }
      >();

      for (const t of transactionRows) {
        if (t.is_excluded) continue;
        const amount = Math.abs(t.amount ?? 0);
        if (t.direction === "INFLOW") {
          income += amount;
        } else {
          expenses += amount;
          // Group by category for breakdown
          const key = t.category_id ?? null;
          const existing = categoryMap.get(key);
          if (existing) {
            existing.total += amount;
          } else {
            categoryMap.set(key, {
              name_es: t.category_name_es ?? null,
              color: t.category_color ?? null,
              total: amount,
            });
          }
        }
      }

      setMonthIncome(income);
      setMonthExpenses(expenses);

      // Top 5 categories
      const sorted = Array.from(categoryMap.entries())
        .map(([id, data]) => ({
          category_id: id,
          category_name_es: data.name_es,
          category_color: data.color,
          total: data.total,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setTopCategories(sorted);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  }, [currentMonth]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  return (
    <ScrollView
      className="flex-1 bg-gray-100"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#047857"
        />
      }
    >
      {/* Month label */}
      <View className="px-4 pt-4">
        <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
      </View>

      <BalanceCard totalBalance={totalBalance} accountCount={accountCount} />

      <MonthSummary income={monthIncome} expenses={monthExpenses} />

      <CategoryBreakdown categories={topCategories} />
    </ScrollView>
  );
}
