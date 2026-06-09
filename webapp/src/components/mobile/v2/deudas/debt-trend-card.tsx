"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { StateChip } from "@/components/mobile/v2/state-chip";
import type { DebtTrendData } from "@/actions/debt";
import type { CurrencyCode } from "@/types/domain";

const STATUS_META = {
  mejorando: { label: "Mejorando", variant: "sage" as const },
  estable: { label: "Estable", variant: "brass" as const },
  mes_pesado: { label: "Mes pesado", variant: "danger" as const },
};

export function DebtTrendCard({
  trend,
  currency,
}: {
  trend: DebtTrendData;
  currency: CurrencyCode;
}) {
  const meta = trend.status ? STATUS_META[trend.status] : null;
  const max = Math.max(...trend.sparkline.map((p) => p.total), 1);

  return (
    <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Tendencia
          </p>
          {trend.deltaPct != null ? (
            <p
              className={cn(
                "mt-1 text-[16px] font-semibold tabular-nums",
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
            <p className="mt-1 text-xs text-muted-foreground">
              Sin historial suficiente
            </p>
          )}
        </div>
        {meta && <StateChip label={meta.label} variant={meta.variant} />}
      </div>

      {trend.extraPayments.count > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Hiciste {trend.extraPayments.count} pago
          {trend.extraPayments.count !== 1 ? "s" : ""} extra (
          {formatCurrency(trend.extraPayments.totalExtra, currency)}) este mes
        </p>
      )}

      {trend.sparkline.length >= 2 && (
        <div className="mt-3 flex h-8 items-end gap-1" aria-hidden>
          {trend.sparkline.map((p, i) => {
            const isLast = i === trend.sparkline.length - 1;
            return (
              <div
                key={p.period}
                className={cn(
                  "flex-1 rounded-t-sm",
                  isLast && trend.status === "mes_pesado"
                    ? "bg-z-debt/70"
                    : "bg-z-brass/35"
                )}
                style={{ height: `${Math.max(12, (p.total / max) * 100)}%` }}
                title={`${p.period}: ${formatCurrency(p.total, currency)}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
