"use client";

import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface RecurringSummaryBarProps {
  totalPlanned: number;
  pendingCount: number;
  paidCount: number;
  /** Rendered as its own segment — an omitted payment is not a paid one. */
  skippedCount: number;
  currencyCode?: CurrencyCode;
}

export function RecurringSummaryBar({
  totalPlanned,
  pendingCount,
  paidCount,
  skippedCount,
  currencyCode = "COP",
}: RecurringSummaryBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">
        {formatCurrency(totalPlanned, currencyCode)}
      </span>
      <span>en fijos</span>
      <span className="text-muted-foreground/50">&middot;</span>
      <span>
        {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
      </span>
      <span className="text-muted-foreground/50">&middot;</span>
      <span>
        {paidCount} {paidCount === 1 ? "pagado" : "pagados"}
      </span>
      {skippedCount > 0 && (
        <>
          <span className="text-muted-foreground/50">&middot;</span>
          <span>
            {skippedCount} {skippedCount === 1 ? "omitido" : "omitidos"}
          </span>
        </>
      )}
    </div>
  );
}
