"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { RunwayMiniChart } from "@/components/dashboard/runway-mini-chart";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";

interface InicioMetricsGridProps {
  daysInMonth: number;
  dayOfMonth: number;
  spentToday: number;
  spentYesterday: number;
  avgLast7: number;
  currency: CurrencyCode;
  /** Burndown data — shown as expanded view of Ritmo chip */
  burnRateData: BurnRateResponse | null;
  totalBudget: number;
  /** Controlled from parent */
  expanded: string | null;
  onToggle: (id: string) => void;
}

// ─── SVG Arc Ring ────────────────────────────────────────────────────────────

function ArcRing({ percentage }: { percentage: number }) {
  const r = 19;
  const cx = 24;
  const cy = 24;
  const circumference = 2 * Math.PI * r;
  const offset = Math.round((circumference - (percentage / 100) * circumference) * 100) / 100;

  return (
    <svg width={48} height={48} viewBox="0 0 48 48" className="shrink-0" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2d28" strokeWidth={4} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="var(--color-z-income)" strokeWidth={4}
        strokeLinecap="round" strokeDasharray={circumference}
        strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[11px] font-bold">
        {percentage}%
      </text>
    </svg>
  );
}

// ─── Compact currency ────────────────────────────────────────────────────────

function compact(amount: number, currency: CurrencyCode): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return formatCurrency(amount, currency);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InicioMetricsGrid({
  daysInMonth,
  dayOfMonth,
  spentToday,
  spentYesterday,
  avgLast7,
  currency,
  burnRateData,
  expanded,
  onToggle,
}: InicioMetricsGridProps) {
  const percentage = Math.round((dayOfMonth / daysInMonth) * 100);
  const isRitmoActive = expanded === "ritmo";
  const isGastoActive = expanded === "gasto-hoy";
  const hasActive = isRitmoActive || isGastoActive;

  return (
    <div>
      {/* Chip row */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Ritmo chip */}
        <button
          type="button"
          onClick={() => onToggle("ritmo")}
          className={cn(
            PANEL_INSET_CLASS,
            "flex w-full flex-col items-center justify-center px-3 py-3 transition-colors",
            isRitmoActive && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]"
          )}
          aria-expanded={isRitmoActive}
        >
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">Ritmo</p>
          <ArcRing percentage={percentage} />
          <p className="mt-1.5 text-[11px] text-muted-foreground">día {dayOfMonth} de {daysInMonth}</p>
        </button>

        {/* Gasto hoy chip */}
        <button
          type="button"
          onClick={() => onToggle("gasto-hoy")}
          className={cn(
            PANEL_INSET_CLASS,
            "flex w-full flex-col items-center justify-center px-3 py-3 transition-colors",
            isGastoActive && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]"
          )}
          aria-expanded={isGastoActive}
        >
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">Gasto hoy</p>
          <p className={cn(
            "text-[18px] font-[650] leading-tight",
            spentToday === 0 ? "text-z-sage-light" : "text-foreground"
          )}>
            {compact(spentToday, currency)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {spentToday === 0 ? "Sin gastos" : "gastado hoy"}
          </p>
        </button>
      </div>

      {/* Full-width expanded panel */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: hasActive ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={cn("mt-1.5 transition-opacity duration-150", hasActive ? "opacity-100 delay-75" : "opacity-0")}>
            {/* Ritmo expanded → runway chart */}
            {isRitmoActive && burnRateData && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3 space-y-2")}>
                <RunwayMiniChart
                  dataPoints={burnRateData.discretionary.dataPoints}
                  runwayDays={burnRateData.discretionary.runwayDays}
                  dayOfMonth={dayOfMonth}
                  daysInMonth={daysInMonth}
                  obligations={burnRateData.obligations}
                  nextIncomeDate={burnRateData.nextIncomeDate}
                />
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">Promedio diario</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(burnRateData.discretionary.dailyAverage, currency)}/día
                  </span>
                </div>
                <Link
                  href="/plan"
                  className="block rounded-xl bg-z-brass/8 border border-z-brass/20 px-3 py-2 text-center text-[11px] font-semibold text-z-brass transition-colors active:bg-z-brass/15"
                >
                  Ver plan completo
                </Link>
              </div>
            )}
            {isRitmoActive && !burnRateData && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3 text-center text-[11px] text-muted-foreground")}>
                Sin datos de ritmo suficientes
              </div>
            )}

            {/* Gasto hoy expanded */}
            {isGastoActive && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3 space-y-2")}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">Hoy</span>
                  <span className="text-sm font-semibold">{formatCurrency(spentToday, currency)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-muted-foreground">Ayer</span>
                  <span className="text-sm font-semibold text-muted-foreground">{formatCurrency(spentYesterday, currency)}</span>
                </div>
                {avgLast7 > 0 && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground">Promedio 7 días</span>
                    <span className="text-sm font-semibold text-muted-foreground">{formatCurrency(Math.round(avgLast7), currency)}</span>
                  </div>
                )}
                <Link href="/transactions" className="inline-block text-[11px] font-semibold text-z-brass">
                  Ver movimientos →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
