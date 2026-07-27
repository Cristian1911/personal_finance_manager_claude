"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useChartFocusMode } from "@/hooks/use-chart-focus-mode";
import { PlanFlowChart } from "./plan-flow-chart";
import { Verdict, type VerdictState } from "@/components/ui/verdict";
import { formatCurrency } from "@/lib/utils/currency";
import {
  HERO_CARD_GRADIENT_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import type { PlanTimelineData } from "@/actions/plan-timeline";

interface PlanNetHeroProps {
  ingresos: number;
  gastos: number;
  currency: CurrencyCode;
  daysRemaining: number;
  timelineData: PlanTimelineData;
}

export function PlanNetHero({
  ingresos,
  gastos,
  currency,
  daysRemaining,
  timelineData,
}: PlanNetHeroProps) {
  const [expanded, setExpanded] = useState(false);
  const neto = ingresos - gastos;
  const gastosRatio = ingresos > 0 ? Math.min((gastos / ingresos) * 100, 100) : 0;
  const netoRatio = 100 - gastosRatio;

  // Verdict: ingresos are the limit. Spent everything (or more) → te-pasaste;
  // 75–99% of income used → cerca; otherwise vas-bien.
  const spentPct = Math.round(gastosRatio);
  const verdictState: VerdictState =
    neto < 0 || (neto === 0 && gastos > 0)
      ? "te-pasaste"
      : spentPct >= 75
        ? "cerca"
        : "vas-bien";
  const verdictDelta =
    verdictState !== "te-pasaste" && ingresos > 0
      ? `${spentPct}% del ingreso`
      : undefined;
  // `ingresos`/`gastos` are RECURRING TEMPLATE totals (planned commitments),
  // not money that already moved — the caller passes
  // planData.recurring.totalMonthly*. The old copy said "Gastaste …", which
  // reported a plan as a fact and disagreed with the actual-spend totals on
  // Movimientos and Inicio. Keep the tense committed, not past.
  const verdictDetail =
    verdictState === "te-pasaste"
      ? neto < 0
        ? `Tus fijos superan tus ingresos recurrentes por ${formatCurrency(Math.abs(neto), currency)}.`
        : "Tus fijos consumen todo tu ingreso recurrente."
      : `Te quedan ${formatCurrency(neto, currency)} de tu ingreso recurrente tras los fijos.`;

  const { overlayVisible, handleOverlayClick } = useChartFocusMode(expanded);

  return (
    <>
      {overlayVisible && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={handleOverlayClick(() => setExpanded(false))}
        />
      )}

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? "Ocultar flujo del mes" : "Ver flujo del mes"}
        className={`relative z-50 w-full rounded-2xl border border-white/6 ${HERO_CARD_GRADIENT_CLASS} p-4 text-left transition-all`}
      >
        <div className="flex items-center justify-between mb-1">
          <p className={SECTION_EYEBROW_CLASS}>
            Neto recurrente del mes
          </p>
          <span className="text-[10px] text-muted-foreground">
            {daysRemaining} días restantes
          </span>
        </div>

        <p
          className={`text-3xl font-bold ${
            neto > 0 ? "text-z-income" : neto < 0 ? "text-z-expense" : "text-z-sage-light"
          }`}
        >
          {neto >= 0 ? "+" : ""}
          {formatCurrency(neto, currency)}
        </p>

        <div className="mt-2">
          <Verdict state={verdictState} delta={verdictDelta} detail={verdictDetail} />
        </div>

        {/* Stacked progress bar */}
        <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-z-surface-2">
          <div className="absolute inset-y-0 left-0 w-full rounded-full bg-z-income/80" />
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-z-expense/80"
            style={{ width: `${gastosRatio}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-z-brass/80"
            style={{ width: `${netoRatio}%` }}
          />
        </div>

        {/* Legend */}
        {/* flex-wrap: three amounts don't fit on one 375px line. */}
        <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-z-income" />
            Ingresos fijos {formatCurrency(ingresos, currency)}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-z-expense" />
            Gastos fijos {formatCurrency(gastos, currency)}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-z-brass" />
            Neto {formatCurrency(neto, currency)}
          </span>
        </div>

        {!expanded && (
          <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] font-medium text-z-brass">
            Toca para ver flujo
            <ChevronDown className="size-3" aria-hidden="true" />
          </p>
        )}

        {expanded && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <PlanFlowChart timelineData={timelineData} currency={currency} />
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] font-medium text-z-brass">
              Ocultar flujo
              <ChevronUp className="size-3" aria-hidden="true" />
            </p>
          </div>
        )}
      </button>
    </>
  );
}
