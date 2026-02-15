"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { MonthlyCashflow } from "@/actions/charts";

interface Props {
  data: MonthlyCashflow[];
  monthLabel?: string;
}

const chartConfig = {
  income: {
    label: "Ingresos",
    color: "var(--chart-2)",
  },
  expenses: {
    label: "Gastos",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function MonthlyCashflowChart({ data, monthLabel }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ingresos vs Gastos</CardTitle>
          <CardDescription className="capitalize">Comparación mensual</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-sm text-muted-foreground">
            No hay datos suficientes para mostrar la tendencia
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos vs Gastos</CardTitle>
        <CardDescription className="capitalize">6 meses hasta {monthLabel ?? "hoy"}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full overflow-hidden">
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
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
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
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--chart-2)" }} />
                        <span className="text-muted-foreground">Ingresos:</span>
                        <span className="font-medium ml-auto">{formatCurrency(d.income)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
                        <span className="text-muted-foreground">Gastos:</span>
                        <span className="font-medium ml-auto">{formatCurrency(d.expenses)}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <span className="text-muted-foreground">Neto:</span>
                        <span className={`font-medium ml-auto ${d.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {d.net >= 0 ? "+" : ""}{formatCurrency(d.net)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
