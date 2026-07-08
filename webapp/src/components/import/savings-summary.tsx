import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { compactAmount } from "./format-utils";
import { PeriodTile } from "./period-tile";
import type { CurrencyCode } from "@/types/domain";
import type { ParsedTransaction, StatementSummary } from "@/types/import";

type Props = {
  summary: StatementSummary | null;
  transactions: ParsedTransaction[];
  currency: CurrencyCode;
  periodFrom: string | null;
  periodTo: string | null;
};

export function SavingsSummary({
  summary,
  transactions,
  currency,
  periodFrom,
  periodTo,
}: Props) {
  // Some savings parsers (Nequi, Nu, Davivienda) return partial summaries —
  // fall back to totals computed from the parsed movements themselves.
  const { credits, debits } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of transactions) {
      if (tx.direction === "INFLOW") inflow += tx.amount;
      else outflow += tx.amount;
    }
    return {
      credits: summary?.total_credits ?? (transactions.length > 0 ? inflow : null),
      debits: summary?.total_debits ?? (transactions.length > 0 ? outflow : null),
    };
  }, [summary, transactions]);

  const finalBalance = summary?.final_balance ?? null;
  const previousBalance = summary?.previous_balance ?? null;

  const netChange =
    finalBalance != null && previousBalance != null
      ? finalBalance - previousBalance
      : credits != null && debits != null
        ? credits - debits
        : null;

  const periodLabel =
    periodFrom && periodTo
      ? `${formatDate(periodFrom, "d MMM")} – ${formatDate(periodTo, "d MMM")}`
      : null;

  return (
    <div>
      {/* BALANCE */}
      <div className="rounded-2xl border border-white/6 bg-z-surface-2/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Saldo final
            </p>
            <p className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-z-white">
              {finalBalance != null ? formatCurrency(finalBalance, currency) : "—"}
            </p>
          </div>
          {periodLabel && (
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Periodo
              </p>
              <p className="mt-1 text-sm font-semibold text-z-sage-light">
                {periodLabel}
              </p>
            </div>
          )}
        </div>

        {(previousBalance != null || netChange != null) && (
          <div className="mt-3.5 flex gap-2">
            <div className="flex-1 rounded-xl border border-white/6 bg-z-surface-3/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Saldo anterior
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-z-white">
                {previousBalance != null
                  ? formatCurrency(previousBalance, currency)
                  : "—"}
              </p>
            </div>
            <div className="flex-1 rounded-xl border border-white/6 bg-z-surface-3/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Variación
              </p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums tracking-tight ${
                  netChange == null
                    ? "text-z-white"
                    : netChange >= 0
                      ? "text-z-income"
                      : "text-z-debt"
                }`}
              >
                {netChange != null
                  ? `${netChange >= 0 ? "+" : ""}${compactAmount(netChange, currency)}`
                  : "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* THIS PERIOD */}
      {(credits != null || debits != null || transactions.length > 0) && (
        <div className="mt-4 flex gap-2">
          <PeriodTile
            label="Abonos"
            value={credits != null ? compactAmount(credits, currency) : "—"}
            tone="positive"
          />
          <PeriodTile
            label="Cargos"
            value={debits != null ? compactAmount(debits, currency) : "—"}
            tone="negative"
          />
          <PeriodTile label="Movs" value={String(transactions.length)} tone="neutral" />
        </div>
      )}
    </div>
  );
}
