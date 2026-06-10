"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS, MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { StateChip } from "@/components/mobile/v2/state-chip";
import { Expand } from "@/components/mobile/v2/expand";
import type { DebtTrendData } from "@/actions/debt";
import type { CurrencyCode } from "@/types/domain";

const STATUS_META = {
  mejorando: { label: "Mejorando", variant: "sage" as const },
  estable: { label: "Estable", variant: "brass" as const },
  mes_pesado: { label: "Mes pesado", variant: "danger" as const },
};

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-04" → { label: "abr", year: "2026" } */
function monthParts(period: string) {
  const [year, mm] = period.split("-");
  return { label: MONTHS_ES[Number(mm) - 1] ?? period, year };
}

/** Range-scaled bar size so month-to-month changes stay legible. */
function rangePct(v: number, min: number, max: number, floor = 25) {
  if (max <= min) return 60;
  return floor + ((v - min) / (max - min)) * (100 - floor);
}

function DeltaInline({
  sparkline,
  index,
  className,
}: {
  sparkline: { period: string; total: number }[];
  index: number;
  className?: string;
}) {
  if (index === 0) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const prev = sparkline[index - 1].total;
  if (prev <= 0) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const d = ((sparkline[index].total - prev) / prev) * 100;
  const good = d < 0;
  return (
    <span
      className={cn(
        "tabular-nums font-semibold",
        good ? "text-z-income" : d > 0 ? "text-z-debt" : "text-muted-foreground",
        className
      )}
    >
      {d > 0 ? "▲" : d < 0 ? "▼" : "·"} {Math.abs(d).toFixed(1)}%
    </span>
  );
}

export function DebtTrendCard({
  trend,
  currency,
}: {
  trend: DebtTrendData;
  currency: CurrencyCode;
}) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(null);

  const meta = trend.status ? STATUS_META[trend.status] : null;
  const points = trend.sparkline;
  const hasChart = points.length >= 2;
  const min = hasChart ? Math.min(...points.map((p) => p.total)) : 0;
  const max = hasChart ? Math.max(...points.map((p) => p.total)) : 1;

  const selectBar = (i: number) => {
    setSel(sel === i ? null : i);
    if (!open) setOpen(true);
  };

  return (
    <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
      {/* Header — tap to expand (chevron is the focusable toggle; the row is a
          convenience hit area, so no interactive nesting with the bars below) */}
      <div
        onClick={() => hasChart && setOpen(!open)}
        className={cn("w-full text-left", hasChart && "cursor-pointer")}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={MOBILE_EYEBROW_CLASS}>Tendencia</p>
          <span className="flex items-center gap-2">
            {meta && <StateChip label={meta.label} variant={meta.variant} />}
            {hasChart && (
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? "Ocultar detalle de tendencia" : "Ver detalle de tendencia"}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(!open);
                }}
                className="-m-1 flex p-1"
              >
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    open && "rotate-180"
                  )}
                />
              </button>
            )}
          </span>
        </div>

        <div className="mt-1 flex items-end justify-between gap-4">
          {trend.deltaPct != null ? (
            <p
              className={cn(
                "text-[16px] font-semibold tabular-nums",
                trend.deltaPct > 10
                  ? "text-z-debt"
                  : trend.deltaPct <= -5
                    ? "text-z-income"
                    : "text-foreground"
              )}
            >
              {trend.deltaPct > 0 ? "▲" : trend.deltaPct < 0 ? "▼" : "·"}{" "}
              {Math.abs(trend.deltaPct).toFixed(0)}% vs mes pasado
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Sin historial suficiente</p>
          )}

          {/* Compact sparkline — each bar tappable */}
          {hasChart && (
            <div className="flex h-9 w-[140px] shrink-0 items-end gap-1">
              {points.map((p, i) => {
                const isLast = i === points.length - 1;
                const isSel = sel === i;
                return (
                  <button
                    key={p.period}
                    type="button"
                    aria-label={`${monthParts(p.period).label}: ${formatCurrency(p.total, currency)}`}
                    aria-pressed={isSel}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectBar(i);
                    }}
                    className={cn(
                      "flex-1 rounded-t-sm transition-opacity duration-150",
                      isSel
                        ? "bg-z-brass"
                        : isLast && trend.status === "mes_pesado"
                          ? "bg-z-debt/70"
                          : "bg-z-brass/35",
                      sel !== null && !isSel && "opacity-40"
                    )}
                    style={{ height: `${rangePct(p.total, min, max, 30)}%` }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {trend.extraPayments.count > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Hiciste {trend.extraPayments.count} pago
          {trend.extraPayments.count !== 1 ? "s" : ""} extra (
          {formatCurrency(trend.extraPayments.totalExtra, currency)}) este mes
        </p>
      )}

      {/* Expanded — per-month breakdown rows */}
      {hasChart && (
        <Expand open={open}>
          <div className="mt-3 space-y-1">
            {points.map((p, i) => {
              const isSel = sel === i;
              const { label } = monthParts(p.period);
              return (
                <button
                  key={p.period}
                  type="button"
                  onClick={() => setSel(isSel ? null : i)}
                  aria-pressed={isSel}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors duration-150",
                    isSel
                      ? "border-z-brass/40 bg-z-brass/10"
                      : "border-transparent active:bg-white/[0.03]"
                  )}
                >
                  <span
                    className={cn(
                      "w-7 text-[10px] font-semibold uppercase tracking-[0.18em]",
                      isSel ? "text-z-brass" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        isSel ? "bg-z-brass" : "bg-z-brass/45"
                      )}
                      style={{ width: `${rangePct(p.total, min, max)}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      "w-14 text-right text-[11px] font-semibold tabular-nums",
                      isSel ? "text-foreground" : "text-z-sage-light"
                    )}
                  >
                    {formatCurrencyCompact(p.total, currency)}
                  </span>
                  <span className="w-13 text-right">
                    <DeltaInline sparkline={points} index={i} className="text-[10px]" />
                  </span>
                </button>
              );
            })}

            {/* Selected month detail */}
            <Expand open={sel !== null}>
              {sel !== null && (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-white/6 bg-[#111] px-3 py-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
                      {monthParts(points[sel].period).label} {monthParts(points[sel].period).year}
                    </p>
                    <p className="text-sm font-bold tabular-nums">
                      {formatCurrency(points[sel].total, currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">vs mes anterior</p>
                    <DeltaInline sparkline={points} index={sel} className="text-xs" />
                  </div>
                </div>
              )}
            </Expand>
          </div>
        </Expand>
      )}
    </div>
  );
}
