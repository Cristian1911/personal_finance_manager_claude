import { useMemo } from "react";
import { projectMinimumPayoff12mo } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { compactAmount } from "./format-utils";
import { PeriodTile } from "./period-tile";
import type { CurrencyCode } from "@/types/domain";

type CreditCardMetadata = {
  credit_limit: number | null;
  available_credit: number | null;
  interest_rate: number | null;
  late_interest_rate: number | null;
  total_payment_due: number | null;
  minimum_payment: number | null;
  payment_due_date: string | null;
};

type StatementSummary = {
  previous_balance: number | null;
  total_credits: number | null;
  total_debits: number | null;
  final_balance: number | null;
  purchases_and_charges: number | null;
  interest_charged: number | null;
};

type Props = {
  metadata: CreditCardMetadata;
  summary: StatementSummary | null;
  transactionCount: number;
  currency: CurrencyCode;
};

/** Whole-calendar-day difference between today and a "YYYY-MM-DD" string (local tz). */
function daysUntil(iso: string): number | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function CreditCardSummary({
  metadata,
  summary,
  transactionCount,
  currency,
}: Props) {
  const balance = metadata.total_payment_due;
  const dueDate = metadata.payment_due_date;
  const minPayment = metadata.minimum_payment;
  const interestRateEA = metadata.interest_rate;

  const projection = useMemo(
    () =>
      balance != null && interestRateEA != null && minPayment != null
        ? projectMinimumPayoff12mo(balance, interestRateEA / 100, minPayment)
        : null,
    [balance, interestRateEA, minPayment],
  );

  const days = useMemo(() => (dueDate ? daysUntil(dueDate) : null), [dueDate]);
  const daysLabel =
    days == null
      ? null
      : days < 0
        ? `${Math.abs(days)} días tarde`
        : days === 0
          ? "hoy"
          : `${days} día${days === 1 ? "" : "s"}`;

  const spent = summary?.purchases_and_charges ?? null;
  const paid = summary?.total_credits ?? null;
  const hasPeriodData = spent != null || paid != null || transactionCount > 0;

  return (
    <div>
      {/* DUE NOW */}
      <div className="rounded-2xl border border-white/6 bg-z-surface-2/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Saldo total
            </p>
            <p className="mt-1 text-[28px] font-bold tabular-nums tracking-tight text-z-white">
              {balance != null ? formatCurrency(balance, currency) : "—"}
            </p>
          </div>
          {dueDate && (
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-debt">
                Vence
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-z-debt">
                {formatDate(dueDate, "d MMM")}
              </p>
              {daysLabel && (
                <p className="mt-0.5 text-[11px] text-z-sage-dark">{daysLabel}</p>
              )}
            </div>
          )}
        </div>

        {(minPayment != null || interestRateEA != null) && (
          <div className="mt-3.5 flex gap-2">
            <div className="flex-1 rounded-xl border border-white/6 bg-z-surface-3/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Pago mínimo
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-z-brass">
                {minPayment != null ? formatCurrency(minPayment, currency) : "—"}
              </p>
            </div>
            <div className="flex-1 rounded-xl border border-white/6 bg-z-surface-3/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Tasa
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-z-white">
                {interestRateEA != null ? interestRateEA.toFixed(2) : "—"}
                {interestRateEA != null && (
                  <span className="text-xs font-medium text-z-sage-dark">
                    {" "}
                    %&nbsp;E.A.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {projection && (
          <div className="mt-3.5 rounded-xl border border-z-brass/30 bg-z-brass/8 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Si pagas solo el mínimo
            </p>

            {projection.growing ? (
              <>
                <p className="mt-2.5 text-sm italic font-medium text-z-debt">
                  El mínimo no cubre los intereses.
                </p>
                <p className="mt-1 text-xs italic text-z-brass">
                  El saldo crecería cada mes. Paga más para empezar a reducirlo.
                </p>
              </>
            ) : (
              <>
                <div className="mt-2.5 flex items-end gap-4">
                  <div className="flex-1">
                    <p className="text-[22px] font-bold tabular-nums tracking-tight text-z-white">
                      {projection.months} meses
                    </p>
                    <p className="mt-1 text-xs italic text-z-brass">aún pagando</p>
                  </div>
                  <div className="w-px self-stretch bg-z-brass/25" />
                  <div className="flex-1">
                    <p className="text-[22px] font-bold tabular-nums tracking-tight text-z-alert">
                      {compactAmount(projection.interestAccrued, currency)}
                    </p>
                    <p className="mt-1 text-xs italic text-z-brass">en intereses</p>
                  </div>
                </div>
                <div className="mt-2.5 border-t border-z-brass/20 pt-2.5">
                  <p className="text-xs italic text-z-brass">
                    Quedarían{" "}
                    <span className="font-semibold not-italic text-z-sage-light">
                      {compactAmount(projection.remainingBalance, currency)}
                    </span>{" "}
                    de saldo en deuda.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* THIS PERIOD */}
      {hasPeriodData && (
        <div className="mt-4 flex gap-2">
          <PeriodTile
            label="Gastos"
            value={spent != null ? compactAmount(spent, currency) : "—"}
            tone="negative"
          />
          <PeriodTile
            label="Abonos"
            value={paid != null ? compactAmount(paid, currency) : "—"}
            tone="positive"
          />
          <PeriodTile label="Movs" value={String(transactionCount)} tone="neutral" />
        </div>
      )}
    </div>
  );
}
