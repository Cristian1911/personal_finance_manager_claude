"use client";

import { useState, useMemo } from "react";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { Tables } from "@/types/database";

interface Props {
  snapshots: Tables<"statement_snapshots">[];
  currency: Tables<"accounts">["currency_code"];
}

const chartConfig = {
  balance: {
    label: "Saldo",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

type TimeRange = "3m" | "6m" | "1y" | "all";

const RANGE_MS: Record<Exclude<TimeRange, "all">, number> = {
  "3m": 90 * 24 * 60 * 60 * 1000,
  "6m": 180 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

export function BalanceHistoryChart({ snapshots, currency }: Props) {
  const [range, setRange] = useState<TimeRange>("all");

  const allData = useMemo(() => {
    return [...snapshots]
      .filter((s) => s.final_balance !== null && s.period_to !== null)
      .sort(
        (a, b) =>
          new Date(a.period_to!).getTime() - new Date(b.period_to!).getTime()
      )
      .map((s) => ({
        date: s.period_to as string,
        balance: s.final_balance as number,
      }));
  }, [snapshots]);

  const data = useMemo(() => {
    if (range === "all") return allData;
    const cutoff = Date.now() - RANGE_MS[range];
    const filtered = allData.filter(
      (d) => new Date(d.date).getTime() >= cutoff
    );
    // Fall back to all data if filtered has fewer than 2 points
    return filtered.length >= 2 ? filtered : allData;
  }, [allData, range]);

  if (allData.length < 2) {
    return null;
  }

  const minBalance = Math.min(...data.map((d) => d.balance));

  const formatYAxis = (v: number) => {
    if (Math.abs(v) >= 1_000_000)
      return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return String(v);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Historial de Saldo</CardTitle>
          <CardDescription>
            Evolución del saldo según tus extractos
          </CardDescription>
        </div>
        <ToggleGroup
          type="single"
          value={range}
          onValueChange={(v) => {
            if (v) setRange(v as TimeRange);
          }}
          className="gap-0.5"
        >
          <ToggleGroupItem value="3m" className="h-7 px-2 text-xs">
            3M
          </ToggleGroupItem>
          <ToggleGroupItem value="6m" className="h-7 px-2 text-xs">
            6M
          </ToggleGroupItem>
          <ToggleGroupItem value="1y" className="h-7 px-2 text-xs">
            1A
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="h-7 px-2 text-xs">
            Todo
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[240px] w-full overflow-hidden"
        >
          <AreaChart
            data={data}
            accessibilityLayer
            margin={{ top: 10, left: -20, right: 12, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="fillBalance"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-balance)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-balance)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("es-CO", {
                  month: "short",
                  year: "2-digit",
                });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[minBalance > 0 ? 0 : "dataMin", "auto"]}
              tickFormatter={formatYAxis}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                    <p className="font-medium mb-1.5 text-muted-foreground">
                      {formatDate(d.date)}
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: "var(--color-balance)",
                        }}
                      />
                      <span className="font-medium">
                        {formatCurrency(d.balance, currency)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              dataKey="balance"
              type="monotone"
              fill="url(#fillBalance)"
              fillOpacity={1}
              stroke="var(--color-balance)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
