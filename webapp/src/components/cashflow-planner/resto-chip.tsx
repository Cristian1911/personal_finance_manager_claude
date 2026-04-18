"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface RestoChipProps {
  remainder: number;
  currency: CurrencyCode;
  onClick?: () => void;
  className?: string;
  /** Tighter variant for mobile rows. */
  compact?: boolean;
}

export function RestoChip({ remainder, currency, onClick, className, compact }: RestoChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-dashed",
        "border-z-expense/40 bg-z-expense/10 text-z-expense font-semibold tabular-nums",
        "transition-colors hover:bg-z-expense/15",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        className,
      )}
      aria-label={`Faltan ${formatCurrency(remainder, currency)} por asignar. Clic para asignar.`}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-z-expense" />
      Sigue {formatCurrency(remainder, currency)} sin asignar
    </button>
  );
}
