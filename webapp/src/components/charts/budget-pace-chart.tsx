"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { DailyBudgetPace } from "@/actions/charts";

interface BudgetPaceChartProps {
  data: DailyBudgetPace[];
  totalBudget: number;
  totalSpent: number;
  monthLabel: string;
}

export function BudgetPaceChart({ data, totalBudget, totalSpent, monthLabel }: BudgetPaceChartProps) {
  if (totalBudget === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gasto diario vs presupuesto</CardTitle>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              No tienes presupuesto configurado
            </p>
            <a href="/categories" className="text-xs text-primary hover:underline">
              Configurar presupuesto mensual
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gasto diario vs presupuesto</CardTitle>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Sin gastos registrados este mes
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = Math.round((totalSpent / totalBudget) * 100);
  const todayIndex = data.findIndex((d) => d.isToday);
  const isPastMonth = todayIndex === -1;
  // For past months, the last data point is the "end"; for current month, it's today
  const cutoffIndex = isPastMonth ? data.length - 1 : todayIndex;
  const referencePoint = data[cutoffIndex] ?? null;
  const overBudgetPace = referencePoint
    ? referencePoint.actualCumulative > referencePoint.idealCumulative
    : false;

  // Merge for single chart — show all actual data for past months
  const chartData = data.map((d, i) => ({
    label: d.label,
    ideal: d.idealCumulative,
    actual: i <= cutoffIndex ? d.actualCumulative : undefined,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gasto diario vs presupuesto</CardTitle>
        <p className="text-xs text-muted-foreground">{monthLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              {/* Ideal pace — dotted */}
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="#a1a1aa"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              {/* Actual spending — solid, colored */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke={overBudgetPace ? "var(--z-debt)" : "var(--z-income)"}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              {/* Reference marker (today for current month, last day for past) */}
              {referencePoint && (
                <ReferenceDot
                  x={chartData[cutoffIndex]?.label}
                  y={referencePoint.actualCumulative}
                  r={4}
                  fill={overBudgetPace ? "var(--z-debt)" : "var(--z-income)"}
                  stroke="white"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inline badge */}
        {referencePoint && (
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {isPastMonth ? "Final" : "Hoy"}: {formatCurrency(referencePoint.actualCumulative)}
            </span>
            <span className={overBudgetPace ? "text-z-debt" : "text-z-income"}>
              {formatCurrency(totalSpent)} de {formatCurrency(totalBudget)} — {progress}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
