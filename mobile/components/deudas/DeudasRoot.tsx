import { useCallback, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import type { CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import { getDebtOverview, type DebtOverviewData } from "../../lib/repositories/debt";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { AvatarMenuTrigger } from "../ui/AvatarMenu";
import { useExpandableZone } from "../ui/useExpandableZone";
import { DeudasHero } from "./DeudasHero";
import { DeudasGrid } from "./DeudasGrid";
import { DeudasAccountsAccordion } from "./DeudasAccountsAccordion";

export function DeudasRoot() {
  const { sync } = useSync();
  const { activeZone, toggle } = useExpandableZone<string>();

  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DebtOverviewData | null>(null);

  const currency: CurrencyCode = "COP";

  const loadData = useCallback(async () => {
    try {
      const overview = await getDebtOverview();
      setData(overview);
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

            <DeudasAccountsAccordion
              accounts={data.accounts}
              currency={currency}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}
