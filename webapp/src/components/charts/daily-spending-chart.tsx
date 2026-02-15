"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import type { DailySpending } from "@/actions/charts";

interface Props {
  data: DailySpending[];
  monthLabel?: string;
}

const chartConfig = {
  amount: {
    label: "Gastos",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

export function DailySpendingChart({ data, monthLabel }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gastos diarios</CardTitle>
          <CardDescription className="capitalize">Gastos diarios — {monthLabel ?? "este mes"}</CardDescription>
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
        <CardTitle>Gastos diarios</CardTitle>
        <CardDescription className="capitalize">Gastos diarios — {monthLabel ?? "este mes"}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full overflow-hidden">
          <AreaChart data={data} accessibilityLayer>
            <defs>
              <linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-amount)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-amount)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
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
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload as DailySpending;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                    <p className="text-muted-foreground">{d.label}</p>
                    <p className="font-medium mt-0.5">{formatCurrency(d.amount)}</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--color-amount)"
              fill="url(#fillAmount)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
