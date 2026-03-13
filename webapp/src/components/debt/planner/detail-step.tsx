"use client";

import type { DebtAccount, ScenarioResult } from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import type { ScenarioState } from "../scenario-planner";

interface Props {
  accounts: DebtAccount[];
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency?: CurrencyCode;
}

export function DetailStep({ scenarios, results, baseline }: Props) {
  return (
    <div className="text-muted-foreground text-sm p-8 text-center">
      Paso 4: Detalle — en construcción
    </div>
  );
}
