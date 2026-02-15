"use client";

import { FileText, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { StatementSnapshot } from "@/actions/statement-snapshots";

function MetricRow({
  label,
  value,
  previousValue,
  currency,
}: {
  label: string;
  value: number | null;
  previousValue?: number | null;
  currency: CurrencyCode;
}) {
  if (value === null) return null;

  const diff =
    previousValue != null && value != null ? value - previousValue : null;

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium">{formatCurrency(value, currency)}</span>
        {diff !== null && diff !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs ${
              diff > 0 ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {diff > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {formatCurrency(Math.abs(diff), currency)}
          </span>
        )}
        {diff === 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Minus className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}

export function StatementHistoryTimeline({
  snapshots,
  currency,
}: {
  snapshots: StatementSnapshot[];
  currency: CurrencyCode;
}) {
  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No hay extractos importados para esta cuenta. Importa un PDF para ver el
        historial.
      </p>
    );
  }

  return (
    <div className="relative space-y-4">
      {/* Vertical line */}
      <div className="absolute left-4 top-6 bottom-6 w-px bg-border" />

      {snapshots.map((snap, idx) => {
        const prev = snapshots[idx + 1] ?? null; // next in array = previous in time
        const periodLabel = snap.period_to
          ? formatDate(snap.period_to, "MMM yyyy")
          : "Sin periodo";

        return (
          <div key={snap.id} className="relative pl-10">
            {/* Timeline dot */}
            <div className="absolute left-2.5 top-4 h-3 w-3 rounded-full border-2 border-primary bg-background" />

            <Card>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm capitalize">
                      {periodLabel}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {snap.transaction_count} transacciones
                  </span>
                </div>

                <div className="space-y-1">
                  <MetricRow
                    label="Total a pagar"
                    value={snap.total_payment_due}
                    previousValue={prev?.total_payment_due}
                    currency={currency}
                  />
                  <MetricRow
                    label="Pago minimo"
                    value={snap.minimum_payment}
                    previousValue={prev?.minimum_payment}
                    currency={currency}
                  />
                  <MetricRow
                    label="Intereses"
                    value={snap.interest_charged}
                    previousValue={prev?.interest_charged}
                    currency={currency}
                  />
                  <MetricRow
                    label="Compras y cargos"
                    value={snap.purchases_and_charges}
                    previousValue={prev?.purchases_and_charges}
                    currency={currency}
                  />
                  <MetricRow
                    label="Cupo total"
                    value={snap.credit_limit}
                    previousValue={prev?.credit_limit}
                    currency={currency}
                  />
                  {snap.payment_due_date && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Fecha de pago
                      </span>
                      <span className="font-medium">
                        {formatDate(snap.payment_due_date, "dd MMM yyyy")}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
