"use client";
import { Area, AreaChart, ReferenceLine, XAxis } from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import type { SavingsPoint } from "@zeta/shared";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { monthShort } from "./format";

const config = { rate: { label: "Tasa de ahorro", color: "var(--z-brass-hot)" } } satisfies ChartConfig;

export function SavingsRateCard({ savings }: { savings: SavingsPoint[] }) {
  const data = savings.map((s) => ({ month: monthShort(s.month), rate: s.rate == null ? 0 : Math.round(s.rate * 100) }));
  const current = data[data.length - 1]?.rate ?? 0;
  return (
    <div className={`${PANEL_SURFACE_CLASS} p-4`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Tasa de ahorro</p>
        <span className="text-lg font-bold tabular-nums text-z-brass">{current}%</span>
      </div>
      <ChartContainer config={config} className="h-28 w-full">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="srGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-rate)" stopOpacity={0.4} />
              <stop offset="1" stopColor="var(--color-rate)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <ReferenceLine y={20} stroke="var(--z-income)" strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} fontSize={10} />
          <Area type="monotone" dataKey="rate" stroke="var(--color-rate)" strokeWidth={2.2} fill="url(#srGrad)" isAnimationActive={false} />
        </AreaChart>
      </ChartContainer>
      <p className="mt-1 text-[11px] text-z-sage-dark">Meta 20%</p>
    </div>
  );
}
