"use client";

import { SlidersHorizontal, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { VERDICT_LABELS } from "./scenario-model";
import type { BudgetScenarioStartupItem } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

/** Gold sandbox accent — the visual signature of scenario mode. */
export const SCEN_CARD_CLASS =
  "rounded-2xl border-[1.5px] border-dashed border-z-alert/35 bg-gradient-to-b from-z-alert/8 to-transparent";

export function ScenTag({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-z-alert/35 bg-z-alert/12 px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] text-z-alert",
        className,
      )}
    >
      <SlidersHorizontal className="size-3" strokeWidth={2} />
      Simulación · {name}
    </span>
  );
}

export function NuevoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-z-alert/25 bg-z-alert/12 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.1em] text-z-alert">
      nuevo
    </span>
  );
}

export function FijoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-z-sage-dark">
      <Lock className="size-2.5" strokeWidth={2} />
      fijo
    </span>
  );
}

/** +$ X (more spending, orange) / −$ X (a cut, green). */
export function DeltaChip({ value, currency }: { value: number; currency: CurrencyCode }) {
  const up = value > 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] font-bold tabular-nums",
        up
          ? "border-z-expense/30 bg-z-expense/10 text-z-expense"
          : "border-z-income/30 bg-z-income/10 text-z-income",
      )}
    >
      {up ? "+" : "−"}
      {formatCurrency(Math.abs(value), currency)}
    </span>
  );
}

const AFFORD_CHIP_CLASSES: Record<string, string> = {
  BUY: "border-z-income/35 bg-z-income/8 text-z-income",
  BUY_WITH_CAUTION: "border-z-alert/35 bg-z-alert/8 text-z-alert",
  WAIT: "border-z-expense/35 bg-z-expense/8 text-z-expense",
  NOT_RECOMMENDED: "border-z-debt/35 bg-z-debt/8 text-z-debt",
};

export function AffordChip({ verdict }: { verdict: BudgetScenarioStartupItem["verdict"] }) {
  if (!verdict) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.08em]",
        AFFORD_CHIP_CLASSES[verdict],
      )}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

/** "prom 3m $ 410.000" — the reality anchor under editor rows. */
export function PromAnchor({
  avg3m,
  scenario,
  currency,
}: {
  avg3m: number | null;
  scenario: number;
  currency: CurrencyCode;
}) {
  if (avg3m == null) {
    return <span className="text-[10px] text-z-sage-dark">sin historial — estimado</span>;
  }
  return (
    <span
      className={cn(
        "whitespace-nowrap text-[10px] tabular-nums",
        avg3m > scenario ? "text-z-alert" : "text-z-sage-dark",
      )}
    >
      gastas <span className="font-semibold">{formatCurrency(avg3m, currency)}</span> prom 3m
    </span>
  );
}
