"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { StateChip } from "@/components/mobile/v2/state-chip";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import type { CurrencyCode, UpcomingRecurrence } from "@/types/domain";

interface PlanFlowChartProps {
  upcoming: UpcomingRecurrence[];
  currency: CurrencyCode;
  daysInMonth: number;
  dayOfMonth: number;
}

interface DayBar {
  day: number;
  income: number;
  expense: number;
}

export function PlanFlowChart({
  upcoming,
  currency,
  daysInMonth,
  dayOfMonth,
}: PlanFlowChartProps) {
  // Aggregate income/expenses by day
  const { dayBars, maxVal, paymentsBefore, totalIncome, totalExpense } = useMemo(() => {
    const dayMap = new Map<number, { income: number; expense: number }>();

    for (const item of upcoming) {
      const t = item.template;
      const day = parseInt(item.next_date.split("-")[2], 10);
      const entry = dayMap.get(day) ?? { income: 0, expense: 0 };
      if (t.direction === "INFLOW") {
        entry.income += t.amount;
      } else {
        entry.expense += t.amount;
      }
      dayMap.set(day, entry);
    }

    const bars: DayBar[] = Array.from(dayMap.entries())
      .map(([day, vals]) => ({ day, ...vals }))
      .sort((a, b) => a.day - b.day);

    let max = 0;
    let totIn = 0;
    let totOut = 0;
    for (const b of bars) {
      max = Math.max(max, b.income, b.expense);
      totIn += b.income;
      totOut += b.expense;
    }

    // Count expense events before first income event
    const firstIncomeDay = bars.find((b) => b.income > 0)?.day ?? daysInMonth;
    const pBefore = bars.filter(
      (b) => b.expense > 0 && b.day < firstIncomeDay
    ).length;

    return {
      dayBars: bars,
      maxVal: max || 1,
      paymentsBefore: pBefore,
      totalIncome: totIn,
      totalExpense: totOut,
    };
  }, [upcoming, daysInMonth]);

  if (dayBars.length === 0) {
    return (
      <MobileZone eyebrow="FLUJO DEL MES">
        <div className={cn(PANEL_INSET_CLASS, "py-8 text-center text-xs text-muted-foreground")}>
          Sin pagos o ingresos programados
        </div>
      </MobileZone>
    );
  }

  // Chart dimensions
  const W = 300;
  const H = 120;
  const padL = 35;
  const padR = 10;
  const padT = 10;
  const baseline = 65; // Y position of $0 line
  const barW = Math.min(14, (W - padL - padR) / (dayBars.length * 2.5));
  const scaleUp = (baseline - padT) / maxVal;
  const scaleDown = (H - baseline - 20) / maxVal; // 20px for labels

  // Position bars spread across width
  const usableW = W - padL - padR;
  const step = dayBars.length > 1 ? usableW / (dayBars.length - 1) : usableW / 2;

  // Today position
  const todayX = padL + ((dayOfMonth - 1) / (daysInMonth - 1)) * usableW;

  return (
    <MobileZone eyebrow="FLUJO DEL MES">
      <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold">Pagos e ingresos</span>
          {paymentsBefore > 0 && (
            <StateChip
              label={`${paymentsBefore} pago${paymentsBefore > 1 ? "s" : ""} antes del ingreso`}
              variant="warn"
            />
          )}
        </div>

        {/* Bar chart SVG */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
          {/* Baseline */}
          <line
            x1={padL}
            y1={baseline}
            x2={W - padR}
            y2={baseline}
            stroke="#2a2d28"
            strokeWidth="1"
          />

          {/* Y-axis labels */}
          <text x={padL - 4} y={padT + 4} fill="var(--z-sage-dark)" fontSize="7" textAnchor="end">
            {formatCurrency(maxVal, currency)}
          </text>
          <text x={padL - 4} y={baseline + 3} fill="var(--z-sage-dark)" fontSize="7" textAnchor="end">
            $0
          </text>

          {/* "Hoy" marker */}
          <line
            x1={todayX}
            y1={padT - 2}
            x2={todayX}
            y2={H - 14}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
            strokeDasharray="3,3"
          />

          {/* Bars */}
          {dayBars.map((bar, i) => {
            const x = padL + (dayBars.length > 1 ? i * step : usableW / 2);
            const isPast = bar.day < dayOfMonth;
            const isFuture = bar.day > dayOfMonth;

            return (
              <g key={bar.day}>
                {/* Income bar (UP from baseline) */}
                {bar.income > 0 && (
                  <rect
                    x={x - barW / 2}
                    y={baseline - bar.income * scaleUp}
                    width={barW}
                    height={bar.income * scaleUp}
                    rx={3}
                    fill="var(--z-income)"
                    opacity={isFuture ? 0.5 : 0.85}
                  />
                )}
                {/* Expense bar (DOWN from baseline) */}
                {bar.expense > 0 && (
                  <rect
                    x={x - barW / 2}
                    y={baseline}
                    width={barW}
                    height={bar.expense * scaleDown}
                    rx={3}
                    fill="var(--z-debt)"
                    opacity={isFuture ? 0.45 : 0.75}
                  />
                )}
                {/* Day label */}
                <text
                  x={x}
                  y={H - 4}
                  fill={bar.day === dayOfMonth ? "var(--z-sage-light)" : "var(--z-sage-dark)"}
                  fontSize="7"
                  fontWeight={bar.day === dayOfMonth ? "600" : "400"}
                  textAnchor="middle"
                >
                  {bar.day === dayOfMonth ? "Hoy" : bar.day}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-1 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-[7px] rounded-full bg-z-income" />
            Ingreso {formatCurrency(totalIncome, currency)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-[7px] rounded-full bg-z-debt" />
            Gasto {formatCurrency(totalExpense, currency)}
          </span>
        </div>
      </div>
    </MobileZone>
  );
}
