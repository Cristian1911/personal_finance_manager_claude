import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import type { CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import { getTransactions } from "../../lib/repositories/transactions";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { getBudgetProgress, type BudgetProgressRow } from "../../lib/repositories/budgets";
import { getRecurringSummary } from "../../lib/repositories/recurring";
import { computeCashflow } from "../../lib/utils/cashflow";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { useExpandableZone } from "../ui/useExpandableZone";
import { MonthSelector } from "../common/MonthSelector";
import { PlanNetHero } from "./PlanNetHero";
import { PlanDrillCards } from "./PlanDrillCards";
import { PlanBudgetSection } from "./PlanBudgetSection";
import { PlanRecurringSummary } from "./PlanRecurringSummary";

interface PlanState {
  ingresos: number;
  gastos: number;
  budgetItems: BudgetProgressRow[];
  recurringCount: number;
  daysRemaining: number;
  recurringTotal: number;
  recurringPending: number;
  recurringPaid: number;
}

const INITIAL: PlanState = {
  ingresos: 0, gastos: 0, budgetItems: [], recurringCount: 0, daysRemaining: 0,
  recurringTotal: 0, recurringPending: 0, recurringPaid: 0,
};

export function PlanRoot() {
  const { sync } = useSync();
  const { activeZone, toggle } = useExpandableZone<string>();

  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date().toISOString().slice(0, 7)
  );
  const [data, setData] = useState<PlanState>(INITIAL);

  const currency: CurrencyCode = "COP";

  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysRemaining = daysInMonth - now.getDate();

      const [txs, accounts, budgets, recSummary] = await Promise.all([
        getTransactions({ month: currentMonth, limit: 500 }) as Promise<any[]>,
        getAllAccounts(),
        getBudgetProgress(currentMonth),
        getRecurringSummary(currentMonth),
      ]);

      const { totalInflow, totalOutflow } = computeCashflow(txs, accounts);

      const recurring = accounts.filter(
        (a: AccountRow) => a.is_active === 1 && a.payment_day
      ).length;

      setData({
        ingresos: totalInflow,
        gastos: totalOutflow,
        budgetItems: budgets,
        recurringCount: recurring + recSummary.pending_count + recSummary.paid_count,
        daysRemaining,
        recurringTotal: recSummary.total_expected,
        recurringPending: recSummary.pending_count,
        recurringPaid: recSummary.paid_count,
      });
    } catch (error) {
      console.error("Failed to load plan data:", error);
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

  const { budgetSpent, budgetTarget } = useMemo(() => ({
    budgetSpent: data.budgetItems.reduce((sum, b) => sum + b.spent, 0),
    budgetTarget: data.budgetItems.reduce((sum, b) => sum + b.amount, 0),
  }), [data.budgetItems]);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="main"
        title="Plan"
        subtitle={`${data.daysRemaining}d restantes`}
        right={<AvatarMenuTrigger />}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brass} />
        }
      >
        <View className="items-center">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>

        <PlanNetHero
          ingresos={data.ingresos}
          gastos={data.gastos}
          currency={currency}
          daysRemaining={data.daysRemaining}
          expanded={activeZone === "hero"}
          onToggle={() => toggle("hero")}
        />

        {data.recurringTotal > 0 && (
          <PlanRecurringSummary
            totalExpected={data.recurringTotal}
            pendingCount={data.recurringPending}
            paidCount={data.recurringPaid}
            currency={currency}
          />
        )}

        <PlanBudgetSection
          budgetItems={data.budgetItems}
          currency={currency}
        />

        <PlanDrillCards
          budgetSpent={budgetSpent}
          budgetTarget={budgetTarget}
          recurringCount={data.recurringCount}
          currency={currency}
        />
      </ScrollView>
    </View>
  );
}
