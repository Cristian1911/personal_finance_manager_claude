import type {
  CashEntry,
  ScenarioAllocations,
  ScenarioStrategy,
} from "@zeta/shared";

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
  | { type: "ADD_CASH_ENTRY"; entry: CashEntry }
  | { type: "REMOVE_CASH_ENTRY"; id: string }
  | { type: "UPDATE_SCENARIO"; index: number; state: Partial<ScenarioState> }
  | { type: "ADD_SCENARIO" }
  | { type: "REMOVE_SCENARIO"; index: number }
  | { type: "SET_ACTIVE_SCENARIO"; index: number }
  | { type: "MARK_SAVED"; id: string }
  | { type: "LOAD_STATE"; state: PlannerState };

export const INITIAL_PLANNER_STATE: PlannerState = {
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

export function plannerReducer(
  state: PlannerState,
  action: PlannerAction
): PlannerState {
  switch (action.type) {
    case "ADD_CASH_ENTRY":
      return {
        ...state,
        cashEntries: [...state.cashEntries, action.entry],
        isDirty: true,
      };
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
        activeScenarioIndex: Math.min(
          state.activeScenarioIndex,
          state.scenarios.length - 2
        ),
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
