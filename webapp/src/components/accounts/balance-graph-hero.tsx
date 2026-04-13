"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { RangePills, type RangeValue } from "./range-pills";
import type { Account, CurrencyCode } from "@/types/domain";
import type { SnapshotPoint } from "./account-detail-types";

interface BalanceGraphHeroProps {
  account: Account;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
}

function filterByRange(data: SnapshotPoint[], days: RangeValue): SnapshotPoint[] {
  if (days === 0 || data.length === 0) return data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function formatAxisAmount(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}

function ChartTooltip({
  active,
  payload,
  currencyCode,
}: { active?: boolean; payload?: Array<{ payload: SnapshotPoint }>; currencyCode: string }) {
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

export function BalanceGraphHero({
  account,
  snapshotData,
  trendPercent,
}: BalanceGraphHeroProps) {
  const [range, setRange] = useState<RangeValue>(90);
  const filtered = useMemo(() => filterByRange(snapshotData, range), [snapshotData, range]);
  const cc = (account.currency_code ?? "COP") as CurrencyCode;
  const isDebt = account.account_type === "LOAN";
  const strokeColor = isDebt ? "var(--z-brass)" : "var(--z-sage-light)";
  const gradientId = `balanceGraphHeroFill-${account.id}`;

  return (
    <div className="space-y-3">
      {/* Top row: balance + trend / range pills */}
      <div className="flex items-start justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-z-white tracking-tight tabular-nums">
            {formatCurrency(account.current_balance ?? 0, cc)}
          </span>
          {trendPercent !== undefined && trendPercent !== 0 && (
            <span
              className={cn(
                "text-xs font-semibold rounded-full px-1.5 py-0.5",
                trendPercent > 0
                  ? "bg-emerald-500/15 text-z-income"
                  : "bg-red-500/15 text-red-400"
              )}
            >
              {trendPercent > 0 ? "▲" : "▼"} {Math.abs(trendPercent).toFixed(1)}%
            </span>
          )}
        </div>
        <RangePills value={range} onChange={setRange} />
      </div>

      {/* Chart area */}
      {filtered.length >= 2 ? (
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 4, right: 4, bottom: 16, left: 4 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                tick={{ fontSize: 9, fill: "var(--z-sage-dark)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tickFormatter={formatAxisAmount}
                tick={{ fontSize: 9, fill: "var(--z-sage-dark)" }}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={["dataMin", "dataMax"]}
              />
              <Tooltip
                content={<ChartTooltip currencyCode={account.currency_code ?? "COP"} />}
                cursor={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={strokeColor}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 3, fill: strokeColor }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[120px] flex items-center justify-center rounded-xl border border-white/6 bg-z-surface-2/50">
          <span className="text-sm text-z-sage-dark">Sin datos suficientes</span>
        </div>
      )}
    </div>
  );
}
