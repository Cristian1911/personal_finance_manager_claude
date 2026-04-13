"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { SnapshotPoint } from "./account-detail-types";
import type { RangeValue } from "./range-pills";

export function filterByRange(data: SnapshotPoint[], days: RangeValue): SnapshotPoint[] {
  if (days === 0 || data.length === 0) return data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

export function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export function formatAxisAmount(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SnapshotPoint }>;
  currencyCode: string;
}

export function ChartTooltip({ active, payload, currencyCode }: ChartTooltipProps) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/6 bg-z-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="text-z-sage-dark">{formatDate(point.date, "dd MMM yyyy")}</p>
      <p className="font-semibold text-z-white">
        {formatCurrency(point.balance, currencyCode as CurrencyCode)}
      </p>
    </div>
  );
}
