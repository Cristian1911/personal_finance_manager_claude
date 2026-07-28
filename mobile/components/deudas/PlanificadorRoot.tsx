import { useCallback, useMemo, useReducer, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  expandCashEntries,
  runScenario,
  type CurrencyCode,
  type ScenarioResult,
} from "@zeta/shared";
import { ArrowRight } from "lucide-react-native";
import { getDebtOverview, type DebtOverviewData } from "../../lib/repositories/debt";
import { getPreferredCurrency } from "../../lib/profile";
import { useSync } from "../../lib/sync/hooks";
import {
  getScenarios,
  type SavedScenario,
} from "../../lib/repositories/scenarios";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
} from "../../lib/constants/styles";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard } from "../ui/MCard";
import { CashStep } from "./planificador/CashStep";
import { AllocateStep } from "./planificador/AllocateStep";
import { CompareStep } from "./planificador/CompareStep";
import { DetailStep } from "./planificador/DetailStep";
import { ScenarioManager } from "./planificador/ScenarioManager";
import {
  INITIAL_PLANNER_STATE,
  plannerReducer,
} from "./planificador/reducer";
import { getCurrentMonth } from "./planificador/utils";

type Step = "cash" | "allocate" | "compare" | "detail";

const STEPS: { key: Step; label: string }[] = [
  { key: "cash", label: "1. Efectivo" },
  { key: "allocate", label: "2. Estrategia" },
  { key: "compare", label: "3. Comparar" },
  { key: "detail", label: "4. Detalle" },
];

