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
import type { MonthlyCashflow } from "@/actions/charts";

interface IncomeVsExpensesChartProps {
  data: MonthlyCashflow[];
  monthLabel: string;
}

export function IncomeVsExpensesChart({ data, monthLabel }: IncomeVsExpensesChartProps) {
  if (data.length === 0) return null;

  const current = data[data.length - 1];
  const previous = data.length >= 2 ? data[data.length - 2] : null;
  const savingsRate = current.income > 0
    ? ((current.income - current.expenses) / current.income) * 100
    : 0;
  const prevSavingsRate = previous && previous.income > 0
    ? ((previous.income - previous.expenses) / previous.income) * 100
    : 0;
  const savingsTrend = savingsRate - prevSavingsRate;
  const hasNoIncome = data.every((d) => d.income === 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Ingresos vs Gastos</CardTitle>
        <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              {/* Income — solid */}
              <Line
                type="monotone"
                dataKey="income"
                stroke="var(--z-income)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {/* Expenses — dashed */}
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="var(--z-expense)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
              />
              {/* Current month dots */}
              <ReferenceDot
                x={current.label}
                y={current.income}
                r={4}
                fill="var(--z-income)"
                stroke="white"
                strokeWidth={2}
              />
              <ReferenceDot
                x={current.label}
                y={current.expenses}
                r={4}
                fill="var(--z-expense)"
                stroke="white"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inline badge */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-z-income" />
                Ingresos: {formatCurrency(current.income)}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-z-expense" />
                Gastos: {formatCurrency(current.expenses)}
              </span>
            </div>
            {current.income > 0 && (
              <span className={savingsRate >= 0 ? "text-z-income" : "text-z-debt"}>
                Ahorro: {savingsRate.toFixed(0)}%
                {savingsTrend !== 0 && (
                  <span className="ml-1">
                    {savingsTrend > 0 ? "↑" : "↓"}
                  </span>
                )}
              </span>
            )}
          </div>
          {hasNoIncome && (
            <p className="text-xs text-muted-foreground">
              No se detectaron ingresos. Importa un extracto de cuenta de ahorros para ver tu flujo completo.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
