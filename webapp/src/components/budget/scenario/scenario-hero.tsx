"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  GHOST_BUTTON_CLASS,
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
} from "@/lib/constants/styles";
import type { BudgetScenarioSummary } from "@zeta/shared";
import { SCEN_CARD_CLASS, ScenTag } from "./scenario-shared";
import type { CurrencyCode } from "@/types/domain";

export function ScenarioHero({
  name,
  summary,
  income,
  currentTotal,
  currency,
  dirty,
  onDiscard,
  onSave,
  onApply,
}: {
  name: string;
  summary: BudgetScenarioSummary;
  income: number;
  currentTotal: number;
  currency: CurrencyCode;
  dirty: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onApply: () => void;
}) {
  const over = summary.scenarioTotal > income;
  const max = Math.max(summary.scenarioTotal, income, 1);
  const restante = income - summary.scenarioTotal;

  return (
    <div className={cn(SCEN_CARD_CLASS, "p-4")}>
      <div className="flex items-center justify-between gap-2">
        <ScenTag name={name} />
        <span className="text-[10px] text-z-sage-dark">{dirty ? "sin guardar" : "guardado"}</span>
      </div>

      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <p className="text-[10px] text-z-sage-dark">Ingreso</p>
          <p className="text-[15px] font-bold tabular-nums text-z-sage-light">
            {formatCurrency(income, currency)}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-z-sage-dark">Escenario</p>
          <p className="text-[15px] font-bold tabular-nums">
            {formatCurrency(summary.scenarioTotal, currency)}
          </p>
        </div>
        <div className="flex-1 text-right">
          <p className="text-[10px] text-z-sage-dark">Restante</p>
          <p
            className={cn(
              "text-[15px] font-bold tabular-nums",
              restante < 0 ? "text-z-debt" : "text-z-income",
            )}
          >
            {formatCurrency(restante, currency)}
          </p>
        </div>
      </div>

      <div className="relative mt-2.5 h-1.5 rounded-full bg-white/6">
        <div
          className={cn("h-full rounded-full", over ? "bg-z-debt" : "bg-z-brass")}
          style={{ width: `${(summary.scenarioTotal / max) * 100}%` }}
        />
        <div
          className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/55"
          style={{ left: `${(income / max) * 100}%` }}
        />
      </div>

      <p className="mt-2 text-[10px] tabular-nums text-z-sage-dark">
        Real: asignado {formatCurrency(currentTotal, currency)} · restante{" "}
        <span className="text-z-income">{formatCurrency(income - currentTotal, currency)}</span>
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className={cn(
            "h-11 flex-1 rounded-md border text-xs font-semibold transition-colors",
            GHOST_BUTTON_CLASS,
          )}
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "h-11 flex-1 rounded-md border text-xs font-semibold transition-colors",
            BRASS_GHOST_BUTTON_CLASS,
          )}
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onApply}
          className={cn(
            "h-11 flex-1 rounded-md text-xs font-semibold transition-colors",
            BRASS_BUTTON_CLASS,
          )}
        >
          Aplicar…
        </button>
      </div>
    </div>
  );
}
