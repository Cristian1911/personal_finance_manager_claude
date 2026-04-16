import { View, ScrollView, RefreshControl } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { formatDate, type CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { getTransactions } from "../../lib/repositories/transactions";
import { getPendingOccurrences, type OccurrenceWithTemplate } from "../../lib/repositories/recurring";
import { DEBT_ACCOUNT_TYPES, isDebtAccountType, LIQUID_ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { toLocalDateString, toLocalMonthString } from "../../lib/utils/date";
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
    daysLabel: string;
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
  hero: { availablePerDay: 0, availableTotal: 0, daysRemaining: 0, daysLabel: "", breakdown: { totalLiquid: 0, fixedExpenses: 0, alreadySpent: 0 } },
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
      const currentMonth = toLocalMonthString(now);
      const today = toLocalDateString(now);
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      const [accounts, transactions, pendingOccs] = await Promise.all([
        getAllAccounts(),
        getTransactions({ month: currentMonth, limit: 500 }),
        getPendingOccurrences(),
      ]);

      const txRows = transactions as any[];
      const accountMap = new Map(accounts.map((a: AccountRow) => [a.id, a]));

      // ── Liquid balance (CHECKING + SAVINGS only, matching webapp) ──
      const liquidBalance = accounts
        .filter((a: AccountRow) => LIQUID_ACCOUNT_TYPES.has(a.account_type))
        .reduce((sum: number, a: AccountRow) => sum + a.current_balance, 0);

      // ── Next income occurrence ──
      const nextIncome = pendingOccs.find(
        (o: OccurrenceWithTemplate) =>
          o.direction === "INFLOW" &&
          !isDebtAccountType(accountMap.get(o.account_id)?.account_type ?? "") &&
          o.occurrence_date >= today
      );

      // Window end: next income date or month end
      const windowEndDate = nextIncome
        ? nextIncome.occurrence_date
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      const daysRemaining = Math.max(
        1,
        Math.ceil(
          (new Date(windowEndDate + "T12:00:00").getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      // ── Pending obligations (effective outflows, excl credit card) ──
      const pendingObligations = pendingOccs
        .filter((o: OccurrenceWithTemplate) => {
          const acctType = accountMap.get(o.account_id)?.account_type ?? "";
          const isEffectiveOutflow =
            o.direction === "OUTFLOW" ||
            (o.direction === "INFLOW" && isDebtAccountType(acctType));
          return (
            isEffectiveOutflow &&
            o.occurrence_date >= today &&
            o.occurrence_date <= windowEndDate &&
            acctType !== "CREDIT_CARD"
          );
        })
        .reduce((sum: number, o: OccurrenceWithTemplate) => sum + o.expected_amount, 0);

      const disponible = Math.max(0, liquidBalance - pendingObligations);
      const availablePerDay = Math.round(disponible / daysRemaining);

      // ── Net worth ──
      const netWorth = accounts.reduce((sum: number, a: AccountRow) => {
        return DEBT_ACCOUNT_TYPES.has(a.account_type) ? sum - a.current_balance : sum + a.current_balance;
      }, 0);

      // ── Daily spending metrics ──
      let spentToday = 0;
      let spentYesterday = 0;
      let last7Total = 0;
      let totalOutflow = 0;

      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = toLocalDateString(yesterdayDate);

      for (const tx of txRows) {
        if (tx.is_excluded || tx.direction !== "OUTFLOW") continue;
        if (tx.transfer_group_id || tx.reconciled_into_transaction_id) continue;
        const amount = Math.abs(tx.amount ?? 0);
        totalOutflow += amount;
        if (tx.transaction_date === today) spentToday += amount;
        if (tx.transaction_date === yesterdayStr) spentYesterday += amount;
        const txDate = new Date(tx.transaction_date + "T12:00:00");
        const diffDays = Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) last7Total += amount;
      }

      const avgLast7 = last7Total / 7;

      // ── Upcoming payments (from recurring occurrences) ──
      const payments: AttentionPayment[] = pendingOccs
        .filter((o: OccurrenceWithTemplate) => {
          const acctType = accountMap.get(o.account_id)?.account_type ?? "";
          const isEffectiveOutflow =
            o.direction === "OUTFLOW" ||
            (o.direction === "INFLOW" && isDebtAccountType(acctType));
          const daysUntil = Math.ceil(
            (new Date(o.occurrence_date + "T12:00:00").getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          return isEffectiveOutflow && daysUntil >= 0 && daysUntil <= 7;
        })
        .map((o: OccurrenceWithTemplate) => {
          const daysUntil = Math.ceil(
            (new Date(o.occurrence_date + "T12:00:00").getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            name: o.merchant_name ?? o.description ?? "Recurrente",
            amount: o.expected_amount,
            daysUntil,
            accountName: accountMap.get(o.account_id)?.name ?? "",
          };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil);

      // ── Recent transactions ──
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

      // Build human-readable days label
      const daysLabel = nextIncome
        ? `${daysRemaining} dias hasta ${formatDate(nextIncome.occurrence_date, "dd MMM")}`
        : `${daysRemaining} dias restantes`;

      setData({
        hero: {
          availablePerDay, availableTotal: disponible, daysRemaining, daysLabel,
          breakdown: { totalLiquid: liquidBalance, fixedExpenses: pendingObligations, alreadySpent: totalOutflow },
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
          daysLabel={data.hero.daysLabel}
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
