"use client";

import { DiffRow } from "./snapshot-diff-row";
import type { SnapshotDiff } from "@/types/import";
import type { CurrencyCode } from "@/types/domain";

/**
 * Month-over-month loan comparison (prior statement → this one). Shared by the
 * Confirmar step (computed client-side from the prior snapshot) and the final
 * results (computed server-side from accountUpdates.diffs).
 */
export function LoanEvolution({
  diffs,
  isFirstImport,
  loading = false,
  currency,
  emptyLabel = "Sin cambios respecto al mes anterior.",
}: {
  diffs: SnapshotDiff[];
  isFirstImport: boolean;
  loading?: boolean;
  currency: CurrencyCode;
  emptyLabel?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-hidden>
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/6" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/6" />
      </div>
    );
  }

  if (isFirstImport) {
    return (
      <p className="text-xs text-z-sage-dark">
        Primer extracto de esta cuenta — aún no hay un mes anterior para comparar.
      </p>
    );
  }

  if (diffs.length === 0) {
    return <p className="text-xs text-z-sage-dark">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-0.5">
      {diffs.map((diff) => (
        <DiffRow key={diff.field} diff={diff} currency={currency} />
      ))}
    </div>
  );
}
