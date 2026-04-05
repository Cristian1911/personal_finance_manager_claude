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

interface WeekData {
  label: string;
  income: number;
  expense: number;
}

function aggregateByWeek(transactions: Transaction[]): WeekData[] {
  const weekMap = new Map<number, { income: number; expense: number }>();

  for (const tx of transactions) {
    if (tx.is_excluded) continue;
    const day = parseInt(tx.transaction_date.split("-")[2], 10);
    const week = Math.min(Math.ceil(day / 7), 5); // weeks 1-5
    const entry = weekMap.get(week) ?? { income: 0, expense: 0 };
    if (tx.direction === "INFLOW") {
      entry.income += tx.amount;
    } else {
      entry.expense += tx.amount;
    }
    weekMap.set(week, entry);
  }

  const now = new Date();
  const currentDay = now.getDate();
  const currentWeek = Math.min(Math.ceil(currentDay / 7), 5);

  const weeks: WeekData[] = [];
  for (let w = 1; w <= Math.max(currentWeek, 1); w++) {
    const data = weekMap.get(w) ?? { income: 0, expense: 0 };
    weeks.push({
      label: w === currentWeek ? "Hoy" : `S${w}`,
      income: data.income,
      expense: data.expense,
    });
  }

  return weeks;
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

function FlowChart({ weeks }: { weeks: WeekData[] }) {
  const W = 260;
  const H = 80;

  const incomeVals = weeks.map((w) => w.income);
  const expenseVals = weeks.map((w) => w.expense);
  const maxVal = Math.max(...incomeVals, ...expenseVals, 1);

  const lastIdx = weeks.length - 1;
  const padX = 15;
  const usableW = W - padX * 2;
  const step = weeks.length > 1 ? usableW / (weeks.length - 1) : 0;
  const todayX = padX + lastIdx * step;

  if (weeks.length < 2) {
    return (
      <div className="mt-3 flex h-16 items-center justify-center rounded-xl border border-white/6 bg-black/10 text-[11px] text-muted-foreground">
        Datos insuficientes
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

      {/* Week labels */}
      <div className="flex justify-between px-1">
        {weeks.map((w) => (
          <span
            key={w.label}
            className={cn(
              "text-[9px] font-medium uppercase tracking-wider",
              w.label === "Hoy"
                ? "font-semibold text-z-brass"
                : "text-muted-foreground"
            )}
          >
            {w.label}
          </span>
        ))}
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
  const weeks = useMemo(() => aggregateByWeek(transactions), [transactions]);

  return (
    <MobileZone eyebrow="LECTURA" heading="Resumen del mes">
      {/* 3-column summary grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className={cn(PANEL_INSET_CLASS, "p-2.5 text-center")}>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Movimientos
          </p>
          <p className="mt-1 text-[22px] font-bold leading-tight">{count}</p>
          <p className="text-[9px] text-muted-foreground">visibles</p>
        </div>

        <div className={cn(PANEL_INSET_CLASS, "p-2.5 text-center")}>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ingresos
          </p>
          <p className="mt-1 text-[22px] font-bold leading-tight text-z-income">
            {formatCurrency(totalInflow, currency)}
          </p>
          <p className="text-[9px] text-muted-foreground">en vista</p>
        </div>

        <div className={cn(PANEL_INSET_CLASS, "p-2.5 text-center")}>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Gastos
          </p>
          <p className="mt-1 text-[22px] font-bold leading-tight">
            {formatCurrency(totalOutflow, currency)}
          </p>
          <p className="text-[9px] text-muted-foreground">en vista</p>
        </div>
      </div>

      {/* Expand/collapse toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="mx-auto mt-2 block text-[10px] font-medium text-z-brass"
      >
        {expanded ? "▴ Colapsar" : "▾ Ver flujo por día"}
      </button>

      {/* Expanded: weekly flow chart with real data */}
      {expanded && <FlowChart weeks={weeks} />}
    </MobileZone>
  );
}
