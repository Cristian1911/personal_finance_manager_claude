"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export interface RunwayMiniChartProps {
  dataPoints: { date: string; balance: number }[];
  runwayDays: number;
  dayOfMonth: number;
  daysInMonth: number;
  obligations?: { date: string; name: string; amount: number }[];
  nextIncomeDate?: string | null;
  currency?: CurrencyCode;
  compact?: boolean;
}

function compactAmount(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

/** Days between two ISO date strings (positive if b > a) */
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86_400_000
  );
}

/** Format "d MMM" from ISO date */
function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export function RunwayMiniChart({
  dataPoints,
  runwayDays,
  dayOfMonth,
  daysInMonth,
  obligations,
  nextIncomeDate,
  currency = "COP",
  compact = false,
}: RunwayMiniChartProps) {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; date: string; balance: number;
  } | null>(null);

  if (dataPoints.length < 2) {
    return (
      <div className="flex h-10 items-center justify-center rounded-lg border border-white/8 bg-black/20 text-[11px] text-muted-foreground">
        Datos insuficientes
      </div>
    );
  }

  // Use first data point as origin for X-axis (absolute date math, cross-month safe)
  const originDate = dataPoints[0].date;
  const todayOffset = daysBetween(originDate, dataPoints.find((_, i, arr) => {
    const dayNum = parseInt(arr[i].date.split("-")[2], 10);
    return dayNum === dayOfMonth;
  })?.date ?? dataPoints[dataPoints.length - 1].date);

  // Window end in offset space
  const windowEndOffset = nextIncomeDate
    ? daysBetween(originDate, nextIncomeDate)
    : daysBetween(originDate, originDate) + daysInMonth - 1;
  const effectiveEndOffset = Math.max(windowEndOffset, todayOffset + 1);

  // Only show actual (past) points up to today
  const pastPoints = dataPoints.filter((dp) => daysBetween(originDate, dp.date) <= todayOffset);
  if (pastPoints.length < 2) {
    return (
      <div className="flex h-10 items-center justify-center rounded-lg border border-white/8 bg-black/20 text-[11px] text-muted-foreground">
        Datos insuficientes
      </div>
    );
  }

  const W = 280;
  const H = compact ? 64 : 100;
  const PAD = compact
    ? { top: 6, right: 10, bottom: 16, left: 10 }
    : { top: 8, right: 12, bottom: 20, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxBalance = Math.max(...pastPoints.map((p) => p.balance));
  const scaleX = (offset: number) =>
    PAD.left + (offset / Math.max(effectiveEndOffset, 1)) * plotW;
  const scaleY = (val: number) =>
    PAD.top + plotH - (val / ((maxBalance || 1) * 1.1)) * plotH;

  const actualPath = pastPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(daysBetween(originDate, p.date))},${scaleY(p.balance)}`)
    .join(" ");

  const lastPoint = pastPoints[pastPoints.length - 1];
  const lastOffset = daysBetween(originDate, lastPoint.date);
  const cx = scaleX(lastOffset);
  const cy = scaleY(lastPoint.balance);
  const projectedEndOffset = Math.min(lastOffset + runwayDays, effectiveEndOffset);
  const daysRemaining = effectiveEndOffset - todayOffset;

  // Y-axis ticks
  const yMid = Math.round(maxBalance / 2);

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;

    let nearest = pastPoints[0];
    let nearestDist = Infinity;
    for (const p of pastPoints) {
      const dist = Math.abs(scaleX(daysBetween(originDate, p.date)) - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = p; }
    }

    if (nearestDist < 18) {
      const off = daysBetween(originDate, nearest.date);
      setTooltip({ x: scaleX(off), y: scaleY(nearest.balance), date: nearest.date, balance: nearest.balance });
    } else {
      setTooltip(null);
    }
  }

  // X-axis end label
  const endLabel = nextIncomeDate ? shortDate(nextIncomeDate) : String(daysInMonth);

  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-label="Proyección de gasto"
        onMouseMove={compact ? undefined : handlePointer}
        onMouseLeave={compact ? undefined : () => setTooltip(null)}
        onClick={compact ? undefined : handlePointer}
        style={compact ? undefined : { cursor: "crosshair" }}
      >
        {/* Y-axis labels (full mode) */}
        {!compact && (
          <>
            <text x={PAD.left - 4} y={scaleY(maxBalance) + 3} textAnchor="end"
              fill="var(--z-sage-dark)" fontSize="7" fontFamily="system-ui">
              {compactAmount(maxBalance)}
            </text>
            <line x1={PAD.left} y1={scaleY(yMid)} x2={PAD.left + plotW} y2={scaleY(yMid)}
              stroke="var(--z-olive-deep)" strokeWidth="0.5" strokeDasharray="2,3" opacity={0.4} />
            <text x={PAD.left - 4} y={scaleY(yMid) + 3} textAnchor="end"
              fill="var(--z-sage-dark)" fontSize="7" fontFamily="system-ui">
              {compactAmount(yMid)}
            </text>
            <text x={PAD.left - 4} y={scaleY(0) + 3} textAnchor="end"
              fill="var(--z-sage-dark)" fontSize="7" fontFamily="system-ui">
              $0
            </text>
          </>
        )}

        {/* Ideal decline line */}
        <line
          x1={scaleX(0)} y1={scaleY(maxBalance)}
          x2={scaleX(effectiveEndOffset)} y2={scaleY(0)}
          stroke="var(--z-olive-deep)" strokeWidth="1" strokeDasharray="4,3"
        />

        {/* Actual balance line */}
        <path d={actualPath} fill="none" stroke="var(--z-brass)" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Current dot */}
        <circle cx={cx} cy={cy} r={compact ? 2.5 : 4} fill="var(--z-brass)" />

        {/* Projected slope */}
        {runwayDays < daysRemaining && (
          <path
            d={`M${cx},${cy} L${scaleX(projectedEndOffset)},${scaleY(0)}`}
            fill="none" stroke="var(--z-debt)" strokeWidth="1" strokeDasharray="3,2"
          />
        )}

        {/* Obligation markers */}
        {obligations?.map((ob) => {
          const obOffset = daysBetween(originDate, ob.date);
          if (obOffset <= todayOffset || obOffset > effectiveEndOffset) return null;
          return (
            <g key={`${ob.date}-${ob.name}`}>
              {!compact && (
                <line x1={scaleX(obOffset)} y1={PAD.top} x2={scaleX(obOffset)} y2={PAD.top + plotH}
                  stroke="var(--z-expense)" strokeWidth="0.5" strokeDasharray="2,2" opacity={0.25} />
              )}
              <circle cx={scaleX(obOffset)} cy={scaleY(0) - 4} r="2" fill="var(--z-expense)" opacity={0.7} />
              {!compact && (
                <text x={scaleX(obOffset)} y={PAD.top - 1} textAnchor="middle"
                  fill="var(--z-sage-dark)" fontSize="6" fontFamily="system-ui">
                  {ob.name.slice(0, 10)}
                </text>
              )}
            </g>
          );
        })}

        {/* Income date marker */}
        {nextIncomeDate && (() => {
          const incomeOffset = daysBetween(originDate, nextIncomeDate);
          if (incomeOffset <= todayOffset) return null;
          return (
            <g key="next-income">
              {!compact && (
                <line x1={scaleX(incomeOffset)} y1={PAD.top} x2={scaleX(incomeOffset)} y2={PAD.top + plotH}
                  stroke="var(--z-income)" strokeWidth="0.5" strokeDasharray="2,2" opacity={0.3} />
              )}
              <circle cx={scaleX(incomeOffset)} cy={scaleY(maxBalance * 0.85)} r={compact ? 2.5 : 3.5}
                fill="var(--z-income)" opacity={0.8} />
            </g>
          );
        })()}

        {/* Tooltip */}
        {tooltip && !compact && (
          <g>
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + plotH}
              stroke="var(--z-brass)" strokeWidth="0.5" opacity={0.5} />
            <circle cx={tooltip.x} cy={tooltip.y} r="5" fill="var(--z-brass)" opacity={0.25} />
            <circle cx={tooltip.x} cy={tooltip.y} r="2.5" fill="var(--z-brass)" />
            <rect
              x={Math.min(Math.max(tooltip.x - 40, 2), W - 82)}
              y={Math.max(tooltip.y - 26, 2)}
              rx={4} width={80} height={18}
              fill="rgba(0,0,0,0.8)" stroke="var(--z-brass)" strokeWidth="0.5" strokeOpacity={0.3}
            />
            <text
              x={Math.min(Math.max(tooltip.x, 42), W - 42)}
              y={Math.max(tooltip.y - 14, 14)}
              textAnchor="middle" fill="var(--z-sage-light)" fontSize="7.5" fontFamily="system-ui">
              {formatCurrency(tooltip.balance, currency)} · {shortDate(tooltip.date)}
            </text>
          </g>
        )}

        {/* X-axis labels */}
        <text x={PAD.left} y={H - 2} fill="var(--z-sage-dark)" fontSize="8" fontFamily="system-ui">
          1
        </text>
        <text x={scaleX(todayOffset)} y={H - 2} fill="var(--z-sage-light)" fontSize="8"
          fontFamily="system-ui" textAnchor="middle">
          Hoy
        </text>
        <text
          x={Math.min(scaleX(effectiveEndOffset), W - PAD.right)} y={H - 2}
          fill={nextIncomeDate ? "var(--z-income)" : "var(--z-sage-dark)"}
          fontSize="8" fontFamily="system-ui" textAnchor="end">
          {endLabel}
        </text>
      </svg>
    </div>
  );
}
