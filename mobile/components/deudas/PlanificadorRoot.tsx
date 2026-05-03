import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { Calculator, ArrowRight } from "lucide-react-native";
import { getDebtOverview, type DebtOverviewData } from "../../lib/repositories/debt";
import { getPreferredCurrency } from "../../lib/profile";
import { useSync } from "../../lib/sync/hooks";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
  PANEL_SURFACE_SUBTLE_CLASS,
} from "../../lib/constants/styles";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard } from "../ui/MCard";
import { StrategyCard } from "./StrategyCard";
import { PayoffResultCard } from "./PayoffResultCard";

type Tab = "cash" | "strategy" | "results";

const TABS: { key: Tab; label: string }[] = [
  { key: "cash", label: "Extra" },
  { key: "strategy", label: "Estrategia" },
  { key: "results", label: "Resultados" },
];

type Strategy = "avalanche" | "snowball";

export function PlanificadorRoot() {
  const { sync } = useSync();
  const [currency, setCurrency] = useState<CurrencyCode>("COP");

  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DebtOverviewData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("cash");
  const [extraCash, setExtraCash] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("avalanche");

  const loadData = useCallback(async () => {
    try {
      const [overview, preferredCurrency] = await Promise.all([
        getDebtOverview(),
        getPreferredCurrency(),
      ]);
      setData(overview);
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

  const extraCashNum = parseFloat(extraCash) || 0;
  const totalMinimums = data?.totalMonthlyPayment ?? 0;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Planificador de deudas" />

      {/* Tab bar */}
      <View className="flex-row border-b border-white-6 px-4">
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className="mr-5 pb-2.5 pt-3"
          >
            <Text
              className={`text-[13px] font-inter-semibold ${
                activeTab === tab.key
                  ? "text-z-brass"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Text>
            {activeTab === tab.key && (
              <View className="absolute bottom-0 left-0 right-0 h-[2px] bg-z-brass rounded-full" />
            )}
          </Pressable>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {/* ── Tab 1: Extra Cash ─────────────────────────────── */}
        {activeTab === "cash" && (
          <View className="gap-3">
            <MCard className="gap-3">
              <View className="flex-row items-center gap-2">
                <Calculator size={18} color={COLORS.brass} />
                <Text className="text-[15px] font-inter-semibold text-foreground">
                  Efectivo extra mensual
                </Text>
              </View>

              <Text className="text-[12px] font-inter text-muted-foreground">
                Cuanto dinero adicional puedes destinar cada mes para pagar tus
                deudas, por encima de los pagos minimos?
              </Text>

              <View
                className={`${PANEL_SURFACE_SUBTLE_CLASS} flex-row items-center px-4 py-3`}
              >
                <Text className="text-[15px] font-inter-semibold text-muted-foreground mr-2">
                  $
                </Text>
                <TextInput
                  className="flex-1 text-[22px] font-inter-bold text-foreground"
                  placeholder="0"
                  placeholderTextColor={COLORS.sageDark}
                  value={extraCash}
                  onChangeText={setExtraCash}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>

              {totalMinimums > 0 && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-inter text-muted-foreground">
                    Pagos minimos actuales
                  </Text>
                  <Text className="text-[11px] font-inter-semibold text-foreground">
                    {formatCurrency(totalMinimums, currency)}/mes
                  </Text>
                </View>
              )}

              {extraCashNum > 0 && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-inter text-muted-foreground">
                    Pago total mensual
                  </Text>
                  <Text className="text-[11px] font-inter-semibold text-z-brass">
                    {formatCurrency(totalMinimums + extraCashNum, currency)}/mes
                  </Text>
                </View>
              )}
            </MCard>

            <Pressable
              onPress={() => setActiveTab("strategy")}
              className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-xl py-3.5`}
            >
              <Text className="text-[15px] font-inter-semibold text-z-ink">
                Continuar
              </Text>
              <ArrowRight size={16} color={COLORS.ink} />
            </Pressable>
          </View>
        )}

        {/* ── Tab 2: Strategy Selection ─────────────────────── */}
        {activeTab === "strategy" && (
          <View className="gap-3">
            <Text className="text-[10px] font-inter-semibold uppercase tracking-[3px] text-z-sage-dark px-1">
              Elige tu estrategia
            </Text>

            <StrategyCard
              title="Avalancha"
              description="Paga primero la deuda con mayor tasa de interes. Ahorras mas dinero a largo plazo."
              selected={strategy === "avalanche"}
              onPress={() => setStrategy("avalanche")}
            />

            <StrategyCard
              title="Bola de Nieve"
              description="Paga primero la deuda con menor saldo. Logras victorias rapidas que te motivan."
              selected={strategy === "snowball"}
              onPress={() => setStrategy("snowball")}
            />

            <Pressable
              onPress={() => setActiveTab("results")}
              className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-xl py-3.5`}
            >
              <Text className="text-[15px] font-inter-semibold text-z-ink">
                Ver resultados
              </Text>
              <ArrowRight size={16} color={COLORS.ink} />
            </Pressable>
          </View>
        )}

        {/* ── Tab 3: Results ────────────────────────────────── */}
        {activeTab === "results" && data && (
          <PayoffResultCard
            accounts={data.accounts}
            strategy={strategy}
            extraCash={extraCashNum}
            currency={currency}
          />
        )}

        {activeTab === "results" && !data && (
          <MCard>
            <Text className="text-sm font-inter text-muted-foreground text-center py-4">
              Cargando datos de deudas...
            </Text>
          </MCard>
        )}
      </ScrollView>
    </View>
  );
}
