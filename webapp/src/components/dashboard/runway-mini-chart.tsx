"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

/**
 * Hand-drawn SVG runway chart. Two modes:
 * - compact: small, no Y-axis, no tap (for BurndownExpandable)
 * - full: taller, Y-axis labels, tap-to-inspect (for InicioMetricsGrid)
 */

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

const parseDay = (date: string) => parseInt(date.split("-")[2], 10);

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

  // Window end: next income day or month end
  const windowEndDay = nextIncomeDate
    ? parseDay(nextIncomeDate)
    : daysInMonth;
  const effectiveEndDay = Math.max(windowEndDay, dayOfMonth + 1);

  const W = 280;
  const H = compact ? 64 : 100;
  const PAD = compact
    ? { top: 6, right: 10, bottom: 16, left: 10 }
    : { top: 8, right: 12, bottom: 20, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const monthPoints = dataPoints.filter((dp) => parseDay(dp.date) <= dayOfMonth);

  if (monthPoints.length < 2) {
    return (
      <div className="flex h-10 items-center justify-center rounded-lg border border-white/8 bg-black/20 text-[11px] text-muted-foreground">
        Datos insuficientes
      </div>
    );
  }

  const maxBalance = Math.max(...monthPoints.map((p) => p.balance));
  const scaleX = (day: number) =>
    PAD.left + ((day - 1) / Math.max(effectiveEndDay - 1, 1)) * plotW;
  const scaleY = (val: number) =>
    PAD.top + plotH - (val / ((maxBalance || 1) * 1.1)) * plotH;

  const actualPath = monthPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(parseDay(p.date))},${scaleY(p.balance)}`)
    .join(" ");

  const lastPoint = monthPoints[monthPoints.length - 1];
  const lastDay = parseDay(lastPoint.date);
  const cx = scaleX(lastDay);
  const cy = scaleY(lastPoint.balance);
  const projectedEndDay = Math.min(lastDay + runwayDays, effectiveEndDay);
  const daysRemaining = effectiveEndDay - dayOfMonth;

  // Y-axis ticks
  const yMid = Math.round(maxBalance / 2);

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;

    let nearest = monthPoints[0];
    let nearestDist = Infinity;
    for (const p of monthPoints) {
      const dist = Math.abs(scaleX(parseDay(p.date)) - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = p; }
    }

    if (nearestDist < 18) {
      const day = parseDay(nearest.date);
      setTooltip({ x: scaleX(day), y: scaleY(nearest.balance), date: nearest.date, balance: nearest.balance });
    } else {
      setTooltip(null);
    }
  }

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

        {/* Ideal decline line (to window end) */}
        <line
          x1={scaleX(1)} y1={scaleY(maxBalance)}
          x2={scaleX(effectiveEndDay)} y2={scaleY(0)}
          stroke="var(--z-olive-deep)" strokeWidth="1" strokeDasharray="4,3"
        />

        {/* Actual balance line */}
        <path d={actualPath} fill="none" stroke="var(--z-brass)" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Current dot */}
        <circle cx={cx} cy={cy} r={compact ? 2.5 : 4} fill="var(--z-brass)" />

        {/* Projected slope (if won't make it) */}
        {runwayDays < daysRemaining && (
          <path
            d={`M${cx},${cy} L${scaleX(projectedEndDay)},${scaleY(0)}`}
            fill="none" stroke="var(--z-debt)" strokeWidth="1" strokeDasharray="3,2"
          />
        )}

        {/* Obligation markers */}
        {obligations?.map((ob) => {
          const obDay = parseDay(ob.date);
          if (obDay <= dayOfMonth || obDay > effectiveEndDay) return null;
          return (
            <g key={`${ob.date}-${ob.name}`}>
              {!compact && (
                <line x1={scaleX(obDay)} y1={PAD.top} x2={scaleX(obDay)} y2={PAD.top + plotH}
                  stroke="var(--z-expense)" strokeWidth="0.5" strokeDasharray="2,2" opacity={0.25} />
              )}
              <circle cx={scaleX(obDay)} cy={scaleY(0) - 4} r="2" fill="var(--z-expense)" opacity={0.7} />
              {!compact && (
                <text x={scaleX(obDay)} y={PAD.top - 1} textAnchor="middle"
                  fill="var(--z-sage-dark)" fontSize="6" fontFamily="system-ui">
                  {ob.name.slice(0, 10)}
                </text>
              )}
            </g>
          );
        })}

        {/* Income date marker */}
        {nextIncomeDate && (() => {
          const incomeDay = parseDay(nextIncomeDate);
          if (incomeDay <= dayOfMonth) return null;
          return (
            <g key="next-income">
              {!compact && (
                <line x1={scaleX(incomeDay)} y1={PAD.top} x2={scaleX(incomeDay)} y2={PAD.top + plotH}
                  stroke="var(--z-income)" strokeWidth="0.5" strokeDasharray="2,2" opacity={0.3} />
              )}
              <circle cx={scaleX(incomeDay)} cy={scaleY(maxBalance * 0.85)} r={compact ? 2.5 : 3.5}
                fill="var(--z-income)" opacity={0.8} />
            </g>
          );
        })()}

        {/* Tooltip (full mode, on tap) */}
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
              {formatCurrency(tooltip.balance, currency)} · día {parseDay(tooltip.date)}
            </text>
          </g>
        )}

        {/* X-axis labels */}
        <text x={PAD.left} y={H - 2} fill="var(--z-sage-dark)" fontSize="8" fontFamily="system-ui">
          1
        </text>
        <text x={scaleX(dayOfMonth)} y={H - 2} fill="var(--z-sage-light)" fontSize="8"
          fontFamily="system-ui" textAnchor="middle">
          Hoy
        </text>
        <text
          x={Math.min(scaleX(effectiveEndDay), W - PAD.right)} y={H - 2}
          fill={nextIncomeDate ? "var(--z-income)" : "var(--z-sage-dark)"}
          fontSize="8" fontFamily="system-ui" textAnchor="end">
          {effectiveEndDay}
        </text>
      </svg>
    </div>
  );
}
