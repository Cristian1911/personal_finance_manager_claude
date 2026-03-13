"use client";

import type { DebtAccount, ScenarioResult } from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import type { PlannerAction, ScenarioState } from "../scenario-planner";

interface Props {
  accounts: DebtAccount[];
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency?: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

export function CompareStep({ scenarios, results, baseline }: Props) {
  return (
    <div className="text-muted-foreground text-sm p-8 text-center">
      Paso 3: Comparar — en construcción
    </div>
  );
}
