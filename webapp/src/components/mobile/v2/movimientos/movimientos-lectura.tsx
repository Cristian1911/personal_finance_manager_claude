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
  if (transactions.length === 0) return [];

  // Time-based: group into trailing weeks from today (not month-based)
  const now = new Date();
  const today = now.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  // 5 weeks back from today: W-4, W-3, W-2, W-1, Current
  const weekBuckets: { income: number; expense: number }[] = Array.from(
    { length: 5 },
    () => ({ income: 0, expense: 0 })
  );

  for (const tx of transactions) {
    if (tx.is_excluded) continue;
    const txDate = new Date(tx.transaction_date).getTime();
    const weeksAgo = Math.floor((today - txDate) / oneWeek);
    const bucketIdx = 4 - Math.min(weeksAgo, 4); // 0=oldest, 4=current
    if (bucketIdx >= 0) {
      if (tx.direction === "INFLOW") {
        weekBuckets[bucketIdx].income += tx.amount;
      } else {
        weekBuckets[bucketIdx].expense += tx.amount;
      }
    }
  }

  // Only include weeks that have data or are between data points
  const labels = ["S-4", "S-3", "S-2", "S-1", "Hoy"];
  const weeks: WeekData[] = [];
  let foundData = false;
  for (let i = 0; i < 5; i++) {
    const b = weekBuckets[i];
    if (b.income > 0 || b.expense > 0) foundData = true;
    if (foundData) {
      weeks.push({ label: labels[i], income: b.income, expense: b.expense });
    }
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

  if (weeks.length === 0) {
    return (
      <div className="mt-3 flex h-16 items-center justify-center rounded-xl border border-white/6 bg-black/10 text-[11px] text-muted-foreground">
        Sin datos este mes
      </div>
    );
  }

  // For a single week, show bars instead of lines
  if (weeks.length === 1) {
    const w = weeks[0];
    const max = Math.max(w.income, w.expense, 1);
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-end gap-3 justify-center h-16">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 rounded-t bg-z-income/80" style={{ height: `${Math.max((w.income / max) * 48, 4)}px` }} />
            <span className="text-[8px] text-muted-foreground">Ingreso</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 rounded-t bg-z-brass/70" style={{ height: `${Math.max((w.expense / max) * 48, 4)}px` }} />
            <span className="text-[8px] text-muted-foreground">Gasto</span>
          </div>
        </div>
        <p className="text-center text-[9px] text-muted-foreground">{w.label}</p>
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
