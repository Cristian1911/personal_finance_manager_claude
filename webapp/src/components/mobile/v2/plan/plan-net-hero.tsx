"use client";

import { useState } from "react";
import { useChartFocusMode } from "@/hooks/use-chart-focus-mode";
import { PlanFlowChart } from "./plan-flow-chart";
import { formatCurrency } from "@/lib/utils/currency";
import { HERO_CARD_GRADIENT_CLASS } from "@/lib/constants/styles";
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
        className={`relative z-50 w-full rounded-2xl border border-white/6 ${HERO_CARD_GRADIENT_CLASS} p-4 text-left transition-all`}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            Neto del mes
          </p>
          <span className="text-[10px] text-muted-foreground">
            {daysRemaining} días restantes
          </span>
        </div>

        <p className="text-3xl font-bold text-z-brass">
          {neto >= 0 ? "+" : ""}
          {formatCurrency(neto, currency)}
        </p>

        {/* Stacked progress bar */}
        <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-z-surface-2">
          <div className="absolute inset-y-0 left-0 w-full rounded-full bg-emerald-500/80" />
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-red-500/80"
            style={{ width: `${gastosRatio}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-z-brass/80"
            style={{ width: `${netoRatio}%` }}
          />
        </div>

        {/* Legend */}
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            Ingresos {formatCurrency(ingresos, currency)}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-red-500" />
            Gastos {formatCurrency(gastos, currency)}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-1.5 rounded-full bg-z-brass" />
            Neto
          </span>
        </div>

        {!expanded && (
          <p className="mt-3 text-center text-[11px] text-z-brass/50">
            Toca para ver flujo ↓
          </p>
        )}

        {expanded && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <PlanFlowChart timelineData={timelineData} currency={currency} />
            <p
              className="mt-2 text-center text-[11px] text-z-brass cursor-pointer"
              onClick={() => setExpanded(false)}
            >
              Ocultar flujo ↑
            </p>
          </div>
        )}
      </button>
    </>
  );
}
