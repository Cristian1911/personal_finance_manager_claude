"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronRight } from "lucide-react";
import {
  PANEL_INSET_CLASS,
} from "@/lib/constants/styles";
import type { BurnRateResponse } from "@/actions/burn-rate";

// ─── Tile (summary-first, without expanded state) ────────────────────────────

export function SpendingPaceTile({
  data,
}: {
  data: BurnRateResponse;
}) {
  const { runwayDays } = data.discretionary;
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const isCritical = runwayDays < daysRemaining * 0.5;
  const isWarning = runwayDays < daysRemaining;
  const stateCopy = isCritical
    ? "No llegas al cierre"
    : isWarning
      ? "Ajusta para cerrar"
      : "Ritmo bajo control";

  return (
    <Link
      href="/dashboard#burn-rate"
      className={`${PANEL_INSET_CLASS} flex h-full flex-col justify-between p-3`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ritmo
          </span>
          <span
            className={
              isCritical
                ? "text-[10px] font-medium text-z-debt"
                : isWarning
                  ? "text-[10px] font-medium text-z-brass"
                  : "text-[10px] font-medium text-z-sage-light"
            }
          >
            {stateCopy}
          </span>
        </div>

        <div className="space-y-1">
          <span
            className={
              isCritical
                ? "text-[28px] font-extrabold leading-none text-z-debt"
                : isWarning
                  ? "text-[28px] font-extrabold leading-none text-z-brass"
                  : "text-[28px] font-extrabold leading-none text-z-sage-light"
            }
          >
            {Math.round(runwayDays)}d
          </span>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {formatCurrency(data.discretionary.dailyAverage, data.currency)}/día al ritmo actual
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-z-brass">
        <span>Ver análisis</span>
        <ChevronRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

// ─── Detail panel (full-width, rendered below tiles row) ─────────────────────

export function SpendingPaceDetail({ data }: { data: BurnRateResponse }) {
  const { discretionary, currency, disponible } = data;
  const { runwayDays, dailyAverage, dataPoints } = discretionary;
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const isCritical = runwayDays < daysRemaining * 0.5;
  const isWarning = runwayDays < daysRemaining;

  return (
    <div className={cn(PANEL_INSET_CLASS, "p-3")}>
      <p className="mb-2 text-[10px] font-semibold text-z-brass">Proyección de gasto</p>
      <RunwayChart
        dataPoints={dataPoints}
        runwayDays={runwayDays}
        dayOfMonth={dayOfMonth}
        daysInMonth={daysInMonth}
      />
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        {isCritical ? (
          <>
            Reduce{" "}
            <span className="text-z-sage-light">
              {formatCurrency(dailyAverage - disponible / Math.max(daysRemaining, 1), currency)}/día
            </span>{" "}
            para llegar al {daysInMonth}.
          </>
        ) : isWarning ? (
          <>
            Margen para{" "}
            <span className="font-semibold text-z-brass">{Math.round(runwayDays)} días</span>{" "}
            al ritmo actual.
          </>
        ) : (
          <>Vas bien — llegas al día {daysInMonth} con margen.</>
        )}
      </p>
      <Link
        href="/dashboard#burn-rate"
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-z-brass/20 bg-z-brass/8 px-3 py-1.5 text-[11px] font-semibold text-z-brass transition-colors hover:bg-z-brass/12"
      >
        Ver análisis <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
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
  const H = 80;
  const PAD = { top: 8, right: 10, bottom: 18, left: 10 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const parseDay = (date: string) => parseInt(date.split("-")[2], 10);
  const monthPoints = dataPoints.filter((dp) => parseDay(dp.date) <= dayOfMonth);

  if (monthPoints.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center rounded-lg border border-white/8 bg-black/20 text-[11px] text-muted-foreground">
        Datos insuficientes
      </div>
    );
  }

  const maxBalance = Math.max(...monthPoints.map((p) => p.balance));
  const scaleX = (day: number) => PAD.left + (day / daysInMonth) * plotW;
  const scaleY = (val: number) => PAD.top + plotH - (val / ((maxBalance || 1) * 1.1)) * plotH;

  const actualPath = monthPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(parseDay(p.date))},${scaleY(p.balance)}`)
    .join(" ");

  const lastPoint = monthPoints[monthPoints.length - 1];
  const lastDay = parseDay(lastPoint.date);
  const cx = scaleX(lastDay);
  const cy = scaleY(lastPoint.balance);
  const projectedEndDay = Math.min(lastDay + runwayDays, daysInMonth + 2);

  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Proyección de gasto">
        {[0.25, 0.5, 0.75].map((pct) => (
          <line key={pct} x1={PAD.left} y1={scaleY(maxBalance * pct)} x2={W - PAD.right} y2={scaleY(maxBalance * pct)} stroke="var(--z-surface-3)" strokeWidth="0.5" />
        ))}
        <line x1={scaleX(1)} y1={scaleY(maxBalance)} x2={scaleX(daysInMonth)} y2={scaleY(0)} stroke="var(--z-olive-deep)" strokeWidth="1.5" strokeDasharray="4,3" />
        <path d={actualPath} fill="none" stroke="var(--z-brass)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={cx} cy={cy} r="3.5" fill="var(--z-brass)" />
        <circle cx={cx} cy={cy} r="5.5" fill="var(--z-brass)" fillOpacity="0.15" />
        {runwayDays < daysInMonth - dayOfMonth && (
          <path d={`M${cx},${cy} L${scaleX(projectedEndDay)},${scaleY(0)}`} fill="none" stroke="var(--z-debt)" strokeWidth="1.5" strokeDasharray="3,2" />
        )}
        <text x={PAD.left} y={H - 2} fill="var(--z-sage-dark)" fontSize="9" fontFamily="system-ui">Día 1</text>
        <text x={scaleX(dayOfMonth)} y={H - 2} fill="var(--z-sage-light)" fontSize="9" fontFamily="system-ui" textAnchor="middle">Hoy</text>
        <text x={W - PAD.right} y={H - 2} fill="var(--z-sage-dark)" fontSize="9" fontFamily="system-ui" textAnchor="end">{daysInMonth}</text>
      </svg>
    </div>
  );
}
