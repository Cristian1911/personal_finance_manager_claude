"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronDown } from "lucide-react";
import { PANEL_INSET_CLASS, MOBILE_ACTION_BUTTON_CLASS } from "@/lib/constants/styles";
import type { BurnRateResponse } from "@/actions/burn-rate";
import { RunwayMiniChart } from "./runway-mini-chart";

interface BurndownExpandableProps {
  data: BurnRateResponse;
  hasCriticalCategories: boolean;
}

export function BurndownExpandable({
  data,
  hasCriticalCategories,
}: BurndownExpandableProps) {
  const [expanded, setExpanded] = useState(false);
  const { discretionary, currency, disponible } = data;
  const { runwayDays, dailyAverage, dataPoints } = discretionary;

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();
  const daysRemaining = data.nextIncomeDate
    ? Math.max(1, Math.ceil(
        (new Date(data.nextIncomeDate + "T12:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : daysInMonth - dayOfMonth;
  const isCritical = runwayDays < daysRemaining * 0.5;
  const isWarning = runwayDays < daysRemaining;

  const stateLabel = isCritical
    ? "No llegas al cierre"
    : isWarning
      ? "Ajusta para cerrar"
      : "Ritmo bajo control";

  const stateColor = isCritical
    ? "text-z-debt"
    : isWarning
      ? "text-z-brass"
      : "text-z-sage-light";

  return (
    <div className={cn(PANEL_INSET_CLASS, "p-3")}>
      {/* Compact summary — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-3"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Quema de gasto
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("text-xl font-bold", stateColor)}>
              {Math.round(runwayDays)}d
            </span>
            <span className="text-xs text-muted-foreground">
              de margen al ritmo actual
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatCurrency(dailyAverage, currency)}/día ·{" "}
            <span className={stateColor}>{stateLabel}</span>
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded detail */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-3 space-y-3 transition-opacity duration-150",
              expanded ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {/* Mini chart */}
            <RunwayMiniChart
              dataPoints={dataPoints}
              runwayDays={runwayDays}
              dayOfMonth={dayOfMonth}
              daysInMonth={daysInMonth}
              obligations={data.obligations}
              nextIncomeDate={data.nextIncomeDate ?? null}
              compact
            />

            {/* Explanation */}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {isCritical ? (
                <>
                  Necesitas reducir{" "}
                  <span className="text-z-sage-light">
                    {formatCurrency(
                      dailyAverage -
                        disponible / Math.max(daysRemaining, 1),
                      currency
                    )}
                    /día
                  </span>{" "}
                  para llegar{data.nextIncomeDate ? " al próximo ingreso" : ` al día ${daysInMonth}`}.
                </>
              ) : isWarning ? (
                <>
                  Margen para{" "}
                  <span className="font-semibold text-z-brass">
                    {Math.round(runwayDays)} días
                  </span>{" "}
                  al ritmo actual.
                </>
              ) : (
                <>Vas bien — llegas {data.nextIncomeDate ? "al próximo ingreso" : "al cierre del mes"} con margen.</>
              )}
            </p>

            {/* Context-specific actions */}
            <div className="flex gap-2">
              {isWarning || isCritical ? (
                <>
                  <Link href="/plan" className={MOBILE_ACTION_BUTTON_CLASS}>
                    Ver próximos pagos
                  </Link>
                  {hasCriticalCategories && (
                    <Link
                      href="/categories"
                      className={MOBILE_ACTION_BUTTON_CLASS}
                    >
                      Ver categorías críticas
                    </Link>
                  )}
                </>
              ) : (
                <Link href="/plan" className={MOBILE_ACTION_BUTTON_CLASS}>
                  Planear excedente
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

