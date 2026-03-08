"use client";

import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface RecurringSummaryBarProps {
  totalPlanned: number;
  pendingCount: number;
  completedCount: number;
  currencyCode?: CurrencyCode;
}

export function RecurringSummaryBar({
  totalPlanned,
  pendingCount,
  completedCount,
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
        {completedCount} {completedCount === 1 ? "completado" : "completados"}
      </span>
    </div>
  );
}