export function PlanificadorRoot() {
  const { sync } = useSync();
  const [currency, setCurrency] = useState<CurrencyCode>("COP");
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DebtOverviewData | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [step, setStep] = useState<Step>("cash");
  const [state, dispatch] = useReducer(plannerReducer, INITIAL_PLANNER_STATE);

  const loadAll = useCallback(async () => {
    try {
      const [overview, preferredCurrency, scenarios] = await Promise.all([
        getDebtOverview(),
        getPreferredCurrency(),
        getScenarios(),
      ]);
      setData(overview);
      setCurrency(preferredCurrency);
      setSavedScenarios(scenarios);
    } catch (error) {
      console.error("[planificador] load failed:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadAll]);

  const refreshScenarios = useCallback(async () => {
    setSavedScenarios(await getScenarios());
  }, []);

  const sharedAccounts = useMemo(() => {
    if (!data) return [];
    return data.accounts
      .filter((a) => a.balance > 0)
      .map((info) => ({
        id: info.id,
        name: info.name,
        type: info.type,
        balance: info.balance,
        creditLimit: info.creditLimit > 0 ? info.creditLimit : null,
        interestRate: info.interestRate,
        monthlyPayment: info.monthlyPayment,
        paymentDay: info.paymentDay,
        cutoffDay: null,
        currency: info.currency as CurrencyCode,
        color: null,
        institutionName: null,
        currencyBreakdown: null,
        loanAmount: null,
      }));
  }, [data]);

  const startMonth = getCurrentMonth();

  const results = useMemo<Record<number, ScenarioResult>>(() => {
    if (sharedAccounts.length === 0) return {};
    const expanded = expandCashEntries(state.cashEntries);
    const out: Record<number, ScenarioResult> = {};
    for (let i = 0; i < state.scenarios.length; i++) {
      const s = state.scenarios[i];
      out[i] = runScenario({
        accounts: sharedAccounts,
        cashEntries: expanded,
        strategy: s.strategy,
        allocations: s.allocations,
        startMonth,
      });
    }
    return out;
  }, [sharedAccounts, state.cashEntries, state.scenarios, startMonth]);

  const baseline = useMemo<ScenarioResult>(() => {
    if (sharedAccounts.length === 0) {
      return {
        totalMonths: 0,
        totalInterestPaid: 0,
        totalAmountPaid: 0,
        debtFreeDate: "",
        payoffOrder: [],
        timeline: [],
      };
    }
    return runScenario({
      accounts: sharedAccounts,
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth,
    });
  }, [sharedAccounts, startMonth]);

  const goNext = useCallback(() => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx >= 0 && idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  }, [step]);

  const goPrev = useCallback(() => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  }, [step]);

  if (!data) {
    return (
      <View className="flex-1 bg-background">
        <MobileHeader variant="sub" title="Planificador de deudas" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-[12px] font-inter text-muted-foreground">
            Cargando datos de deudas…
          </Text>
        </View>
      </View>
    );
  }

  if (sharedAccounts.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <MobileHeader variant="sub" title="Planificador de deudas" />
        <View className="flex-1 items-center justify-center px-6">
          <MCard className="gap-2 items-center">
            <Text className="text-[14px] font-inter-semibold text-foreground text-center">
              No hay deudas activas
            </Text>
            <Text className="text-[12px] font-inter text-muted-foreground text-center">
              Agrega una tarjeta de crédito o préstamo para simular planes de pago.
            </Text>
          </MCard>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Planificador de deudas" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-white-6"
        // Without this the strip stretches to fill the remaining column height
        // (~900pt), dragging the step content to the bottom of the screen and
        // pulling each tab's `absolute bottom-0` underline down with it.
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {STEPS.map((s) => {
          const active = s.key === step;
          return (
            <Pressable
              key={s.key}
              onPress={() => setStep(s.key)}
              className="mr-5 pb-2.5 pt-3"
            >
              <Text
                className={`text-[12px] font-inter-semibold ${
                  active ? "text-z-brass" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </Text>
              {active && (
                <View className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-z-brass" />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {step === "cash" && (
          <CashStep
            accounts={data.accounts}
            cashEntries={state.cashEntries}
            currency={currency}
            dispatch={dispatch}
          />
        )}
        {step === "allocate" && (
          <AllocateStep
            accounts={data.accounts}
            scenario={state.scenarios[state.activeScenarioIndex]}
            scenarioIndex={state.activeScenarioIndex}
            result={results[state.activeScenarioIndex]}
            currency={currency}
            dispatch={dispatch}
          />
        )}
        {step === "compare" && (
          <CompareStep
            scenarios={state.scenarios}
            results={results}
            baseline={baseline}
            currency={currency}
            dispatch={dispatch}
          />
        )}
        {step === "detail" && (
          <DetailStep
            accounts={data.accounts}
            scenarios={state.scenarios}
            results={results}
            baseline={baseline}
            currency={currency}
          />
        )}

        <StepNav step={step} onNext={goNext} onPrev={goPrev} />

        <ScenarioManager
          accounts={data.accounts}
          state={state}
          results={results}
          savedScenarios={savedScenarios}
          currency={currency}
          dispatch={dispatch}
          onSaved={refreshScenarios}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

interface StepNavProps {
  step: Step;
  onNext: () => void;
  onPrev: () => void;
}

function StepNav({ step, onNext, onPrev }: StepNavProps) {
  const idx = STEPS.findIndex((s) => s.key === step);
  const isFirst = idx === 0;
  const isLast = idx === STEPS.length - 1;
  const nextLabel = STEPS[idx + 1]?.label.replace(/^\d+\.\s*/, "") ?? "";
  return (
    <View className="flex-row gap-2">
      {!isFirst && (
        <Pressable
          onPress={onPrev}
          className={`${GHOST_BUTTON_CLASS} flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3`}
        >
          <Text className="text-[13px] font-inter-semibold text-foreground">
            Atrás
          </Text>
        </Pressable>
      )}
      {!isLast && (
        <Pressable
          onPress={onNext}
          className={`${BRASS_BUTTON_CLASS} flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3`}
        >
          <Text className="text-[13px] font-inter-semibold text-z-ink">
            {nextLabel ? `Ir a ${nextLabel.toLowerCase()}` : "Continuar"}
          </Text>
          <ArrowRight size={14} color={COLORS.ink} />
        </Pressable>
      )}
    </View>
  );
}
