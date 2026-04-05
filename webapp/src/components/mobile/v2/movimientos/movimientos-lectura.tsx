"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode, Transaction } from "@/types/domain";

interface MovimientosLecturaProps {
  count: number;
  totalInflow: number;
  totalOutflow: number;
  transactions: Transaction[];
  currency: CurrencyCode;
  expanded: boolean;
  onToggle: () => void;
}

// ─── Aggregate transactions by week ──────────────────────────────────────────

interface DayData {
  label: string;
  day: number;
  income: number;
  expense: number;
}

function aggregateByDay(transactions: Transaction[]): DayData[] {
  if (transactions.length === 0) return [];

  // Aggregate per calendar day
  const dayMap = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    if (tx.is_excluded) continue;
    const date = tx.transaction_date; // "YYYY-MM-DD"
    const entry = dayMap.get(date) ?? { income: 0, expense: 0 };
    if (tx.direction === "INFLOW") {
      entry.income += tx.amount;
    } else {
      entry.expense += tx.amount;
    }
    dayMap.set(date, entry);
  }

  // Sort by date, keep all days that have data
  const sorted = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  const today = new Date().toISOString().split("T")[0];

  return sorted.map(([date, vals]) => {
    const dayNum = parseInt(date.split("-")[2], 10);
    const monthNum = parseInt(date.split("-")[1], 10);
    const isToday = date === today;
    return {
      label: isToday ? "Hoy" : `${dayNum}/${monthNum}`,
      day: dayNum,
      income: vals.income,
      expense: vals.expense,
    };
  });
}

// ─── SVG chart ───────────────────────────────────────────────────────────────

function toPolyline(
  values: number[],
  maxVal: number,
  width: number,
  height: number,
  padY = 12
): string {
  if (values.length === 0) return "";
  const padX = 15;
  const usableW = width - padX * 2;
  const step = values.length > 1 ? usableW / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = padX + i * step;
      const y = padY + (1 - v / Math.max(maxVal, 1)) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function FlowChart({ days }: { days: DayData[] }) {
  const W = 260;
  const H = 80;

  const incomeVals = days.map((d) => d.income);
  const expenseVals = days.map((d) => d.expense);
  const maxVal = Math.max(...incomeVals, ...expenseVals, 1);

  const lastIdx = days.length - 1;
  const padX = 15;
  const usableW = W - padX * 2;
  const step = days.length > 1 ? usableW / (days.length - 1) : 0;
  const todayX = padX + lastIdx * step;

  if (days.length === 0) {
    return (
      <div className="mt-3 flex h-16 items-center justify-center rounded-xl border border-white/6 bg-black/10 text-[11px] text-muted-foreground">
        Sin datos
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        aria-label="Ingresos vs Gastos por semana"
      >
        {/* Income line (sage, solid) */}
        <polyline
          points={toPolyline(incomeVals, maxVal, W, H)}
          fill="none"
          stroke="var(--color-z-income)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Expense line (brass, dashed) */}
        <polyline
          points={toPolyline(expenseVals, maxVal, W, H)}
          fill="none"
          stroke="var(--color-z-brass)"
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current point on income line */}
        {(() => {
          const y =
            12 +
            (1 - incomeVals[lastIdx] / Math.max(maxVal, 1)) * (H - 24);
          return (
            <>
              <circle cx={todayX} cy={y} r="4" fill="var(--color-z-income)" />
              <circle
                cx={todayX}
                cy={y}
                r="7"
                fill="var(--color-z-income)"
                opacity="0.12"
              />
            </>
          );
        })()}
        {/* "Hoy" marker */}
        <line
          x1={todayX}
          y1="4"
          x2={todayX}
          y2={H - 4}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>

      {/* Day labels — show first, last, and a few in between to avoid crowding */}
      <div className="flex justify-between px-1">
        {days.map((d, i) => {
          // Show label for first, last, and every ~5th day
          const showLabel = i === 0 || i === lastIdx || (days.length > 5 && i % Math.ceil(days.length / 4) === 0);
          if (!showLabel) return <span key={d.label} />;
          return (
            <span
              key={d.label}
              className={cn(
                "text-[8px] font-medium",
                d.label === "Hoy"
                  ? "font-semibold text-z-brass"
                  : "text-muted-foreground"
              )}
            >
              {d.label}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4">
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="inline-block size-[6px] rounded-full bg-z-income" />
          Ingresos
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="inline-block h-[2px] w-3 rounded-full border-t-2 border-dashed border-z-brass" />
          Gastos
        </span>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MovimientosLectura({
  count,
  totalInflow,
  totalOutflow,
  transactions,
  currency,
  expanded,
  onToggle,
}: MovimientosLecturaProps) {
  const days = useMemo(() => aggregateByDay(transactions), [transactions]);

  return (
    <MobileZone eyebrow="LECTURA">
      {/* Whole card is clickable to expand */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full text-left rounded-2xl border border-white/6 bg-black/10 p-3 transition-colors",
          expanded && "ring-1 ring-z-brass/30 bg-z-brass/[0.04]"
        )}
        aria-expanded={expanded}
      >
        <p className="mb-2 text-[13px] font-semibold">Resumen del mes</p>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Movimientos
            </p>
            <p className="mt-1 text-[20px] font-bold leading-tight">{count}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Ingresos
            </p>
            <p className="mt-1 text-[20px] font-bold leading-tight text-z-income">
              {formatCurrency(totalInflow, currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Gastos
            </p>
            <p className="mt-1 text-[20px] font-bold leading-tight">
              {formatCurrency(totalOutflow, currency)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] font-medium text-z-brass">
          {expanded ? "▴ Colapsar" : "▾ Ver flujo por día"}
        </p>
      </button>

      {/* Expanded: weekly flow chart with real data */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={cn("mt-1.5 transition-opacity duration-150", expanded ? "opacity-100 delay-75" : "opacity-0")}>
            <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3")}>
              <FlowChart days={days} />
            </div>
          </div>
        </div>
      </div>
    </MobileZone>
  );
}
