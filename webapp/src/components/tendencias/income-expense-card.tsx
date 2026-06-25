"use client";
import { Bar, BarChart, XAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { CashflowPoint } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import { monthShort } from "./format";

const config = {
  income: { label: "Ingreso", color: "var(--z-income)" },
  expense: { label: "Gasto", color: "var(--z-expense)" },
} satisfies ChartConfig;

export function IncomeExpenseCard({ cashflow, currency }: { cashflow: CashflowPoint[]; currency: CurrencyCode }) {
  const data = cashflow.map((p) => ({ month: monthShort(p.month), income: p.income, expense: p.expense, net: p.net }));
  const avgNet = cashflow.length ? cashflow.reduce((a, p) => a + p.net, 0) / cashflow.length : 0;
  return (
    <div className={`mt-3 ${PANEL_SURFACE_CLASS} p-4`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Ingreso vs. gasto</p>
        <span className="text-xs text-z-sage-dark">
          Neto prom{" "}
          <b className={avgNet >= 0 ? "text-z-income" : "text-z-expense"}>
            {avgNet >= 0 ? "+" : ""}
            {formatCurrency(avgNet, currency)}
          </b>
        </span>
      </div>
      <ChartContainer config={config} className="h-32 w-full">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} accessibilityLayer>
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} fontSize={10} />
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { month: string; income: number; expense: number; net: number };
              return (
                <div className="rounded-lg border bg-background p-2 text-xs shadow-sm">
                  <p className="mb-1 font-medium">{d.month}</p>
                  <p className="text-z-income">Ingreso {formatCurrency(d.income, currency)}</p>
                  <p className="text-z-expense">Gasto {formatCurrency(d.expense, currency)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="income" fill="var(--color-income)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expense" fill="var(--color-expense)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
