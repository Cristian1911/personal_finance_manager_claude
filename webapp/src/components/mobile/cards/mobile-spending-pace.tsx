"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronRight } from "lucide-react";
import type { BurnRateResponse } from "@/actions/burn-rate";
import { ExpandableCard } from "./expandable-card";

interface MobileSpendingPaceProps {
  data: BurnRateResponse;
}

export function MobileSpendingPace({ data }: MobileSpendingPaceProps) {
  const [expanded, setExpanded] = useState(false);

  const { discretionary, currency } = data;
  const { runwayDays, dailyAverage, dataPoints } = discretionary;
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const progress = Math.min((dayOfMonth / daysInMonth) * 100, 100);

  // Color based on runway vs remaining days
  const daysRemaining = daysInMonth - dayOfMonth;
  const isWarning = runwayDays < daysRemaining;
  const isCritical = runwayDays < daysRemaining * 0.5;

  return (
    <ExpandableCard
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      compact={
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs font-semibold",
              isCritical ? "text-z-debt" : isWarning ? "text-z-brass" : "text-z-sage-light"
            )}>
              Ritmo de gasto
            </span>
            <span className={cn(
              "text-[11px] font-semibold",
              isCritical ? "text-z-debt" : isWarning ? "text-z-brass" : "text-z-sage-light"
            )}>
              {Math.round(runwayDays)} días
            </span>
          </div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-white/5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isCritical
                  ? "bg-gradient-to-r from-z-brass to-z-debt"
                  : isWarning
                    ? "bg-gradient-to-r from-z-sage-light to-z-brass"
                    : "bg-z-sage-light"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-[10px] text-muted-foreground">
              Día {dayOfMonth} de {daysInMonth}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Toca para detalles ›
            </span>
          </div>
        </div>
      }
      detail={
        <div className="px-4 pb-3 pt-0">
          <p className="mb-2 text-xs font-semibold text-z-brass">Proyección de gasto</p>
          <RunwayChart
            dataPoints={dataPoints}
            runwayDays={runwayDays}
            dayOfMonth={dayOfMonth}
            daysInMonth={daysInMonth}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {isCritical ? (
              <>
                Si sigues gastando así, te pasas el{" "}
                <span className="font-semibold text-z-debt">
                  día {Math.min(dayOfMonth + Math.round(runwayDays), daysInMonth)}
                </span>
                . Reduce{" "}
                <span className="text-z-sage-light">
                  {formatCurrency(
                    dailyAverage - data.disponible / Math.max(daysRemaining, 1),
                    currency
                  )}
                  /día
                </span>{" "}
                para llegar al {daysInMonth}.
              </>
            ) : isWarning ? (
              <>
                Tu ritmo está un poco alto. Tienes margen para{" "}
                <span className="font-semibold text-z-brass">
                  {Math.round(runwayDays)} días
                </span>{" "}
                al ritmo actual.
              </>
            ) : (
              <>
                Vas bien — tu ritmo permite llegar al{" "}
                <span className="font-semibold text-z-sage-light">
                  día {daysInMonth}
                </span>{" "}
                con margen.
              </>
            )}
          </p>
          <Link
            href="/dashboard#burn-rate"
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-z-brass/20 bg-z-brass/8 px-3 py-2 text-[11px] font-semibold text-z-brass transition-colors hover:bg-z-brass/12"
          >
            Ver análisis completo <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      }
    />
  );
}

// ─── SVG Runway Chart ────────────────────────────────────────────────────────

function RunwayChart({
  dataPoints,
  runwayDays,
  dayOfMonth,
  daysInMonth,
}: {
  dataPoints: { date: string; balance: number }[];
  runwayDays: number;
  dayOfMonth: number;
  daysInMonth: number;
}) {
  const W = 280;
  const H = 90;
  const PAD = { top: 8, right: 10, bottom: 18, left: 10 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Normalize data points to current month
  const monthPoints = dataPoints.filter((dp) => {
    const day = new Date(dp.date).getDate();
    return day <= dayOfMonth;
  });

  if (monthPoints.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg bg-black/20 text-[11px] text-muted-foreground">
        Datos insuficientes para la proyección
      </div>
    );
  }

  // Find max balance for Y scaling
  const maxBalance = Math.max(...monthPoints.map((p) => p.balance));
  const scaleX = (day: number) => PAD.left + (day / daysInMonth) * plotW;
  const scaleY = (val: number) =>
    PAD.top + plotH - (val / (maxBalance * 1.1)) * plotH;

  // Ideal line: from day 1 max balance to day 30 zero
  const idealStart = { x: scaleX(1), y: scaleY(maxBalance) };
  const idealEnd = { x: scaleX(daysInMonth), y: scaleY(0) };

  // Actual spending path
  const actualPath = monthPoints
    .map((p, i) => {
      const day = new Date(p.date).getDate();
      const x = scaleX(day);
      const y = scaleY(p.balance);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  // Current position
  const lastPoint = monthPoints[monthPoints.length - 1];
  const lastDay = new Date(lastPoint.date).getDate();
  const cx = scaleX(lastDay);
  const cy = scaleY(lastPoint.balance);

  // Projected overshoot line
  const projectedEndDay = Math.min(lastDay + runwayDays, daysInMonth + 2);
  const projectedPath = `M${cx},${cy} L${scaleX(projectedEndDay)},${scaleY(0)}`;

  return (
    <div className="rounded-lg bg-black/20 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Gráfico de proyección de gasto">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={PAD.left}
            y1={scaleY(maxBalance * pct)}
            x2={W - PAD.right}
            y2={scaleY(maxBalance * pct)}
            stroke="#222"
            strokeWidth="0.5"
          />
        ))}

        {/* Ideal line (dashed, sage) */}
        <line
          x1={idealStart.x}
          y1={idealStart.y}
          x2={idealEnd.x}
          y2={idealEnd.y}
          stroke="#2a3a22"
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />

        {/* Actual spending path */}
        <path d={actualPath} fill="none" stroke="#d4a853" strokeWidth="2" strokeLinejoin="round" />

        {/* Current position dot */}
        <circle cx={cx} cy={cy} r="4" fill="#d4a853" />
        <circle cx={cx} cy={cy} r="6" fill="#d4a853" fillOpacity="0.2" />

        {/* Projected overshoot (dashed red) */}
        {runwayDays < daysInMonth - dayOfMonth && (
          <path d={projectedPath} fill="none" stroke="#c44" strokeWidth="1.5" strokeDasharray="3,2" />
        )}

        {/* X-axis labels */}
        <text x={PAD.left} y={H - 2} fill="#555" fontSize="7" fontFamily="system-ui">
          Día 1
        </text>
        <text x={scaleX(dayOfMonth)} y={H - 2} fill="#888" fontSize="7" fontFamily="system-ui" textAnchor="middle">
          Hoy ({dayOfMonth})
        </text>
        <text x={W - PAD.right} y={H - 2} fill="#555" fontSize="7" fontFamily="system-ui" textAnchor="end">
          {daysInMonth}
        </text>
      </svg>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        Línea ideal vs gasto real
      </p>
    </div>
  );
}
