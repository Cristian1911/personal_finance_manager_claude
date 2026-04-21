"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { projectMinimumPayoff12mo } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { compactAmount } from "./format-utils";
import { cn } from "@/lib/utils";
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
  currency: CurrencyCode;
  metadata: CreditCardMetadata;
  summary: StatementSummary | null;
  transactionCount: number;
  active?: boolean;
};

/**
 * Compact stacked credit-card card — one per currency. Use when a single
 * account has multiple CC statements (e.g., dual COP/USD card). For a single
 * CC statement, prefer `CreditCardSummary` (full hero layout).
 */
export function CreditCardStackCard({
  currency,
  metadata,
  summary,
  transactionCount,
  active = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const balance = metadata.total_payment_due;
  const minPayment = metadata.minimum_payment;
  const interestRateEA = metadata.interest_rate;
  const dueDate = metadata.payment_due_date;

  const projection = useMemo(
    () =>
      balance != null && interestRateEA != null && minPayment != null
        ? projectMinimumPayoff12mo(balance, interestRateEA / 100, minPayment)
        : null,
    [balance, interestRateEA, minPayment],
  );

  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5 transition-colors",
        active
          ? "border-z-brass bg-z-brass/10"
          : "border-white/6 bg-z-surface-2/80",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-z-brass">
          {currency}
        </span>
        {dueDate && (
          <span className="text-xs font-semibold text-z-debt">
            Vence {formatDate(dueDate, "d MMM")}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-end gap-3">
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Saldo
          </p>
          <p className="mt-0.5 text-[22px] font-bold tabular-nums tracking-tight text-z-white">
            {balance != null ? formatCurrency(balance, currency) : "—"}
          </p>
        </div>
        {minPayment != null && (
          <>
            <div className="h-10 w-px self-center bg-white/6" />
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Pago mínimo
              </p>
              <p className="mt-0.5 text-[22px] font-bold tabular-nums tracking-tight text-z-brass">
                {formatCurrency(minPayment, currency)}
              </p>
            </div>
          </>
        )}
      </div>

      {interestRateEA != null && (
        <p className="mt-1.5 text-[11px] text-z-sage-dark">
          Tasa {interestRateEA.toFixed(2)}% E.A.
        </p>
      )}

      {projection && (
        <div className="mt-2.5 border-t border-white/6 pt-2.5">
          {projection.growing ? (
            <p className="text-[11px] italic text-z-debt">
              El mínimo no cubre intereses — saldo crecería.
            </p>
          ) : (
            <p className="text-[11px] italic text-z-brass">
              Con mínimo:{" "}
              <span className="font-bold not-italic text-z-alert">
                {compactAmount(projection.interestAccrued, currency)}
              </span>{" "}
              en intereses 12 meses · queda{" "}
              <span className="font-semibold not-italic text-z-sage-light">
                {compactAmount(projection.remainingBalance, currency)}
              </span>
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark hover:text-z-sage-light"
      >
        {expanded ? "Ocultar detalles" : "Ver detalles"}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <dl className="mt-2.5 space-y-1 border-t border-white/6 pt-2.5 text-[11px]">
          <DetailRow
            label="Cupo total"
            value={
              metadata.credit_limit != null
                ? formatCurrency(metadata.credit_limit, currency)
                : null
            }
          />
          <DetailRow
            label="Cupo disponible"
            value={
              metadata.available_credit != null
                ? formatCurrency(metadata.available_credit, currency)
                : null
            }
          />
          <DetailRow
            label="Tasa moratoria"
            value={
              metadata.late_interest_rate != null
                ? `${metadata.late_interest_rate.toFixed(2)}% E.A.`
                : null
            }
          />
          <DetailRow
            label="Saldo anterior"
            value={
              summary?.previous_balance != null
                ? formatCurrency(summary.previous_balance, currency)
                : null
            }
          />
          <DetailRow
            label="Compras y cargos"
            value={
              summary?.purchases_and_charges != null
                ? formatCurrency(summary.purchases_and_charges, currency)
                : null
            }
          />
          <DetailRow
            label="Abonos"
            value={
              summary?.total_credits != null
                ? formatCurrency(summary.total_credits, currency)
                : null
            }
          />
          <DetailRow
            label="Intereses del mes"
            value={
              summary?.interest_charged != null
                ? formatCurrency(summary.interest_charged, currency)
                : null
            }
          />
          <DetailRow
            label="Saldo final"
            value={
              summary?.final_balance != null
                ? formatCurrency(summary.final_balance, currency)
                : null
            }
          />
          <DetailRow label="Movimientos" value={String(transactionCount)} />
        </dl>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between">
      <dt className="text-z-sage-dark">{label}</dt>
      <dd className="font-semibold text-z-sage-light">{value}</dd>
    </div>
  );
}
