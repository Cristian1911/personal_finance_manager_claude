"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";

interface InicioMetricsGridProps {
  runwayDays: number;
  daysInMonth: number;
  dayOfMonth: number;
  nextPaymentName: string | null;
  nextPaymentDays: number | null;
  nextPaymentAmount: number | null;
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

// ─── Burndown SVG Chart ──────────────────────────────────────────────────────

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

  const W = 280;
  const T = 8;
  const B = 78;
  const H = B - T;

  const monthPoints = useMemo(() => {
    const filtered = points.filter((p) => new Date(p.date).getDate() <= daysInMonth);
    if (filtered.length === 0) return [];
    const maxBal = Math.max(totalBudget, ...filtered.map((p) => p.balance));
    return filtered.map((p) => {
      const day = new Date(p.date).getDate();
      const x = Math.round(((day / daysInMonth) * W) * 100) / 100;
      const y = Math.round((T + (1 - p.balance / (maxBal || 1)) * H) * 100) / 100;
      return { x, y, day };
    });
  }, [points, totalBudget, daysInMonth]);

  const currentPt = monthPoints[monthPoints.length - 1];
  const expectedAtDay = totalBudget * (1 - (currentPt?.day ?? 1) / daysInMonth);
  const deviation = remaining - expectedAtDay;
  const isUnder = deviation >= 0;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="text-center">
        <p className="text-[20px] font-[680] leading-tight tracking-tight">
          {formatCurrency(remaining, currency)}{" "}
          <span className="text-[11px] font-normal text-muted-foreground">restante</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          de {formatCurrency(totalBudget, currency)} planeado
        </p>
      </div>

      {/* SVG */}
      <svg viewBox={`0 0 ${W} 90`} className="w-full" aria-label="Burndown">
        <line x1={0} y1={B} x2={W} y2={B} stroke="#2a2d28" strokeWidth={1} />
        {/* Expected (brass dashed) */}
        <line x1={0} y1={T} x2={W} y2={B} stroke="var(--color-z-brass)" strokeWidth={1.5} strokeDasharray="6,4" opacity={0.6} />
        {/* Actual (sage solid) */}
        {monthPoints.length > 1 && (
          <polyline
            points={monthPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none" stroke="var(--color-z-income)" strokeWidth={2.5}
            strokeLinejoin="round" strokeLinecap="round"
          />
        )}
        {currentPt && (
          <>
            <circle cx={currentPt.x} cy={currentPt.y} r={8} fill="var(--color-z-income)" opacity={0.15} />
            <circle cx={currentPt.x} cy={currentPt.y} r={5} fill="var(--color-z-income)" />
            <rect x={Math.min(currentPt.x + 8, 210)} y={currentPt.y - 10} rx={4} width={60} height={16}
              fill={isUnder ? "var(--color-z-income)" : "var(--color-z-debt)"} opacity={0.15} />
            <text x={Math.min(currentPt.x + 38, 240)} y={currentPt.y + 1} textAnchor="middle"
              className="text-[8px] font-semibold" fill={isUnder ? "var(--color-z-income)" : "var(--color-z-debt)"}>
              {compact(Math.abs(deviation), currency)} {isUnder ? "bajo" : "sobre"}
            </text>
          </>
        )}
        <text x={2} y={B + 9} className="fill-muted-foreground text-[7px]">1</text>
        <text x={currentPt?.x ?? W / 2} y={B + 9} textAnchor="middle" className="fill-foreground text-[7px] font-semibold">Hoy</text>
        <text x={W - 2} y={B + 9} textAnchor="end" className="fill-muted-foreground text-[7px]">{daysInMonth}</text>
      </svg>

      {/* Rate comparison */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Ritmo actual</span>
          <span className={cn("font-semibold", data.discretionary.dailyAverage <= totalBudget / daysInMonth ? "text-z-income" : "text-z-expense")}>
            {compact(data.discretionary.dailyAverage, currency)}/día
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Esperado</span>
          <span className="font-semibold text-z-sage-light">{compact(totalBudget / daysInMonth, currency)}/día</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href="/plan" className="flex-1 rounded-xl bg-z-brass/8 border border-z-brass/20 px-3 py-1.5 text-center text-[10px] font-semibold text-z-brass">
          Ver plan
        </Link>
        <Link href="/categories" className="flex-1 rounded-xl bg-black/20 border border-white/8 px-3 py-1.5 text-center text-[10px] font-semibold text-z-sage-light">
          Ver categorías
        </Link>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InicioMetricsGrid({
  daysInMonth,
  dayOfMonth,
  nextPaymentName,
  nextPaymentDays,
  nextPaymentAmount,
  currency,
  burnRateData,
  totalBudget,
  expanded,
  onToggle,
}: InicioMetricsGridProps) {
  const percentage = Math.round((dayOfMonth / daysInMonth) * 100);
  const isRitmoActive = expanded === "ritmo";
  const isPagoActive = expanded === "pago";
  const hasActive = isRitmoActive || isPagoActive;

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

        {/* Próximo pago chip */}
        <button
          type="button"
          onClick={() => onToggle("pago")}
          className={cn(
            PANEL_INSET_CLASS,
            "flex w-full flex-col items-center justify-center px-3 py-3 transition-colors",
            isPagoActive && "ring-1 ring-z-expense/30 bg-z-expense/[0.06]"
          )}
          aria-expanded={isPagoActive}
        >
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">Próximo pago</p>
          {nextPaymentDays != null ? (
            <>
              <p className="text-[18px] font-[650] leading-tight text-z-expense">{nextPaymentDays} días</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {nextPaymentName ?? "Pago"}
                {nextPaymentAmount != null && <> · {formatCurrency(nextPaymentAmount, currency)}</>}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">Sin pagos próximos</p>
          )}
        </button>
      </div>

      {/* Full-width expanded panel */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: hasActive ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={cn("mt-1.5 transition-opacity duration-150", hasActive ? "opacity-100 delay-75" : "opacity-0")}>
            {/* Ritmo expanded → burndown chart */}
            {isRitmoActive && burnRateData && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3")}>
                <BurndownChart
                  data={burnRateData}
                  totalBudget={totalBudget}
                  daysInMonth={daysInMonth}
                  currency={currency}
                />
              </div>
            )}
            {isRitmoActive && !burnRateData && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3 text-center text-[11px] text-muted-foreground")}>
                Sin datos de ritmo suficientes
              </div>
            )}

            {/* Próximo pago expanded */}
            {isPagoActive && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-expense/20 bg-black/20 p-3 space-y-2")}>
                <p className="text-[11px] text-muted-foreground">
                  {nextPaymentName
                    ? `${nextPaymentName} en ${nextPaymentDays} días.`
                    : "No hay pagos próximos programados."}
                </p>
                <Link href="/recurrentes" className="inline-block text-[11px] font-semibold text-z-brass">
                  Ver pagos y recurrentes →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
