"use client";

import { useReducer, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type DebtAccount,
  type CashEntry,
  type ScenarioAllocations,
  type ScenarioStrategy,
  type ScenarioResult,
  runScenario,
  expandCashEntries,
} from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import { CashStep } from "./planner/cash-step";
import { AllocateStep } from "./planner/allocate-step";
import { CompareStep } from "./planner/compare-step";
import { DetailStep } from "./planner/detail-step";
import { ScenarioManager } from "./planner/scenario-manager";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

function StepNav({ onNext, nextLabel, showSkip, hint }: {
  onNext: () => void;
  nextLabel: string;
  showSkip?: boolean;
  hint?: string;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      <div className="flex items-center gap-2">
        <Button onClick={onNext} className="gap-1.5">
          {nextLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
        {showSkip && (
          <Button variant="ghost" size="sm" onClick={onNext}>
            Omitir por ahora
          </Button>
        )}
      </div>
    </div>
  );
}

export interface ScenarioState {
  name: string;
  strategy: ScenarioStrategy;
  allocations: ScenarioAllocations;
}

export interface PlannerState {
  cashEntries: CashEntry[];
  scenarios: ScenarioState[];
  activeScenarioIndex: number;
  savedScenarioId: string | null;
  isDirty: boolean;
}

export type PlannerAction =
  | { type: "SET_CASH_ENTRIES"; entries: CashEntry[] }
  | { type: "ADD_CASH_ENTRY"; entry: CashEntry }
  | { type: "REMOVE_CASH_ENTRY"; id: string }
  | { type: "UPDATE_SCENARIO"; index: number; state: Partial<ScenarioState> }
  | { type: "ADD_SCENARIO" }
  | { type: "REMOVE_SCENARIO"; index: number }
  | { type: "SET_ACTIVE_SCENARIO"; index: number }
  | { type: "MARK_SAVED"; id: string }
  | { type: "LOAD_STATE"; state: PlannerState };

function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case "SET_CASH_ENTRIES":
      return { ...state, cashEntries: action.entries, isDirty: true };
    case "ADD_CASH_ENTRY":
      return { ...state, cashEntries: [...state.cashEntries, action.entry], isDirty: true };
    case "REMOVE_CASH_ENTRY":
      return {
        ...state,
        cashEntries: state.cashEntries.filter((e) => e.id !== action.id),
        isDirty: true,
      };
    case "UPDATE_SCENARIO":
      return {
        ...state,
        scenarios: state.scenarios.map((s, i) =>
          i === action.index ? { ...s, ...action.state } : s
        ),
        isDirty: true,
      };
    case "ADD_SCENARIO":
      if (state.scenarios.length >= 3) return state;
      return {
        ...state,
        scenarios: [
          ...state.scenarios,
          {
            name: `Plan ${String.fromCharCode(65 + state.scenarios.length)}`,
            strategy: "avalanche",
            allocations: { manualOverrides: [], cascadeRedirects: [] },
          },
        ],
        activeScenarioIndex: state.scenarios.length,
        isDirty: true,
      };
    case "REMOVE_SCENARIO":
      if (state.scenarios.length <= 1) return state;
      return {
        ...state,
        scenarios: state.scenarios.filter((_, i) => i !== action.index),
        activeScenarioIndex: Math.min(state.activeScenarioIndex, state.scenarios.length - 2),
        isDirty: true,
      };
    case "SET_ACTIVE_SCENARIO":
      return { ...state, activeScenarioIndex: action.index };
    case "MARK_SAVED":
      return { ...state, savedScenarioId: action.id, isDirty: false };
    case "LOAD_STATE":
      return action.state;
    default:
      return state;
  }
}

const initialState: PlannerState = {
  cashEntries: [],
  scenarios: [
    {
      name: "Plan A",
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
    },
  ],
  activeScenarioIndex: 0,
  savedScenarioId: null,
  isDirty: false,
};

interface Props {
  accounts: DebtAccount[];
  currency?: CurrencyCode;
  savedScenarios: unknown[];
  income?: number;
}

export function ScenarioPlanner({ accounts, currency, savedScenarios, income }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(plannerReducer, initialState);

  // Compute results for all scenarios
  const results = useMemo<Record<number, ScenarioResult>>(() => {
    const now = new Date();
    const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const expanded = expandCashEntries(state.cashEntries);
    const r: Record<number, ScenarioResult> = {};

    for (let i = 0; i < state.scenarios.length; i++) {
      const scenario = state.scenarios[i];
      r[i] = runScenario({
        accounts,
        cashEntries: expanded,
        strategy: scenario.strategy,
        allocations: scenario.allocations,
        startMonth,
      });
    }

    return r;
  }, [accounts, state.cashEntries, state.scenarios]);

  // Baseline: no extra payments
  const baseline = useMemo<ScenarioResult>(() => {
    const now = new Date();
    const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return runScenario({
      accounts,
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth,
    });
  }, [accounts]);

  const [activeTab, setActiveTab] = useState("cash");
  const STEPS = ["cash", "allocate", "compare", "detail"] as const;
  const stepIndex = STEPS.indexOf(activeTab as typeof STEPS[number]);
  const goNext = () => stepIndex < STEPS.length - 1 && setActiveTab(STEPS[stepIndex + 1]);

  return (
    <div className="space-y-4">
      {/* Intro guidance */}
      <div className="rounded-lg bg-z-surface-2 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Simula diferentes estrategias de pago para tus deudas. Define cuánto efectivo extra puedes aportar, elige una estrategia, y compara los resultados.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cash">1. Efectivo</TabsTrigger>
          <TabsTrigger value="allocate">2. Estrategia</TabsTrigger>
          <TabsTrigger value="compare">3. Comparar</TabsTrigger>
          <TabsTrigger value="detail">4. Detalle</TabsTrigger>
        </TabsList>

        <TabsContent value="cash">
          <CashStep
            accounts={accounts}
            cashEntries={state.cashEntries}
            currency={currency}
            dispatch={dispatch}
          />
          <StepNav onNext={goNext} nextLabel="Elegir estrategia" showSkip hint="Puedes simular sin efectivo extra — se usarán solo los pagos mínimos." />
        </TabsContent>

        <TabsContent value="allocate">
          <AllocateStep
            accounts={accounts}
            scenario={state.scenarios[state.activeScenarioIndex]}
            scenarioIndex={state.activeScenarioIndex}
            result={results[state.activeScenarioIndex]}
            dispatch={dispatch}
          />
          <StepNav onNext={goNext} nextLabel="Comparar planes" />
        </TabsContent>

        <TabsContent value="compare">
          <CompareStep
            accounts={accounts}
            scenarios={state.scenarios}
            results={results}
            baseline={baseline}
            currency={currency}
            dispatch={dispatch}
          />
          <StepNav onNext={goNext} nextLabel="Ver detalle" />
        </TabsContent>

        <TabsContent value="detail">
          <DetailStep
            accounts={accounts}
            scenarios={state.scenarios}
            results={results}
            baseline={baseline}
            currency={currency}
            income={income}
          />
        </TabsContent>
      </Tabs>

      <ScenarioManager
        accounts={accounts}
        state={state}
        results={results}
        savedScenarios={savedScenarios as any[]}
        currency={currency}
        dispatch={dispatch}
        onScenariosChange={() => router.refresh()}
      />
    </div>
  );
}
