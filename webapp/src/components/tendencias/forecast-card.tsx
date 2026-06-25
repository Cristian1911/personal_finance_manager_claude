"use client";
import { Line, LineChart, XAxis } from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import type { ForecastPoint } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import { monthShort } from "./format";

const config = { balance: { label: "Proyección", color: "var(--z-brass-hot)" } } satisfies ChartConfig;

export function ForecastCard({
  points,
  currentBalance,
  currency,
}: {
  points: ForecastPoint[];
  currentBalance: number;
  currency: CurrencyCode;
}) {
  // Engine returns only future points; seed the line at today's balance ("hoy").
  const data = [{ month: "hoy", balance: Math.round(currentBalance) }, ...points.map((p) => ({ month: monthShort(p.month), balance: p.balance }))];
  const last = points[points.length - 1];
  return (
    <div className={`mt-3 ${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-2 text-sm font-semibold">Proyección de saldo</p>
      <ChartContainer config={config} className="h-28 w-full">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} accessibilityLayer>
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} fontSize={10} />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="var(--color-balance)"
            strokeWidth={2.2}
            strokeDasharray="4 4"
            dot={{ r: 2.5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <div className="mt-2 flex justify-between text-[11px]">
        <span className="text-z-sage-dark">
          Saldo hoy <b className="tabular-nums text-z-white">{formatCurrency(currentBalance, currency)}</b>
        </span>
        {last && (
          <span className="text-z-sage-dark">
            Proy. {monthShort(last.month)} <b className="tabular-nums text-z-brass">{formatCurrency(last.balance, currency)}</b>
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-z-sage-dark">
        Proyección lineal sobre tu neto promedio. No incluye ingresos no confirmados.
      </p>
    </div>
  );
}
