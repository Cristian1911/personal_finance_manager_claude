"use client";

import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { SnapshotDiff } from "@/types/import";

const RATE_FIELDS = new Set(["Tasa de interés", "Tasa de mora"]);
const COUNT_FIELDS = new Set(["Cuotas en mora"]);

export function formatDiffValue(
  value: number | string | null,
  field: string,
  currency: CurrencyCode,
): string {
  if (value === null || value === undefined) return "---";
  if (typeof value === "string") return value;
  if (RATE_FIELDS.has(field)) return `${value}% E.A.`;
  if (COUNT_FIELDS.has(field)) return `${value}`;
  return formatCurrency(value, currency);
}

export function DiffRow({
  diff,
  currency,
  growthIsGood = false,
  label,
}: {
  diff: SnapshotDiff;
  currency: CurrencyCode;
  /**
   * Colour polarity. A card or loan balance going down is good (default);
   * a savings or investment balance going up is good.
   */
  growthIsGood?: boolean;
  /** Display label when the statement type names the field differently. */
  label?: string;
}) {
  const fmt = (v: number | string | null) => formatDiffValue(v, diff.field, currency);
  const goodChange = growthIsGood ? "increased" : "decreased";
  const badChange = growthIsGood ? "decreased" : "increased";
  const colorClass =
    diff.changeType === goodChange
      ? "text-z-income"
      : diff.changeType === badChange
        ? "text-z-debt"
        : "text-z-sage-light";

  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-z-sage-dark">{label ?? diff.field}</span>
      <div className="flex items-center gap-2 tabular-nums">
        {diff.previousValue !== null && (
          <>
            <span className="text-z-sage-dark">{fmt(diff.previousValue)}</span>
            <ArrowRight className="h-3 w-3 text-z-sage-dark" />
          </>
        )}
        <span className={colorClass}>{fmt(diff.currentValue)}</span>
      </div>
    </div>
  );
}
