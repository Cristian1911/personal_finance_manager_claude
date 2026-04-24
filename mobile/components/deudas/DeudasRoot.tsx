import { useCallback, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import type { CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import { getDebtOverview, type DebtOverviewData } from "../../lib/repositories/debt";
import { getDatabase } from "../../lib/db/database";
import { getPreferredCurrency } from "../../lib/profile";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { useExpandableZone } from "../ui/useExpandableZone";
import { DeudasHero } from "./DeudasHero";
import { DeudasGrid } from "./DeudasGrid";
import { DeudasAccountsAccordion } from "./DeudasAccountsAccordion";
import { DeudasSalaryBar } from "./DeudasSalaryBar";
import { DeudasPlanificadorLink } from "./DeudasPlanificadorLink";

async function getMonthlyIncome(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ estimated_monthly_income: number | null }>(
    "SELECT estimated_monthly_income FROM profiles LIMIT 1"
  );
  return row?.estimated_monthly_income ?? 0;
}

export function DeudasRoot() {
  const { sync } = useSync();
  const { activeZone, toggle } = useExpandableZone<string>();

  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DebtOverviewData | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [currency, setCurrency] = useState<CurrencyCode>("COP");

  const loadData = useCallback(async () => {
    try {
      const [overview, income, preferredCurrency] = await Promise.all([
        getDebtOverview(),
        getMonthlyIncome(),
        getPreferredCurrency(),
      ]);
      setData(overview);
      setMonthlyIncome(income);
      setCurrency(preferredCurrency);
    } catch (error) {
      console.error("Failed to load debt data:", error);
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
      <MobileHeader
        variant="main"
        title="Deudas"
        subtitle={`Lectura en ${currency}`}
        right={<AvatarMenuTrigger />}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {data && (
          <>
            <DeudasHero
              totalMonthlyPayment={data.totalMonthlyPayment}
              monthlyInterest={data.monthlyInterest}
              currency={currency}
              accounts={data.accounts}
              expanded={activeZone === "hero"}
              onToggle={() => toggle("hero")}
            />

            {data.totalCreditLimit > 0 && (
              <DeudasGrid
                overallUtilization={data.overallUtilization}
                totalCreditUsed={data.totalCreditUsed}
                totalCreditLimit={data.totalCreditLimit}
                totalMonthlyPayment={data.totalMonthlyPayment}
                currency={currency}
              />
            )}

            <DeudasSalaryBar
              monthlyIncome={monthlyIncome}
              totalDebtPayment={data.totalMonthlyPayment}
              currency={currency}
            />

            <DeudasAccountsAccordion
              accounts={data.accounts}
              currency={currency}
            />

            <DeudasPlanificadorLink accountCount={data.accounts.length} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
