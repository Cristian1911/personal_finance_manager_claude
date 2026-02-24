import { ScrollView, RefreshControl, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useSync } from "../../lib/sync/hooks";
import { useAppStore } from "../../lib/store";
import { getAllAccounts } from "../../lib/repositories/accounts";
import { getTransactions } from "../../lib/repositories/transactions";
import { getAllCategories } from "../../lib/repositories/categories";
import { formatMonthLabel } from "@venti5/shared";
import { BalanceCard } from "../../components/dashboard/BalanceCard";
import { MonthSummary } from "../../components/dashboard/MonthSummary";
import {
  CategoryBreakdown,
  type CategorySpend,
} from "../../components/dashboard/CategoryBreakdown";

export default function DashboardScreen() {
  const { sync, status } = useSync();
  const { setAccounts, setTransactions, setCategories } = useAppStore();

  const [totalBalance, setTotalBalance] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [topCategories, setTopCategories] = useState<CategorySpend[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const loadData = useCallback(async () => {
    try {
      const [accounts, transactions, categories] = await Promise.all([
        getAllAccounts(),
        getTransactions({ month: currentMonth, limit: 500 }),
        getAllCategories(),
      ]);

      // Update store
      setAccounts(accounts as any[]);
      setTransactions(transactions as any[]);
      setCategories(categories as any[]);

      // Compute total balance
      const balance = (accounts as any[]).reduce(
        (sum: number, a: any) => sum + (a.current_balance ?? 0),
        0
      );
      setTotalBalance(balance);
      setAccountCount((accounts as any[]).length);

      // Compute monthly income and expenses
      let income = 0;
      let expenses = 0;
      const categoryMap = new Map<
        string | null,
        { name_es: string | null; color: string | null; total: number }
      >();

      for (const t of transactions as any[]) {
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
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#10B981"
        />
      }
    >
      {/* Month label */}
      <View className="px-4 pt-4">
        <Text className="text-gray-500 font-inter-medium text-sm capitalize">
          {formatMonthLabel(new Date())}
        </Text>
      </View>

      <BalanceCard totalBalance={totalBalance} accountCount={accountCount} />

      <MonthSummary income={monthIncome} expenses={monthExpenses} />

      <CategoryBreakdown categories={topCategories} />
    </ScrollView>
  );
}
