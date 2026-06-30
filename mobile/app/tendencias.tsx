import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  anomalies,
  budgetAdherenceSeries,
  buildVerdict,
  categorySeries,
  formatCurrency,
  incomeVsExpenseSeries,
  movers,
  savingsRateSeries,
  type AnalyticsConfig,
} from "@zeta/shared";
import { MobileHeader } from "../components/ui/MobileHeader";
import { COLORS } from "../lib/constants/colors";
import {
  getTendenciasDataset,
  type TendenciasDataset,
} from "../lib/repositories/analytics";
import {
  CategoryTrendList,
  PeriodControl,
  VerdictHeader,
  type RangeKey,
} from "../components/tendencias/TendenciasView";
import {
  AnomaliesCard,
  BudgetAdherenceCard,
  IncomeExpenseCard,
  LensTabs,
  MoversCard,
  SavingsRateCard,
  type Lens,
} from "../components/tendencias/TendenciasLenses";

export default function TendenciasScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<RangeKey>("6M");
  const [lens, setLens] = useState<Lens>("gastos");
  const [dataset, setDataset] = useState<TendenciasDataset | null>(null);
  const [loading, setLoading] = useState(true);

  // Guards against a slow load overwriting a newer one (rapid range taps).
  const loadIdRef = useRef(0);
  const load = useCallback(async () => {
    const id = ++loadIdRef.current;
    setLoading(true);
    try {
      const result = await getTendenciasDataset(range);
      if (id !== loadIdRef.current) return;
      setDataset(result);
    } catch (error) {
      if (id === loadIdRef.current)
        console.error("Failed to load tendencias:", error);
    } finally {
      if (id === loadIdRef.current) setLoading(false);
    }
  }, [range]);

  // useFocusEffect re-runs its effect whenever the callback identity changes —
  // and `load` changes with `range` — so this one effect covers the initial
  // mount, tab refocus, AND range changes (the loadIdRef guard drops stale ones).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const contentStyle = useMemo(
    () => ({ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }),
    [insets.bottom]
  );

  const vm = useMemo(() => {
    if (!dataset) return null;
    const config: AnalyticsConfig = {
      months: dataset.months,
      debtAccountIds: new Set(dataset.debtAccountIds),
      categoryMeta: new Map(dataset.categoryMeta),
      destinatarioMeta: new Map(),
    };
    const { rows } = dataset;
    const cats = categorySeries(rows, config);
    const cashflow = incomeVsExpenseSeries(rows, config);
    const savings = savingsRateSeries(rows, config, cashflow);
    const moverList = movers(cats);
    const n = Math.max(cashflow.length, 1);
    const avgIncome = cashflow.reduce((a, p) => a + p.income, 0) / n;
    const avgExpense = cashflow.reduce((a, p) => a + p.expense, 0) / n;
    const fmt = (x: number) => formatCurrency(x, "COP");
    return {
      verdict: buildVerdict(
        { savings, movers: moverList, avgExpense, avgIncome },
        fmt
      ),
      // categorySeries already returns total-desc; spread to snapshot before exit.
      categories: [...cats],
      savings,
      cashflow,
      adherence: budgetAdherenceSeries(rows, config, cats),
      movers: moverList,
      anomalies: anomalies(rows, config, cats),
    };
  }, [dataset]);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Tendencias" />
      {loading && !dataset ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={contentStyle}>
          {vm ? <VerdictHeader verdict={vm.verdict} /> : null}
          <PeriodControl range={range} onChange={setRange} />
          {vm ? <LensTabs lens={lens} onChange={setLens} /> : null}
          {vm && lens === "gastos" ? (
            <CategoryTrendList categories={vm.categories} />
          ) : null}
          {vm && lens === "ahorro" ? (
            <>
              <SavingsRateCard savings={vm.savings} />
              <IncomeExpenseCard cashflow={vm.cashflow} />
              <BudgetAdherenceCard adherence={vm.adherence} />
            </>
          ) : null}
          {vm && lens === "cambios" ? (
            <>
              <MoversCard movers={vm.movers} />
              <AnomaliesCard anomalies={vm.anomalies} />
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
