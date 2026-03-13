"use client";

import type { DebtAccount, CashEntry } from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import type { PlannerAction } from "../scenario-planner";

interface Props {
  accounts: DebtAccount[];
  cashEntries: CashEntry[];
  currency?: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

export function CashStep({ accounts, cashEntries, currency, dispatch }: Props) {
  return (
    <div className="text-muted-foreground text-sm p-8 text-center">
      Paso 1: Tu efectivo — en construcción
    </div>
  );
}
