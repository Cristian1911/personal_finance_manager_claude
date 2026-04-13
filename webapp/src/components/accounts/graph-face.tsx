"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { RangeValue } from "./range-pills";
import type { SnapshotPoint } from "./account-detail-types";
import type { CurrencyCode } from "@/types/domain";

interface GraphFaceProps {
  data: SnapshotPoint[];
  currencyCode: string;
  range: RangeValue;
  trendPercent?: number;
}

function filterByRange(data: SnapshotPoint[], range: RangeValue): SnapshotPoint[] {
  if (range === 0 || data.length === 0) return data;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - range);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

function ChartTooltip({
  active,
  payload,
  currencyCode,
}: { active?: boolean; payload?: Array<{ payload: SnapshotPoint }>; currencyCode: string }) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-z-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="text-z-muted">{formatDate(point.date, "dd MMM yyyy")}</p>
      <p className="font-semibold text-white">
        {formatCurrency(point.balance, currencyCode as CurrencyCode)}
      </p>
    </div>
  );
}

export function GraphFace({ data, currencyCode, range, trendPercent }: GraphFaceProps) {
  const filtered = useMemo(() => filterByRange(data, range), [data, range]);
  const latestBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : null;

  if (filtered.length < 2) {
    return (
      <div className="aspect-[85.6/53.98] w-full rounded-xl bg-z-surface-2/80 border border-white/6 flex items-center justify-center">
        <span className="text-sm text-z-muted">Sin datos suficientes</span>
      </div>
    );
  }

  return (
    <div className="aspect-[85.6/53.98] w-full rounded-xl bg-z-surface-2/80 border border-white/6 p-3 flex flex-col">
      {/* Top: balance + trend */}
      <div className="flex items-baseline gap-2 mb-1">
        {latestBalance !== null && (
          <span className="text-lg font-bold text-white tracking-tight">
            {formatCurrency(latestBalance, currencyCode as CurrencyCode)}
          </span>
        )}
        {trendPercent !== undefined && trendPercent !== 0 && (
          <span
            className={cn(
              "text-xs font-semibold rounded-full px-1.5 py-0.5",
              trendPercent > 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            )}
          >
            {trendPercent > 0 ? "▲" : "▼"} {Math.abs(trendPercent).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="graphFaceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--z-brass)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--z-brass)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              content={<ChartTooltip currencyCode={currencyCode} />}
              cursor={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="var(--z-brass)"
              strokeWidth={1.5}
              fill="url(#graphFaceFill)"
              dot={false}
              activeDot={{ r: 3, fill: "var(--z-brass)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
