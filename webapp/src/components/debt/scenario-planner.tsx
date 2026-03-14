"use client";

import { useReducer, useMemo } from "react";
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
}

export function ScenarioPlanner({ accounts, currency, savedScenarios }: Props) {
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

  return (
    <div className="space-y-4">
      <Tabs defaultValue="cash" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cash">Tu efectivo</TabsTrigger>
          <TabsTrigger value="allocate">Asignar</TabsTrigger>
          <TabsTrigger value="compare">Comparar</TabsTrigger>
          <TabsTrigger value="detail">Detalle</TabsTrigger>
        </TabsList>

        <TabsContent value="cash">
          <CashStep
            accounts={accounts}
            cashEntries={state.cashEntries}
            currency={currency}
            dispatch={dispatch}
          />
        </TabsContent>

        <TabsContent value="allocate">
          <AllocateStep
            accounts={accounts}
            scenario={state.scenarios[state.activeScenarioIndex]}
            scenarioIndex={state.activeScenarioIndex}
            result={results[state.activeScenarioIndex]}
            dispatch={dispatch}
          />
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
        </TabsContent>

        <TabsContent value="detail">
          <DetailStep
            accounts={accounts}
            scenarios={state.scenarios}
            results={results}
            baseline={baseline}
            currency={currency}
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
