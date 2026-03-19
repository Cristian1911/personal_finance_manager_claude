"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
  Bar,
  BarChart,
  CartesianGrid,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { MonthlyCashflow } from "@/actions/charts";

interface CashFlowViewToggleProps {
  data: MonthlyCashflow[];
  monthLabel: string;
}

type View = "line" | "bar";

const barChartConfig = {
  income: {
    label: "Ingresos",
    color: "var(--z-income)",
  },
  expenses: {
    label: "Gastos",
    color: "var(--z-expense)",
  },
} satisfies ChartConfig;

export function CashFlowViewToggle({
  data,
  monthLabel,
}: CashFlowViewToggleProps) {
  const [view, setView] = useState<View>("line");

  if (data.length === 0) return null;

  const current = data[data.length - 1];
  const previous = data.length >= 2 ? data[data.length - 2] : null;
  const savingsRate =
    current.income > 0
      ? ((current.income - current.expenses) / current.income) * 100
      : 0;
  const prevSavingsRate =
    previous && previous.income > 0
      ? ((previous.income - previous.expenses) / previous.income) * 100
      : 0;
  const savingsTrend = savingsRate - prevSavingsRate;
  const hasNoIncome = data.every((d) => d.income === 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Ingresos vs Gastos</CardTitle>
            <p className="text-xs text-muted-foreground capitalize">
              6 meses hasta {monthLabel}
            </p>
          </div>
          {/* View toggle */}
          <div className="flex rounded-md bg-muted p-0.5">
            <button
              onClick={() => setView("line")}
              className={cn(
                "px-3 py-1 text-xs rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                view === "line"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Línea
            </button>
            <button
              onClick={() => setView("bar")}
              className={cn(
                "px-3 py-1 text-xs rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                view === "bar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Barras
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {view === "line" ? (
          <>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                >
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
                  <span
                    className={
                      savingsRate >= 0 ? "text-z-income" : "text-z-debt"
                    }
                  >
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
                  No se detectaron ingresos. Importa un extracto de cuenta de
                  ahorros para ver tu flujo completo.
                </p>
              )}
            </div>
          </>
        ) : (
          <ChartContainer
            config={barChartConfig}
            className="aspect-auto h-[240px] w-full overflow-hidden"
          >
            <BarChart data={data} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tickFormatter={(v) => {
                  if (v >= 1_000_000)
                    return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                  return String(v);
                }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as MonthlyCashflow;
                  return (
                    <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                      <p className="font-medium mb-1.5">{d.label}</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: "var(--z-income)" }}
                          />
                          <span className="text-muted-foreground">
                            Ingresos:
                          </span>
                          <span className="font-medium ml-auto">
                            {formatCurrency(d.income)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: "var(--z-expense)" }}
                          />
                          <span className="text-muted-foreground">Gastos:</span>
                          <span className="font-medium ml-auto">
                            {formatCurrency(d.expenses)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t">
                          <span className="text-muted-foreground">Neto:</span>
                          <span
                            className={`font-medium ml-auto ${d.net >= 0 ? "text-z-income" : "text-z-debt"}`}
                          >
                            {d.net >= 0 ? "+" : ""}
                            {formatCurrency(d.net)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="income"
                fill="var(--color-income)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="expenses"
                fill="var(--color-expenses)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
