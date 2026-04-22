import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import type { CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import { getTransactions } from "../../lib/repositories/transactions";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { getBudgetProgress, type BudgetProgressRow } from "../../lib/repositories/budgets";
import {
  getActiveTemplates,
  getOccurrencesForMonth,
  toMonthlyAmount,
  type OccurrenceWithTemplate,
} from "../../lib/repositories/recurring";
import { computeTimeline, type TimelineData } from "../../lib/utils/timeline";
import { toLocalMonthString } from "../../lib/utils/date";
import { DEBT_ACCOUNT_TYPES, LIQUID_ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { MonthSelector } from "../common/MonthSelector";
import { PlanNetHero, type PlanExecution } from "./PlanNetHero";
import { PlanWeekTiles } from "./PlanWeekTiles";
import { PlanToolsChips } from "./PlanToolsChips";

interface PlanState {
  plan: PlanExecution;
  budgetItems: BudgetProgressRow[];
  incomeOccs: OccurrenceWithTemplate[];
  paymentOccs: OccurrenceWithTemplate[];
  overdueCount: number;
  upcomingCount: number;
  timeline: TimelineData | null;
}

const EMPTY_PLAN: PlanExecution = {
  plannedIncome: 0, confirmedIncome: 0, pendingIncome: 0,
  plannedExpenses: 0, paidExpenses: 0, pendingExpenses: 0,
  discretionarySpent: 0, disponible: 0, daysRemaining: 0, perDay: 0,
};

const INITIAL: PlanState = {
  plan: EMPTY_PLAN,
  budgetItems: [],
  incomeOccs: [],
  paymentOccs: [],
  overdueCount: 0,
  upcomingCount: 0,
  timeline: null,
};

export function PlanRoot() {
  const { sync } = useSync();
  const [heroExpanded, setHeroExpanded] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => toLocalMonthString());
  const [data, setData] = useState<PlanState>(INITIAL);

  const currency: CurrencyCode = "COP";

  const loadData = useCallback(async () => {
    try {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysRemaining = Math.max(1, daysInMonth - now.getDate());
      const todayIso = now.toISOString().slice(0, 10);

      const [txs, accounts, budgets, occurrences, templates] = await Promise.all([
        getTransactions({ month: currentMonth, limit: 500 }),
        getAllAccounts(),
        getBudgetProgress(currentMonth),
        getOccurrencesForMonth(currentMonth),
        getActiveTemplates(),
      ]);

      const accountMap = new Map<string, AccountRow>(accounts.map((a: AccountRow) => [a.id, a]));

      // ── 1. Planned totals from active templates (liquid + debt accounts) ──
      let plannedIncome = 0;
      let plannedExpenses = 0;
      for (const t of templates) {
        const acctType = accountMap.get(t.account_id)?.account_type ?? "";
        if (!LIQUID_ACCOUNT_TYPES.has(acctType) && !DEBT_ACCOUNT_TYPES.has(acctType)) continue;
        const monthlyAmt = toMonthlyAmount(t.amount, t.frequency);
        const isDebtPayment = DEBT_ACCOUNT_TYPES.has(acctType);
        if (t.direction === "OUTFLOW" || isDebtPayment) {
          plannedExpenses += monthlyAmt;
        } else {
          plannedIncome += monthlyAmt;
        }
      }

      // ── 2. Execution from occurrences (confirmed vs pending) ──
      let confirmedIncome = 0;
      let pendingIncome = 0;
      let paidExpenses = 0;
      let pendingExpenses = 0;
      let overdueCount = 0;
      let upcomingCount = 0;
      const pendingIncomeOccs: OccurrenceWithTemplate[] = [];
      const pendingPaymentOccs: OccurrenceWithTemplate[] = [];

      for (const occ of occurrences) {
        const acctType = accountMap.get(occ.account_id)?.account_type ?? "";
        const isDebtInflow = occ.direction === "INFLOW" && DEBT_ACCOUNT_TYPES.has(acctType);
        const isIncome = occ.direction === "INFLOW" && !isDebtInflow;
        const isExpense = occ.direction === "OUTFLOW" || isDebtInflow;

        if (isIncome) {
          if (occ.status === "paid") {
            confirmedIncome += occ.expected_amount;
          } else if (occ.status === "pending") {
            pendingIncome += occ.expected_amount;
            pendingIncomeOccs.push(occ);
            if (occ.occurrence_date < todayIso) overdueCount++;
            else upcomingCount++;
          }
        } else if (isExpense) {
          if (occ.status === "paid") {
            paidExpenses += occ.expected_amount;
          } else if (occ.status === "pending") {
            pendingExpenses += occ.expected_amount;
            pendingPaymentOccs.push(occ);
            if (occ.occurrence_date < todayIso) overdueCount++;
            else upcomingCount++;
          }
        }
      }

      // Sort pending lists by date ascending (next-first)
      pendingIncomeOccs.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
      pendingPaymentOccs.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));

      // ── 3. Discretionary = non-recurring outflows from liquid accounts ──
      const recurringTxIds = new Set(
        occurrences.filter((o) => o.transaction_id).map((o) => o.transaction_id!)
      );

      let discretionarySpent = 0;
      for (const tx of txs as any[]) {
        if (tx.is_excluded) continue;
        if (tx.direction !== "OUTFLOW") continue;
        if (tx.transfer_group_id) continue;
        if (tx.reconciled_into_transaction_id) continue;
        if (recurringTxIds.has(tx.id)) continue;
        const txAcctType = accountMap.get(tx.account_id)?.account_type ?? "";
        if (!LIQUID_ACCOUNT_TYPES.has(txAcctType)) continue;
        discretionarySpent += Math.abs(tx.amount);
      }

      const disponible = confirmedIncome - paidExpenses - pendingExpenses - discretionarySpent;
      const perDay = Math.round(Math.max(0, disponible) / daysRemaining);

      const liquidBalance = accounts
        .filter((a: AccountRow) => LIQUID_ACCOUNT_TYPES.has(a.account_type))
        .reduce((sum: number, a: AccountRow) => sum + a.current_balance, 0);

      const timeline = computeTimeline(txs, accounts, occurrences, now, liquidBalance);

      setData({
        plan: {
          plannedIncome, confirmedIncome, pendingIncome,
          plannedExpenses, paidExpenses, pendingExpenses,
          discretionarySpent, disponible, daysRemaining, perDay,
        },
        budgetItems: budgets,
        incomeOccs: pendingIncomeOccs,
        paymentOccs: pendingPaymentOccs,
        overdueCount,
        upcomingCount,
        timeline,
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

  const toggleHero = useCallback(() => {
    setHeroExpanded((prev) => !prev);
  }, []);

  const { budgetOverLimit, budgetPct } = useMemo(() => {
    const spent = data.budgetItems.reduce((sum, b) => sum + b.spent, 0);
    const target = data.budgetItems.reduce((sum, b) => sum + b.amount, 0);
    const overLimit = data.budgetItems.filter((b) => b.amount > 0 && b.spent > b.amount).length;
    return {
      budgetOverLimit: overLimit,
      budgetPct: target > 0 ? Math.round((spent / target) * 100) : 0,
    };
  }, [data.budgetItems]);

  const now = new Date();
  const isCurrentMonth =
    currentMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const subtitle = isCurrentMonth ? `${data.plan.daysRemaining}d restantes` : currentMonth;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="main"
        title="Plan"
        subtitle={subtitle}
        right={<AvatarMenuTrigger />}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brass} />
        }
      >
        <View className="items-center">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>

        <PlanNetHero
          plan={data.plan}
          timeline={data.timeline}
          currency={currency}
          expanded={heroExpanded}
          onToggle={toggleHero}
        />

        <PlanWeekTiles
          nextIncome={data.incomeOccs[0] ?? null}
          nextPayment={data.paymentOccs[0] ?? null}
          currency={currency}
        />

        <PlanToolsChips
          budgetOverLimit={budgetOverLimit}
          budgetPct={budgetPct}
          periodHasActive={false}
          periodPercentAssigned={0}
          recurringUpcoming={data.upcomingCount}
          recurringOverdue={data.overdueCount}
        />
      </ScrollView>
    </View>
  );
}
