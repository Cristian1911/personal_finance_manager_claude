import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { formatCurrency, type Account, type Category, type CurrencyCode, type Transaction } from "@venti5/shared";
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
import { FloatingCaptureButton } from "../../components/common/FloatingCaptureButton";

export default function DashboardScreen() {
  const router = useRouter();
  const { sync, status } = useSync();
  const { setAccounts, setTransactions, setCategories } = useAppStore();

  const [totalBalance, setTotalBalance] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [topCategories, setTopCategories] = useState<CategorySpend[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
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
    currency_code: string;
    provider: string;
    capture_method: string;
    capture_input_text: string | null;
    reconciled_into_transaction_id: string | null;
    reconciliation_score: number | null;
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
    currency_code: (row.currency_code as Transaction["currency_code"]) ?? "COP",
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
    provider: row.provider as Transaction["provider"],
    provider_transaction_id: null,
    recurrence_group_id: null,
    secondary_category_id: null,
    tags: null,
    capture_method: row.capture_method as Transaction["capture_method"],
    capture_input_text: row.capture_input_text,
    reconciled_into_transaction_id: row.reconciled_into_transaction_id,
    reconciliation_score: row.reconciliation_score,
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
      setAccountRows(accounts);

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

  const upcomingPayments = useMemo(() => {
    const today = new Date();
    return accountRows
      .filter((account) => account.is_active === 1 && account.payment_day)
      .map((account) => {
        const dueDate = new Date(today.getFullYear(), today.getMonth(), account.payment_day ?? 1);
        if (dueDate < today) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
        const diffDays = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: account.id,
          name: account.name,
          dueDate,
          diffDays,
          currency: (account.currency_code as CurrencyCode) ?? "COP",
          balance: account.current_balance,
        };
      })
      .filter((item) => item.diffDays >= 0 && item.diffDays <= 21)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 3);
  }, [accountRows]);

  const monthPacingCopy = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = currentMonth === today.toISOString().slice(0, 7);
    if (!isCurrentMonth) return null;

    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const elapsedPct = Math.round((dayOfMonth / daysInMonth) * 100);
    return `Vas en ${elapsedPct}% del mes y has gastado ${formatCurrency(monthExpenses)}.`;
  }, [currentMonth, monthExpenses]);

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#047857"
          />
        }
      >
        <View className="px-4 pt-4">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>

        <BalanceCard totalBalance={totalBalance} accountCount={accountCount} />

        <View className="mx-4 mt-4 rounded-lg bg-white p-4 shadow-sm">
          <Text className="text-sm font-inter-semibold text-gray-900">
            Acciones rápidas
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => router.push("/capture" as any)}
              className="flex-1 rounded-xl bg-primary px-4 py-3 active:bg-emerald-700"
            >
              <Text className="text-center font-inter-semibold text-white">
                Registrar gasto
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/import")}
              className="flex-1 rounded-xl bg-gray-900 px-4 py-3 active:bg-gray-700"
            >
              <Text className="text-center font-inter-semibold text-white">
                Importar extracto
              </Text>
            </Pressable>
          </View>
          <Text className="mt-3 text-xs font-inter text-gray-500">
            Mantén el mes vivo registrando movimientos antes del extracto.
          </Text>
        </View>

        <View className="mx-4 mt-4 rounded-lg bg-white p-4 shadow-sm">
          <Text className="text-sm font-inter-semibold text-gray-900">
            Próximos pagos
          </Text>
          {upcomingPayments.length === 0 ? (
            <Text className="mt-2 text-xs font-inter text-gray-500">
              No hay vencimientos cercanos registrados.
            </Text>
          ) : (
            <View className="mt-3 gap-3">
              {upcomingPayments.map((payment) => (
                <View
                  key={payment.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-inter-semibold text-sm text-gray-900">
                      {payment.name}
                    </Text>
                    <Text className="font-inter-medium text-xs text-amber-700">
                      {payment.diffDays === 0
                        ? "Vence hoy"
                        : `Vence en ${payment.diffDays} días`}
                    </Text>
                  </View>
                  <Text className="mt-1 text-xs font-inter text-gray-500">
                    Saldo o referencia: {formatCurrency(Math.abs(payment.balance ?? 0), payment.currency)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {monthPacingCopy ? (
            <Text className="mt-3 text-xs font-inter text-gray-500">
              {monthPacingCopy}
            </Text>
          ) : null}
        </View>

        <MonthSummary income={monthIncome} expenses={monthExpenses} />

        <CategoryBreakdown categories={topCategories} />
      </ScrollView>
      <FloatingCaptureButton />
    </View>
  );
}
