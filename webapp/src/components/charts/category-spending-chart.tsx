"use client";

import { useMemo } from "react";
import { Label, Pie, PieChart } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
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
import type { CategorySpending } from "@/actions/charts";

interface Props {
  data: CategorySpending[];
  monthLabel?: string;
}

export function CategorySpendingChart({ data, monthLabel }: Props) {
  // Take top 5 + group the rest as "Otros"
  const { chartData, config, total } = useMemo(() => {
    if (data.length === 0) return { chartData: [], config: {} as ChartConfig, total: 0 };

    const top = data.slice(0, 5);
    const restAmount = data.slice(5).reduce((sum, c) => sum + c.amount, 0);

    const items = top.map((c, i) => ({
      name: c.name,
      amount: c.amount,
      fill: c.color,
      key: `cat-${i}`,
    }));

    if (restAmount > 0) {
      items.push({
        name: "Otros",
        amount: restAmount,
        fill: "#94a3b8",
        key: "cat-others",
      });
    }

    const cfg: ChartConfig = {};
    for (const item of items) {
      cfg[item.name] = { label: item.name, color: item.fill };
    }

    return {
      chartData: items,
      config: cfg,
      total: data.reduce((sum, c) => sum + c.amount, 0),
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gastos por categoría</CardTitle>
          <CardDescription className="capitalize">Gastos — {monthLabel ?? "este mes"}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px]">
          <p className="text-sm text-muted-foreground">
            No hay gastos registrados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por categoría</CardTitle>
        <CardDescription>Distribución de gastos del mes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[280px]">
          <PieChart>
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const item = payload[0];
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.payload.fill }}
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {formatCurrency(item.value as number)}
                    </div>
                  </div>
                );
              }}
            />
            <Pie
              data={chartData}
              dataKey="amount"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              strokeWidth={2}
              stroke="var(--background)"
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) - 8}
                          className="fill-foreground text-xl font-bold"
                        >
                          {formatCurrency(total)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 12}
                          className="fill-muted-foreground text-xs"
                        >
                          Total gastos
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
