"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface WaterfallChartProps {
  income: number;
  categories: Array<{ name: string; amount: number }>;
  net: number;
  currency: CurrencyCode;
}

interface BarItem {
  label: string;
  amount: number;
  heightPercent: number;
  isIncome: boolean;
  isNet: boolean;
}

export function WaterfallChart({
  income,
  categories,
  net,
  currency,
}: WaterfallChartProps) {
  if (income <= 0 && categories.length === 0) return null;

  // Sort categories descending, take top 5, bucket the rest into "Otros"
  const sorted = [...categories].sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const otrosAmount = rest.reduce((sum, c) => sum + c.amount, 0);
  const displayCategories =
    otrosAmount > 0 ? [...top, { name: "Otros", amount: otrosAmount }] : top;

  const maxValue = income > 0 ? income : 1;

  const bars: BarItem[] = [
    {
      label: "Ingresos",
      amount: income,
      heightPercent: 100,
      isIncome: true,
      isNet: false,
    },
    ...displayCategories.map((c) => ({
      label: c.name,
      amount: c.amount,
      heightPercent: Math.max((c.amount / maxValue) * 100, 2),
      isIncome: false,
      isNet: false,
    })),
    {
      label: "Neto",
      amount: Math.max(net, 0),
      heightPercent: Math.max((Math.max(net, 0) / maxValue) * 100, 2),
      isIncome: false,
      isNet: true,
    },
  ];

  return (
    <div
      className="flex items-end gap-1.5"
      style={{ height: "180px" }}
      aria-label="Flujo de caja waterfall"
    >
      {bars.map((bar) => (
        <div
          key={bar.label}
          className="flex flex-col items-center flex-1"
          style={{ height: "100%", justifyContent: "flex-end" }}
        >
          <span className="text-[10px] font-bold mb-1 leading-none text-center">
            {formatCurrency(bar.amount, currency)}
          </span>
          <div
            className={cn(
              "w-full rounded-t",
              bar.isIncome
                ? "bg-z-income"
                : bar.isNet
                  ? "border border-z-income bg-z-income/10"
                  : "bg-z-expense"
            )}
            style={{
              height: `${bar.heightPercent}%`,
              minHeight: "4px",
            }}
          />
          <span className="text-[9px] text-muted-foreground mt-1.5 text-center truncate w-full">
            {bar.label}
          </span>
        </div>
      ))}
    </div>
  );
}
