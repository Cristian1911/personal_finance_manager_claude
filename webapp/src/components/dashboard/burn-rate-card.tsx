"use client";

import { useId, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toISODateString } from "@/lib/utils/date";
import {
  Area,
  AreaChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { BurnRateResponse } from "@/actions/burn-rate";

interface BurnRateCardProps {
  data: BurnRateResponse;
}

const chartConfig = {
  balance: { label: "Balance", color: "hsl(var(--chart-1))" },
};

export function BurnRateCard({ data }: BurnRateCardProps) {
  const [mode, setMode] = useState<"discretionary" | "total">("discretionary");
  const gradientId = useId();
  const result = mode === "discretionary" ? data.discretionary : data.total;

  const trendLabel = {
    accelerating: "↑ Acelerando",
    stable: "→ Estable",
    decelerating: "↓ Desacelerando",
  }[result.trend];

  const trendColor = {
    accelerating: "text-red-400",
    stable: "text-zinc-400",
    decelerating: "text-green-400",
  }[result.trend];

  // Split data points into actual (past) and projected (future)
  const today = toISODateString(new Date());
  const actualPoints = result.dataPoints.filter((p) => p.date <= today);
  const projectedPoints = result.dataPoints.filter((p) => p.date >= today);

  // Merge for chart: actual has balance, projected has projectedBalance
  const chartData = [
    ...actualPoints.map((p) => ({
      date: p.date,
      balance: p.balance,
      projected: undefined as number | undefined,
    })),
    ...projectedPoints.map((p, i) => ({
      date: p.date,
      balance: i === 0 ? p.balance : undefined,
      projected: p.balance,
    })),
  ];

  const isNegativeDisponible = mode === "discretionary" && data.disponible < 0;

  const runwayText =
    isNegativeDisponible
      ? "0 días"
      : result.runwayDays >= 999
        ? "∞"
        : `${result.runwayDays} días`;

  const runwayDateFormatted =
    result.runwayDays >= 999
      ? ""
      : `llegas a $0 el ${formatDate(result.runwayDate)}`;

  return (
    <Card>
      <CardContent className="p-5">
        {/* Header with toggle */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ritmo de gasto
          </span>
          <div className="flex rounded-md bg-muted p-0.5">
            <button
              onClick={() => setMode("discretionary")}
              className={cn(
                "px-3 py-1 text-xs rounded-sm transition-colors",
                mode === "discretionary"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Disponible
            </button>
            <button
              onClick={() => setMode("total")}
              className={cn(
                "px-3 py-1 text-xs rounded-sm transition-colors",
                mode === "total"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Total
            </button>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-1">
          <span className={cn("text-3xl font-bold", isNegativeDisponible && "text-destructive")}>
            {runwayText}
          </span>
          <span className={cn("text-sm ml-2 font-medium", trendColor)}>
            {trendLabel}
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-sm text-muted-foreground mb-4">
          {runwayDateFormatted && (
            <>
              Al ritmo actual, {runwayDateFormatted} ·{" "}
            </>
          )}
          Promedio diario:{" "}
          <span className="text-foreground">
            {formatCurrency(result.dailyAverage, data.currency)}
          </span>
          {result.monthsOfData <= 1 && (
            <span className="text-xs text-muted-foreground/60 ml-1">
              · Basado en {result.monthsOfData} mes de datos
            </span>
          )}
        </p>

        {/* Burndown chart */}
        {chartData.length > 1 && (
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatDate(v, "d MMM")}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v, data.currency)}
                tick={{ fontSize: 10 }}
                width={60}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeOpacity={0.3} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="hsl(var(--chart-1))"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                connectNulls={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function BurnRateCardEmpty() {
  return (
    <Card>
      <CardContent className="p-5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Ritmo de gasto
        </span>
        <p className="text-sm text-muted-foreground mt-3">
          Importa tu primer extracto para ver tu ritmo de gasto.
        </p>
      </CardContent>
    </Card>
  );
}
