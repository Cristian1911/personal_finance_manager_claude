import { View, ScrollView, RefreshControl } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { getTransactions } from "../../lib/repositories/transactions";
import { DEBT_ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { computeCashflow } from "../../lib/utils/cashflow";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { useExpandableZone } from "../ui/useExpandableZone";
import { InicioHero } from "./InicioHero";
import { InicioMetricsGrid } from "./InicioMetricsGrid";
import { InicioAccountsHub } from "./InicioAccountsHub";
import { InicioAttention } from "./InicioAttention";
import { InicioActivity, type RecentTransaction } from "./InicioActivity";
import type { AttentionPayment } from "./InicioAttention";

interface DashboardState {
  hero: {
    availablePerDay: number;
    availableTotal: number;
    daysRemaining: number;
    breakdown: { totalLiquid: number; fixedExpenses: number; alreadySpent: number };
  };
  metrics: {
    daysInMonth: number;
    dayOfMonth: number;
    spentToday: number;
    spentYesterday: number;
    avgLast7: number;
  };
  accounts: { count: number; netWorth: number };
  upcomingPayments: AttentionPayment[];
  recentTransactions: RecentTransaction[];
}

const INITIAL_STATE: DashboardState = {
  hero: { availablePerDay: 0, availableTotal: 0, daysRemaining: 0, breakdown: { totalLiquid: 0, fixedExpenses: 0, alreadySpent: 0 } },
  metrics: { daysInMonth: 30, dayOfMonth: 1, spentToday: 0, spentYesterday: 0, avgLast7: 0 },
  accounts: { count: 0, netWorth: 0 },
  upcomingPayments: [],
  recentTransactions: [],
};

export function InicioRoot() {
  const { sync } = useSync();
  const { activeZone, toggle } = useExpandableZone<string>();

  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardState>(INITIAL_STATE);

  const currency: CurrencyCode = "COP";

  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7);
      const today = now.toISOString().slice(0, 10);
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysRemaining = daysInMonth - dayOfMonth;

      const [accounts, transactions] = await Promise.all([
        getAllAccounts(),
        getTransactions({ month: currentMonth, limit: 500 }),
      ]);

      const txRows = transactions as any[];

      // Build lookup map once
      const accountMap = new Map(accounts.map((a: AccountRow) => [a.id, a]));

      // Net worth
      const netWorth = accounts.reduce((sum: number, a: AccountRow) => {
        return DEBT_ACCOUNT_TYPES.has(a.account_type) ? sum - a.current_balance : sum + a.current_balance;
      }, 0);

      // Single-pass cashflow + daily metrics
      const { totalInflow, totalOutflow } = computeCashflow(txRows, accounts);

      let spentToday = 0;
      let spentYesterday = 0;
      let last7Total = 0;

      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

      for (const tx of txRows) {
        if (tx.is_excluded || tx.direction !== "OUTFLOW") continue;
        const amount = Math.abs(tx.amount ?? 0);
        if (tx.transaction_date === today) spentToday += amount;
        if (tx.transaction_date === yesterdayStr) spentYesterday += amount;
        const txDate = new Date(tx.transaction_date);
        const diffDays = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) last7Total += amount;
      }

      const avgLast7 = last7Total / 7;
      const availableTotal = Math.max(0, totalInflow - totalOutflow);
      const availablePerDay = daysRemaining > 0 ? Math.round(availableTotal / daysRemaining) : availableTotal;

      // Upcoming payments
      const payments: AttentionPayment[] = accounts
        .filter((a: AccountRow) => a.is_active === 1 && a.payment_day)
        .map((a: AccountRow) => {
          const dueDate = new Date(now.getFullYear(), now.getMonth(), a.payment_day ?? 1);
          if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
          const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return { name: a.name, amount: Math.abs(a.current_balance), daysUntil, accountName: a.name };
        })
        .filter((p) => p.daysUntil >= 0 && p.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil);

      // Recent transactions — use accountMap for O(1) lookup
      const recent: RecentTransaction[] = txRows
        .filter((tx: any) => !tx.is_excluded && !tx.reconciled_into_transaction_id)
        .slice(0, 10)
        .map((tx: any) => {
          const acct = accountMap.get(tx.account_id);
          return {
            id: tx.id,
            description: tx.merchant_name ?? tx.description ?? "Sin descripcion",
            amount: Math.abs(tx.amount),
            currency_code: tx.currency_code ?? "COP",
            direction: tx.direction as "INFLOW" | "OUTFLOW",
            account_name: acct?.name ?? "",
            account_color: acct?.color ?? null,
            category_name_es: tx.category_name_es ?? null,
            category_icon: tx.category_icon ?? null,
          };
        });

      // Single setState — one render
      setData({
        hero: {
          availablePerDay, availableTotal, daysRemaining,
          breakdown: { totalLiquid: totalInflow, fixedExpenses: 0, alreadySpent: totalOutflow },
        },
        metrics: { daysInMonth, dayOfMonth, spentToday, spentYesterday, avgLast7 },
        accounts: { count: accounts.length, netWorth },
        upcomingPayments: payments,
        recentTransactions: recent,
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  }, []);

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
    <View className="flex-1 bg-background">
      <MobileHeader variant="main" title="Inicio" right={<AvatarMenuTrigger />} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brass} />
        }
      >
        <InicioHero
          availablePerDay={data.hero.availablePerDay}
          availableTotal={data.hero.availableTotal}
          daysRemaining={data.hero.daysRemaining}
          currency={currency}
          breakdown={data.hero.breakdown}
          expanded={activeZone === "hero"}
          onToggle={() => toggle("hero")}
        />
        <InicioMetricsGrid
          daysInMonth={data.metrics.daysInMonth}
          dayOfMonth={data.metrics.dayOfMonth}
          spentToday={data.metrics.spentToday}
          spentYesterday={data.metrics.spentYesterday}
          avgLast7={data.metrics.avgLast7}
          currency={currency}
          expanded={activeZone}
          onToggle={toggle}
        />
        <InicioAccountsHub
          accountCount={data.accounts.count}
          netWorth={data.accounts.netWorth}
          currency={currency}
        />
        <InicioAttention
          overdueReminders={[]}
          upcomingPayments={data.upcomingPayments}
          currency={currency}
          expanded={activeZone}
          onToggle={toggle}
        />
        <InicioActivity transactions={data.recentTransactions} />
      </ScrollView>
    </View>
  );
}
