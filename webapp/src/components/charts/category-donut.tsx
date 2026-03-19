"use client";

import { PieChart, Pie, Cell } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategorySpending } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

interface CategoryDonutProps {
  data: CategorySpending[];
  currency: CurrencyCode;
}

const COLORS = [
  "var(--z-expense)",
  "var(--z-alert)",
  "var(--z-income)",
  "var(--z-sage-dark)",
  "var(--z-sage-dark)",
  "var(--z-sage)",
];

const OTROS_COLOR = "var(--z-sage-muted)";

// ChartContainer needs a config even for Pie charts
const chartConfig = {} satisfies ChartConfig;

export function CategoryDonut({ data, currency }: CategoryDonutProps) {
  if (!data || data.length === 0) return null;

  // Sort descending, cap at 6, bucket the rest into "Otros"
  const sorted = [...data].sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  const otrosAmount = rest.reduce((sum, c) => sum + c.amount, 0);

  const pieData = [
    ...top.map((c, i) => ({
      name: c.name,
      value: c.amount,
      color: COLORS[i] ?? OTROS_COLOR,
    })),
    ...(otrosAmount > 0
      ? [{ name: "Otros", value: otrosAmount, color: OTROS_COLOR }]
      : []),
  ];

  const legendItems = pieData;

  return (
    <div className="flex items-center gap-5">
      {/* Donut */}
      <div className="w-[140px] h-[140px] shrink-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <PieChart>
            <Pie
              data={pieData}
              innerRadius="65%"
              outerRadius="95%"
              dataKey="value"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-1.5 min-w-0">
        {legendItems.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted-foreground truncate flex-1">
              {item.name}
            </span>
            <span className="text-xs font-bold shrink-0">
              {formatCurrency(item.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
