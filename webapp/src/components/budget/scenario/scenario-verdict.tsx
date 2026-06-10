"use client";

import { Scissors, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import type {
  BudgetScenarioSummary,
  ScenarioCutCandidate,
  ScenarioDeferCandidate,
} from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

// ─── C2 · Verdict told over the 50/30/20 bars ────────────────────────────────
// Ghost bar = current allocation · solid bar = scenario · white tick = target.

function AllocBar({
  label,
  scenario,
  current,
  target,
  income,
  colorClass,
  currency,
}: {
  label: string;
  scenario: number;
  current: number;
  target: number;
  income: number;
  colorClass: string;
  currency: CurrencyCode;
}) {
  const pct = (v: number) => Math.min(105, (v / income) * 100);
  const over = scenario > target;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold text-z-sage-light">{label}</span>
        <span className="text-[11px] tabular-nums">
          <span className={cn("font-bold", over ? "text-z-debt" : colorClass)}>
            {Math.round((scenario / income) * 100)}%
          </span>
          <span className="text-z-sage-dark"> · meta {Math.round((target / income) * 100)}%</span>
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-white/6">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-z-sage-light/16"
          style={{ width: `${pct(current)}%` }}
        />
        <div
          className={cn(
            "absolute left-0 top-0.5 h-1.5 rounded-full transition-[width] duration-200",
            over ? "bg-z-debt" : colorClass.replace("text-", "bg-"),
          )}
          style={{ width: `${pct(scenario)}%` }}
        />
        <div
          className="absolute -top-0.5 h-3.5 w-0.5 rounded-full bg-foreground/55"
          style={{ left: `${pct(target)}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-z-sage-dark">
        <span>actual {formatCurrency(current, currency)}</span>
        <span>
          escenario{" "}
          <span className={cn("font-semibold", over ? "text-z-debt" : "text-z-sage-light")}>
            {formatCurrency(scenario, currency)}
          </span>
        </span>
      </div>
    </div>
  );
}

export function ScenarioVerdict({
  summary,
  income,
  cuts,
  defers,
  appliedCutIds,
  currency,
  onApplyCut,
  onDeferItem,
}: {
  summary: BudgetScenarioSummary;
  income: number;
  cuts: ScenarioCutCandidate[];
  defers: ScenarioDeferCandidate[];
  appliedCutIds: string[];
  currency: CurrencyCode;
  onApplyCut: (cut: ScenarioCutCandidate) => void;
  onDeferItem: (itemId: string) => void;
}) {
  const { shortfall, fits, allocation, currentAllocation } = summary;
  const targets = { needs: income * 0.5, wants: income * 0.3, savings: income * 0.2 };

  const breakdown = [
    {
      label: "Presupuesto vs ingreso",
      value: summary.budgetGap,
      show: summary.budgetGap !== 0,
    },
    {
      label: "Sobregasto real esperado",
      value: summary.expectedOverspend,
      show: summary.expectedOverspend > 0,
    },
    {
      label: `Reserva de arranque (${summary.startupMonths} ${summary.startupMonths === 1 ? "mes" : "meses"})`,
      value: summary.startupReserve,
      show: summary.startupReserve > 0,
    },
  ].filter((r) => r.show);

  const visibleCuts = cuts.filter((c) => !appliedCutIds.includes(c.categoryId)).slice(0, 3);
  const visibleDefers = fits ? [] : defers.slice(0, 1);

  return (
    <div className={cn(PANEL_SURFACE_CLASS, "p-4")}>
      <div className="flex items-center justify-between gap-2">
        <p className={SECTION_EYEBROW_CLASS}>
          Escenario · 50 / 30 / 20
        </p>
        <span
          className={cn(
            "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold tabular-nums",
            fits
              ? "border-z-income/35 bg-z-income/8 text-z-income"
              : "border-z-debt/35 bg-z-debt/8 text-z-debt",
          )}
        >
          {fits
            ? `sobran ${formatCurrency(-shortfall, currency)}`
            : `faltan ${formatCurrency(shortfall, currency)}`}{" "}
          /mes
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        <AllocBar
          label="Necesidades"
          scenario={allocation.needs}
          current={currentAllocation.needs}
          target={targets.needs}
          income={income}
          colorClass="text-z-sage"
          currency={currency}
        />
        <AllocBar
          label="Gustos"
          scenario={allocation.wants}
          current={currentAllocation.wants}
          target={targets.wants}
          income={income}
          colorClass="text-z-brass"
          currency={currency}
        />
        <AllocBar
          label="Ahorro"
          scenario={allocation.savings}
          current={currentAllocation.savings}
          target={targets.savings}
          income={income}
          colorClass="text-z-income"
          currency={currency}
        />
      </div>

      {breakdown.length > 0 && (
        <div className="mt-3 border-t border-white/6 pt-2.5">
          {breakdown.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between py-1 text-[11px]"
            >
              <span className="text-z-sage-light">{row.label}</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  row.value > 0 ? "text-z-debt" : "text-z-income",
                )}
              >
                {row.value > 0 ? "−" : "+"}
                {formatCurrency(Math.abs(row.value), currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10.5px] leading-relaxed text-z-sage-dark">
        {fits ? (
          <>
            El total cabe en tu ingreso con{" "}
            <span className="font-semibold text-z-income">
              {formatCurrency(-shortfall, currency)}
            </span>{" "}
            de margen al mes.
          </>
        ) : (
          <>
            Necesidades pasa de {Math.round((currentAllocation.needs / income) * 100)}% a{" "}
            <span className="font-semibold text-z-debt">
              {Math.round((allocation.needs / income) * 100)}%
            </span>
            . Para que cierre, recorta gustos o pausa parte del ahorro.
          </>
        )}
      </p>

      {!fits && (visibleCuts.length > 0 || visibleDefers.length > 0) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {visibleCuts.map((cut) => (
            <button
              key={cut.categoryId}
              type="button"
              onClick={() => onApplyCut(cut)}
              className="inline-flex items-center gap-1 rounded-full border border-z-alert/25 bg-z-alert/8 px-2.5 py-1.5 text-[10px] font-semibold text-z-alert transition-colors active:bg-z-alert/16"
            >
              <Scissors className="size-2.5" strokeWidth={2} />
              {cut.name} −{formatCurrency(cut.relief, currency)}
            </button>
          ))}
          {visibleDefers.map((d) => (
            <button
              key={d.itemId}
              type="button"
              onClick={() => onDeferItem(d.itemId)}
              className="inline-flex items-center gap-1 rounded-full border border-z-alert/25 bg-z-alert/8 px-2.5 py-1.5 text-[10px] font-semibold text-z-alert transition-colors active:bg-z-alert/16"
            >
              <CalendarClock className="size-2.5" strokeWidth={2} />
              Aplazar {d.name} −{formatCurrency(d.relief, currency)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
