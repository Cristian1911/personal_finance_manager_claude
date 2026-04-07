"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type { CurrencyCode } from "@/types/domain";

interface PlanFlowChartProps {
  timelineData: PlanTimelineData;
  currency: CurrencyCode;
}

// SVG dimensions
const W = 360;
const H = 180;
const BASELINE_Y = 90;
const PAD_L = 32;
const PAD_R = 10;
const PAD_T = 15;
const USABLE_W = W - PAD_L - PAD_R; // 318

function dayX(day: number, daysInMonth: number): number {
  return PAD_L + ((day - 1) / Math.max(daysInMonth - 1, 1)) * USABLE_W;
}

export function PlanFlowChart({ timelineData, currency }: PlanFlowChartProps) {
  const {
    days,
    cumulativeBalance,
    totalIncome,
    totalExpense,
    dangerZone,
    daysInMonth,
    dayOfMonth,
  } = timelineData;

  const chart = useMemo(() => {
    if (days.length === 0) return null;

    // Max bar value for scaling
    let maxVal = 1;
    for (const d of days) {
      maxVal = Math.max(maxVal, d.income, d.expense);
    }

    // Max absolute balance value for balance polyline scaling
    let maxAbsBalance = 1;
    for (const pt of cumulativeBalance) {
      maxAbsBalance = Math.max(maxAbsBalance, Math.abs(pt.balance));
    }

    const barW = Math.min(12, USABLE_W / (days.length * 2.5));
    const scaleUp = (BASELINE_Y - PAD_T) / maxVal;
    const scaleDown = (H - BASELINE_Y - 30) / maxVal;

    // Balance Y scale: centered on BASELINE_Y
    const balanceRange = Math.min(BASELINE_Y - PAD_T, H - BASELINE_Y - 30);
    const balanceScale = balanceRange / maxAbsBalance;

    // Build bar elements
    const barElements: Array<{
      key: number;
      x: number;
      day: number;
      income: number;
      expense: number;
      isReal: boolean;
      incomeH: number;
      expenseH: number;
      barW: number;
    }> = [];

    for (const d of days) {
      const x = dayX(d.day, daysInMonth);
      barElements.push({
        key: d.day,
        x,
        day: d.day,
        income: d.income,
        expense: d.expense,
        isReal: d.isReal,
        incomeH: d.income * scaleUp,
        expenseH: d.expense * scaleDown,
        barW,
      });
    }

    // Build cumulative balance polyline points
    const balancePoints: Array<{ x: number; y: number; day: number }> = [];
    for (const pt of cumulativeBalance) {
      const x = dayX(pt.day, daysInMonth);
      const y = BASELINE_Y - pt.balance * balanceScale;
      balancePoints.push({ x, y, day: pt.day });
    }

    // Split balance points into past/future
    const pastBalancePoints = balancePoints.filter(
      (p) => p.day <= dayOfMonth
    );
    const futureBalancePoints = balancePoints.filter(
      (p) => p.day >= dayOfMonth
    );

    // Grid lines (3 horizontal lines above and below baseline)
    const gridYPositions = [
      PAD_T,
      PAD_T + (BASELINE_Y - PAD_T) / 2,
      BASELINE_Y + (H - BASELINE_Y - 30) / 2,
      H - 30,
    ];

    // Day labels: day 1, every 5th, and last day
    const todayX = dayX(dayOfMonth, daysInMonth);
    const dayLabels: Array<{ day: number; x: number }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const isFirst = d === 1;
      const isLast = d === daysInMonth;
      const isFifth = d % 5 === 0;
      if (isFirst || isLast || isFifth) {
        // Skip if too close to "Hoy" marker
        const dx = dayX(d, daysInMonth);
        if (Math.abs(dx - todayX) > 12 || d === dayOfMonth) {
          if (d !== dayOfMonth) {
            dayLabels.push({ day: d, x: dx });
          }
        }
      }
    }

    // Danger zone X range
    let dangerRect: {
      x: number;
      width: number;
    } | null = null;
    if (dangerZone) {
      const x1 = dayX(dangerZone.startDay, daysInMonth);
      const x2 = dayX(dangerZone.endDay, daysInMonth);
      dangerRect = {
        x: x1 - barW / 2,
        width: x2 - x1 + barW,
      };
    }

    return {
      barElements,
      pastBalancePoints,
      futureBalancePoints,
      gridYPositions,
      dayLabels,
      todayX,
      maxVal,
      dangerRect,
    };
  }, [days, cumulativeBalance, daysInMonth, dayOfMonth, dangerZone]);

  // Empty state
  if (days.length === 0 || !chart) {
    return (
      <MobileZone eyebrow="FLUJO DEL MES">
        <div
          className={cn(
            PANEL_INSET_CLASS,
            "py-8 text-center text-xs text-muted-foreground"
          )}
        >
          Sin pagos o ingresos en este mes
        </div>
      </MobileZone>
    );
  }

  const {
    barElements,
    pastBalancePoints,
    futureBalancePoints,
    gridYPositions,
    dayLabels,
    todayX,
    maxVal,
    dangerRect,
  } = chart;

  const net = totalIncome - totalExpense;

  const pastBalancePath =
    pastBalancePoints.length > 1
      ? pastBalancePoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
      : "";

  const futureBalancePath =
    futureBalancePoints.length > 1
      ? futureBalancePoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
      : "";

  return (
    <MobileZone eyebrow="FLUJO DEL MES">
      <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
        {/* SVG chart */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 180 }}
        >
          <defs>
            {dangerRect && (
              <linearGradient
                id="dangerGrad"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="transparent" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
              </linearGradient>
            )}
          </defs>

          {/* Grid lines */}
          {gridYPositions.map((y) => (
            <line
              key={y}
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="1"
            />
          ))}

          {/* ZERO LINE (brass) */}
          <line
            x1={PAD_L}
            y1={BASELINE_Y}
            x2={W - PAD_R}
            y2={BASELINE_Y}
            stroke="var(--z-brass)"
            strokeWidth="1.5"
            strokeOpacity="0.4"
          />
          <text
            x={PAD_L - 4}
            y={BASELINE_Y + 3}
            fill="var(--z-brass)"
            fontSize="7"
            textAnchor="end"
            fontWeight="500"
          >
            $0
          </text>

          {/* Y-axis max label */}
          <text
            x={PAD_L - 4}
            y={PAD_T + 4}
            fill="var(--z-sage-dark)"
            fontSize="7"
            textAnchor="end"
          >
            {formatCurrency(maxVal, currency)}
          </text>

          {/* Danger zone rect */}
          {dangerRect && (
            <rect
              x={dangerRect.x}
              y={BASELINE_Y}
              width={dangerRect.width}
              height={H - BASELINE_Y - 30}
              fill="url(#dangerGrad)"
              rx="2"
            />
          )}

          {/* Today marker */}
          <line
            x1={todayX}
            y1={PAD_T - 2}
            x2={todayX}
            y2={H - 18}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            strokeDasharray="4,3"
          />
          <text
            x={todayX}
            y={H - 8}
            fill="var(--z-sage-light)"
            fontSize="7"
            fontWeight="600"
            textAnchor="middle"
          >
            Hoy
          </text>

          {/* Bars */}
          {barElements.map((bar) => {
            const isPast = bar.isReal || bar.day <= dayOfMonth;
            return (
              <g key={bar.key}>
                {/* Income bar (UP from baseline) */}
                {bar.income > 0 && (
                  <rect
                    x={bar.x - bar.barW / 2}
                    y={BASELINE_Y - bar.incomeH}
                    width={bar.barW}
                    height={bar.incomeH}
                    rx={3}
                    fill="var(--z-income)"
                    opacity={isPast ? 0.85 : 0.35}
                    stroke={isPast ? "none" : "var(--z-income)"}
                    strokeWidth={isPast ? 0 : 0.5}
                    strokeDasharray={isPast ? "none" : "2,2"}
                    strokeOpacity={isPast ? 0 : 0.6}
                  />
                )}
                {/* Expense bar (DOWN from baseline) */}
                {bar.expense > 0 && (
                  <rect
                    x={bar.x - bar.barW / 2}
                    y={BASELINE_Y}
                    width={bar.barW}
                    height={bar.expenseH}
                    rx={3}
                    fill="var(--z-debt)"
                    opacity={isPast ? 0.75 : 0.35}
                    stroke={isPast ? "none" : "var(--z-debt)"}
                    strokeWidth={isPast ? 0 : 0.5}
                    strokeDasharray={isPast ? "none" : "2,2"}
                    strokeOpacity={isPast ? 0 : 0.6}
                  />
                )}
              </g>
            );
          })}

          {/* Cumulative balance polyline — past (solid) */}
          {pastBalancePath && (
            <path
              d={pastBalancePath}
              fill="none"
              stroke="var(--z-brass)"
              strokeWidth="1.5"
              opacity="0.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Cumulative balance polyline — future (dashed) */}
          {futureBalancePath && (
            <path
              d={futureBalancePath}
              fill="none"
              stroke="var(--z-brass)"
              strokeWidth="1.5"
              opacity="0.5"
              strokeDasharray="4,3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Day labels */}
          {dayLabels.map((lbl) => (
            <text
              key={lbl.day}
              x={lbl.x}
              y={H - 8}
              fill="var(--z-sage-dark)"
              fontSize="7"
              textAnchor="middle"
            >
              {lbl.day}
            </text>
          ))}
        </svg>

        {/* Summary row */}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex-1 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-z-sage-dark">
              Ingresos
            </p>
            <p
              className="mt-0.5 text-[13px] font-semibold tabular-nums"
              style={{ color: "var(--z-income)" }}
            >
              {formatCurrency(totalIncome, currency)}
            </p>
          </div>

          <div className="h-6 w-px bg-white/6" />

          <div className="flex-1 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-z-sage-dark">
              Gastos
            </p>
            <p
              className="mt-0.5 text-[13px] font-semibold tabular-nums"
              style={{ color: "var(--z-debt)" }}
            >
              {formatCurrency(totalExpense, currency)}
            </p>
          </div>

          <div className="h-6 w-px bg-white/6" />

          <div className="flex-1 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-z-sage-dark">
              Neto
            </p>
            <p
              className="mt-0.5 text-[13px] font-semibold tabular-nums"
              style={{ color: net >= 0 ? "var(--z-brass)" : "var(--z-debt)" }}
            >
              {formatCurrency(net, currency)}
            </p>
          </div>
        </div>

        {/* Danger zone warning chip */}
        {dangerZone && (
          <div className="mt-2.5 rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2 text-center">
            <p className="text-[11px] font-medium text-red-400">
              Saldo negativo proyectado del {dangerZone.startDay} al{" "}
              {dangerZone.endDay} de este mes
            </p>
          </div>
        )}
      </div>
    </MobileZone>
  );
}
