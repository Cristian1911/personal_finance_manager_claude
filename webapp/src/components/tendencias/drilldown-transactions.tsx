"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  getDrilldownTransactions,
  type DrilldownTransaction,
} from "@/actions/analytics";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

/**
 * Read-only transaction list behind a single category OR destinatario for the
 * active period window. Self-manages loading — it does NOT need a <Suspense>
 * wrapper. Mount it (ideally lazily, the first time a row opens) inside the
 * accordion's expanded region; it fetches on mount and re-fetches when its
 * params change. The underlying read is cached ("use cache"), so re-expanding a
 * previously opened row is instant.
 */
export interface DrilldownTransactionsProps {
  /** Pass exactly one of categoryId / destinatarioId. */
  categoryId?: string;
  destinatarioId?: string;
  dateFrom: string; // YYYY-MM-DD inclusive (vm.windowFrom)
  dateTo: string; // YYYY-MM-DD inclusive (vm.windowTo)
  currency: CurrencyCode;
  limit?: number;
}

type State =
  | { status: "loading" }
  | { status: "done"; rows: DrilldownTransaction[] };

export function DrilldownTransactions({
  categoryId,
  destinatarioId,
  dateFrom,
  dateTo,
  currency,
  limit,
}: DrilldownTransactionsProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    getDrilldownTransactions({ categoryId, destinatarioId, dateFrom, dateTo, currency, limit })
      .then((rows) => {
        if (active) setState({ status: "done", rows });
      })
      .catch(() => {
        if (active) setState({ status: "done", rows: [] });
      });
    return () => {
      active = false;
    };
  }, [categoryId, destinatarioId, dateFrom, dateTo, currency, limit]);

  if (state.status === "loading") {
    return (
      <div className="space-y-2.5 py-2" aria-busy="true" aria-label="Cargando movimientos">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-6 shrink-0 animate-pulse rounded-md bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-2.5 w-2/3 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-2 w-1/3 animate-pulse rounded bg-white/[0.04]" />
            </div>
            <div className="h-2.5 w-16 shrink-0 animate-pulse rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    );
  }

  if (state.rows.length === 0) {
    return <p className="py-3 text-center text-xs text-z-sage-dark">Sin movimientos</p>;
  }

  return (
    <div>
      {state.rows.map((tx) => (
        <DrilldownRow key={tx.id} tx={tx} />
      ))}
    </div>
  );
}

function DrilldownRow({ tx }: { tx: DrilldownTransaction }) {
  const isInflow = tx.direction === "INFLOW";
  const Icon = isInflow ? ArrowDownLeft : ArrowUpRight;
  return (
    <div className="flex items-center gap-3 border-t border-white/6 py-2.5 first:border-t-0">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-z-sage-dark">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{tx.description}</p>
        <p className="truncate text-[11px] text-z-sage-dark">
          {formatDate(tx.date)} · {tx.accountLabel}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs font-semibold tabular-nums ${isInflow ? "text-z-income" : "text-z-expense"}`}
      >
        {isInflow ? "+" : "-"}
        {formatCurrency(tx.amount, tx.currencyCode)}
      </span>
    </div>
  );
}
