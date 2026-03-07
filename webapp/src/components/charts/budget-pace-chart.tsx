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
  if (data.length === 0 || totalBudget === 0) return null;

  const progress = Math.round((totalSpent / totalBudget) * 100);
  const todayIndex = data.findIndex((d) => d.isToday);
  const todayPoint = todayIndex >= 0 ? data[todayIndex] : null;
  const overBudgetPace = todayPoint
    ? todayPoint.actualCumulative > todayPoint.idealCumulative
    : false;

  // Merge for single chart
  const chartData = data.map((d, i) => ({
    label: d.label,
    ideal: d.idealCumulative,
    actual: i <= todayIndex ? d.actualCumulative : undefined,
    isToday: d.isToday,
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
                stroke={overBudgetPace ? "#ef4444" : "#10b981"}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              {/* Today marker */}
              {todayPoint && todayIndex >= 0 && (
                <ReferenceDot
                  x={chartData[todayIndex]?.label}
                  y={todayPoint.actualCumulative}
                  r={4}
                  fill={overBudgetPace ? "#ef4444" : "#10b981"}
                  stroke="white"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inline badge */}
        {todayPoint && (
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Hoy: {formatCurrency(todayPoint.actualCumulative)}
            </span>
            <span className={overBudgetPace ? "text-red-600" : "text-emerald-600"}>
              {formatCurrency(totalSpent)} de {formatCurrency(totalBudget)} — {progress}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
