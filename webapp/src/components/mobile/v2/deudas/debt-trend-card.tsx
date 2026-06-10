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

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", className)} aria-hidden />
      {label}
    </span>
  );
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
  // Payments framing: paying MORE than last month is progress.
  return (
    <span
      className={cn(
        "tabular-nums font-semibold",
        d > 0 ? "text-z-income" : "text-muted-foreground",
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
  // Linear scale from 0 so the mínimo/extra segments are proportional to the
  // amounts (range-scaling would distort the split).
  const maxVal = hasChart
    ? Math.max(...points.map((p) => Math.max(p.total, p.expected ?? 0)), 1)
    : 1;
  const scalePct = (v: number) => (v / maxVal) * 100;

  /** Split a month into the bar segments: mínimo covered | extra | faltante. */
  const segmentsOf = (p: { total: number; expected: number | null }) => {
    if (p.expected == null) {
      return { base: p.total, extra: 0, short: 0 };
    }
    return {
      base: Math.min(p.total, p.expected),
      extra: Math.max(0, p.total - p.expected),
      short: Math.max(0, p.expected - p.total),
    };
  };

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
          <p className={MOBILE_EYEBROW_CLASS}>Tendencia · pagos a deudas</p>
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
          {hasChart ? (
            <div>
              <p className="text-[16px] font-semibold tabular-nums">
                {formatCurrency(points.at(-1)?.total ?? 0, currency)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                pagados este mes
                {trend.deltaPct != null && (
                  <>
                    {" · "}
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        trend.deltaPct > 0 ? "text-z-income" : "text-muted-foreground"
                      )}
                    >
                      {trend.deltaPct > 0 ? "▲" : trend.deltaPct < 0 ? "▼" : "·"}{" "}
                      {Math.abs(trend.deltaPct).toFixed(0)}%
                    </span>{" "}
                    vs mes pasado
                  </>
                )}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin historial suficiente</p>
          )}

          {/* Compact sparkline — stacked mínimo|extra|faltante, each bar tappable */}
          {hasChart && (
            <div className="flex h-9 w-[140px] shrink-0 items-end gap-1">
              {points.map((p, i) => {
                const isSel = sel === i;
                const seg = segmentsOf(p);
                return (
                  <button
                    key={p.period}
                    type="button"
                    aria-label={`${monthParts(p.period).label}: ${formatCurrency(p.total, currency)} pagados`}
                    aria-pressed={isSel}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectBar(i);
                    }}
                    className={cn(
                      "flex h-full flex-1 flex-col justify-end overflow-hidden rounded-t-sm transition-opacity duration-150",
                      sel !== null && !isSel && "opacity-40"
                    )}
                  >
                    {seg.short > 0 && (
                      <span
                        className="w-full shrink-0 bg-z-alert/30"
                        style={{ height: `${Math.max(scalePct(seg.short), 2)}%` }}
                      />
                    )}
                    {seg.extra > 0 && (
                      <span
                        className="w-full shrink-0 bg-z-income"
                        style={{ height: `${Math.max(scalePct(seg.extra), 2)}%` }}
                      />
                    )}
                    <span
                      className={cn("w-full shrink-0", isSel ? "bg-z-brass" : "bg-z-brass/50")}
                      style={{ height: `${Math.max(scalePct(seg.base), 3)}%` }}
                    />
                  </button>
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
                  <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
                    {(() => {
                      const seg = segmentsOf(p);
                      return (
                        <>
                          <span
                            className={cn(
                              "h-full shrink-0 rounded-l-full",
                              isSel ? "bg-z-brass" : "bg-z-brass/60"
                            )}
                            style={{ width: `${Math.max(scalePct(seg.base), 1.5)}%` }}
                          />
                          {seg.extra > 0 && (
                            <span
                              className="h-full shrink-0 rounded-r-full bg-z-income"
                              style={{ width: `${scalePct(seg.extra)}%` }}
                            />
                          )}
                          {seg.short > 0 && (
                            <span
                              className="h-full shrink-0 rounded-r-full bg-z-alert/30"
                              style={{ width: `${scalePct(seg.short)}%` }}
                            />
                          )}
                        </>
                      );
                    })()}
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

            {/* Legend */}
            <div className="flex items-center gap-3 px-2.5 pt-1.5">
              <LegendDot className="bg-z-brass/60" label="mínimo" />
              {points.some((p) => segmentsOf(p).extra > 0) && (
                <LegendDot className="bg-z-income" label="extra" />
              )}
              {points.some((p) => segmentsOf(p).short > 0) && (
                <LegendDot className="bg-z-alert/40" label="bajo el mínimo" />
              )}
            </div>

            {/* Selected month detail — pagado vs mínimo */}
            <Expand open={sel !== null}>
              {sel !== null && (
                <div className="mt-2 rounded-xl border border-white/6 bg-[#111] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
                        {monthParts(points[sel].period).label} {monthParts(points[sel].period).year}
                      </p>
                      <p className="text-sm font-bold tabular-nums">
                        {formatCurrency(points[sel].total, currency)}
                        <span className="ml-1 text-[10px] font-medium text-muted-foreground">pagado</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">vs mes anterior</p>
                      <DeltaInline sparkline={points} index={sel} className="text-xs" />
                    </div>
                  </div>
                  {points[sel].expected != null && (
                    <div className="mt-1.5 flex items-center justify-between border-t border-white/6 pt-1.5">
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        mínimo {formatCurrency(points[sel].expected ?? 0, currency)}
                      </p>
                      {points[sel].total > (points[sel].expected ?? 0) && (
                        <p className="text-[10px] font-semibold tabular-nums text-z-income">
                          +{formatCurrency(points[sel].total - (points[sel].expected ?? 0), currency)} extra
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Expand>
          </div>
        </Expand>
      )}
    </div>
  );
}
