"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  PANEL_INSET_CLASS,
} from "@/lib/constants/styles";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";

interface InicioBurndownProps {
  data: BurnRateResponse;
  totalBudget: number;
  currency: CurrencyCode;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compactCurrency(amount: number, currency: CurrencyCode): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return formatCurrency(amount, currency);
}

// ─── SVG Burndown Chart ──────────────────────────────────────────────────────

function BurndownChart({
  data,
  totalBudget,
  daysInMonth,
  currency,
}: {
  data: BurnRateResponse;
  totalBudget: number;
  daysInMonth: number;
  currency: CurrencyCode;
}) {
  const points = data.discretionary.dataPoints;
  const remaining = points.length > 0 ? points[points.length - 1].balance : 0;

  // Chart dimensions (inside viewBox 0 0 280 90)
  const chartLeft = 0;
  const chartRight = 280;
  const chartTop = 8;
  const chartBottom = 78;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  // Compute polyline from dataPoints (only current-month points, ignore projected zero)
  const monthPoints = useMemo(() => {
    const filtered = points.filter((p) => {
      const day = new Date(p.date).getDate();
      return day <= daysInMonth;
    });
    if (filtered.length === 0) return [];

    const maxBalance = Math.max(totalBudget, ...filtered.map((p) => p.balance));
    return filtered.map((p) => {
      const day = new Date(p.date).getDate();
      const x = chartLeft + (day / daysInMonth) * chartW;
      const y =
        chartTop + (1 - p.balance / (maxBalance || 1)) * chartH;
      return { x, y, day };
    });
  }, [points, totalBudget, daysInMonth, chartLeft, chartW, chartTop, chartH]);

  // Expected line: straight diagonal from (0, budget) to (daysInMonth, 0)
  const expectedStart = { x: chartLeft, y: chartTop };
  const expectedEnd = { x: chartRight, y: chartBottom };

  // Current point (last in series)
  const currentPt = monthPoints[monthPoints.length - 1];

  // Deviation from expected at current day
  const currentDay = currentPt?.day ?? 1;
  const expectedAtDay =
    totalBudget * (1 - currentDay / daysInMonth);
  const deviation = remaining - expectedAtDay;
  const isUnder = deviation >= 0;

  // Polyline string
  const polylineStr = monthPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Today's X position for label
  const todayX = currentPt?.x ?? chartW / 2;

  return (
    <svg
      viewBox="0 0 280 90"
      className="w-full"
      aria-label="Gráfico de quema de presupuesto"
    >
      {/* Axis lines */}
      <line
        x1={chartLeft}
        y1={chartBottom}
        x2={chartRight}
        y2={chartBottom}
        stroke="#2a2d28"
        strokeWidth={1}
      />
      <line
        x1={chartLeft}
        y1={chartTop}
        x2={chartLeft}
        y2={chartBottom}
        stroke="#2a2d28"
        strokeWidth={1}
      />

      {/* Expected line (brass dashed) */}
      <line
        x1={expectedStart.x}
        y1={expectedStart.y}
        x2={expectedEnd.x}
        y2={expectedEnd.y}
        stroke="var(--color-z-brass)"
        strokeWidth={1.5}
        strokeDasharray="6,4"
        opacity={0.6}
      />

      {/* Actual line (sage solid) */}
      {monthPoints.length > 1 && (
        <polyline
          points={polylineStr}
          fill="none"
          stroke="var(--color-z-income)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Current point */}
      {currentPt && (
        <>
          {/* Outer glow */}
          <circle
            cx={currentPt.x}
            cy={currentPt.y}
            r={8}
            fill="var(--color-z-income)"
            opacity={0.15}
          />
          {/* Inner dot */}
          <circle
            cx={currentPt.x}
            cy={currentPt.y}
            r={5}
            fill="var(--color-z-income)"
          />
        </>
      )}

      {/* Deviation badge */}
      {currentPt && (
        <g>
          <rect
            x={Math.min(currentPt.x + 8, 210)}
            y={currentPt.y - 10}
            rx={4}
            ry={4}
            width={60}
            height={16}
            fill={isUnder ? "var(--color-z-income)" : "var(--color-z-debt)"}
            opacity={0.15}
          />
          <text
            x={Math.min(currentPt.x + 38, 240)}
            y={currentPt.y + 1}
            textAnchor="middle"
            className="text-[8px] font-semibold"
            fill={isUnder ? "var(--color-z-income)" : "var(--color-z-debt)"}
          >
            {compactCurrency(Math.abs(deviation), currency)}{" "}
            {isUnder ? "bajo" : "sobre"}
          </text>
        </g>
      )}

      {/* X labels */}
      <text
        x={chartLeft + 2}
        y={chartBottom + 9}
        className="fill-muted-foreground text-[7px]"
      >
        1
      </text>
      <text
        x={todayX}
        y={chartBottom + 9}
        textAnchor="middle"
        className="fill-foreground text-[7px] font-semibold"
      >
        Hoy
      </text>
      <text
        x={chartRight - 2}
        y={chartBottom + 9}
        textAnchor="end"
        className="fill-muted-foreground text-[7px]"
      >
        {daysInMonth}
      </text>
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function InicioBurndown({
  data,
  totalBudget,
  currency,
}: InicioBurndownProps) {
  const { isActive, toggle } = useExpandableZone<"chart">();
  const expanded = isActive("chart");

  const points = data.discretionary.dataPoints;
  const remaining = points.length > 0 ? points[points.length - 1].balance : 0;
  const today = new Date();
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();

  // Compute rates
  const actualRate = data.discretionary.dailyAverage;
  const expectedRate = totalBudget / daysInMonth;

  return (
    <div className={cn(PANEL_INSET_CLASS, "px-3.5 py-3")}>
      {/* Header */}
      <div className="text-center">
        <p className="text-[24px] font-[680] leading-tight tracking-tight text-foreground">
          {formatCurrency(remaining, currency)}{" "}
          <span className="text-[12px] font-normal text-muted-foreground">
            restante
          </span>
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          de {formatCurrency(totalBudget, currency)} planeado
        </p>
      </div>

      {/* Chart (tappable) */}
      <button
        type="button"
        onClick={() => toggle("chart")}
        className="mt-2 w-full"
        aria-expanded={expanded}
        aria-label="Expandir detalle del gráfico"
      >
        <BurndownChart
          data={data}
          totalBudget={totalBudget}
          daysInMonth={daysInMonth}
          currency={currency}
        />
      </button>

      {/* Expandable detail */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-2 transition-opacity duration-150",
              expanded ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            <div
              className={cn(
                PANEL_INSET_CLASS,
                "border-white/8 bg-black/20 p-3 space-y-3"
              )}
            >
              {/* Rate comparison */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Ritmo actual</span>
                  <span className={cn(
                    "font-semibold",
                    actualRate <= expectedRate ? "text-z-income" : "text-z-expense"
                  )}>
                    {compactCurrency(actualRate, currency)}/día
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Ritmo esperado</span>
                  <span className="font-semibold text-z-sage-light">
                    {compactCurrency(expectedRate, currency)}/día
                  </span>
                </div>
              </div>

              {/* Action chips */}
              <div className="flex gap-2">
                <Link
                  href="/plan"
                  className="flex-1 rounded-xl bg-z-brass/8 border border-z-brass/20 px-3 py-2 text-center text-[11px] font-semibold text-z-brass transition-colors active:bg-z-brass/15"
                >
                  Ver plan
                </Link>
                <Link
                  href="/categories"
                  className="flex-1 rounded-xl bg-black/20 border border-white/8 px-3 py-2 text-center text-[11px] font-semibold text-z-sage-light transition-colors active:bg-white/[0.03]"
                >
                  Ver categorías
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
