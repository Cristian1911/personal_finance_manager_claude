"use client";

import type { DebtAccount, ScenarioResult } from "@zeta/shared";
import type { PlannerAction, ScenarioState } from "../scenario-planner";

interface Props {
  accounts: DebtAccount[];
  scenario: ScenarioState;
  scenarioIndex: number;
  result: ScenarioResult | undefined;
  dispatch: React.Dispatch<PlannerAction>;
}

export function AllocateStep({ accounts, scenario, result, dispatch }: Props) {
  return (
    <div className="text-muted-foreground text-sm p-8 text-center">
      Paso 2: Asignar pagos — en construcción
    </div>
  );
}
