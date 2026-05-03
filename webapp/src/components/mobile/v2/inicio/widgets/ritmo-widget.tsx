"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { RunwayMiniChart } from "@/components/dashboard/runway-mini-chart";
import { ChipEyebrow } from "../widget-chip";
import type { WidgetRender } from "../widget-grid";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";

interface RitmoWidgetProps {
  dayOfMonth: number;
  daysInMonth: number;
  burnRateData: BurnRateResponse | null;
  currency: CurrencyCode;
}

function ArcRing({ percentage }: { percentage: number }) {
  const r = 24;
  const cx = 30;
  const cy = 30;
  const circumference = 2 * Math.PI * r;
  const offset = Math.round((circumference - (percentage / 100) * circumference) * 100) / 100;

  return (
    <svg width={60} height={60} viewBox="0 0 60 60" className="shrink-0" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-z-surface-3)" strokeWidth={5} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--color-z-income)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[13px] font-bold"
      >
        {percentage}%
      </text>
    </svg>
  );
}

export function renderRitmoWidget(props: RitmoWidgetProps): WidgetRender {
  const { dayOfMonth, daysInMonth, burnRateData, currency } = props;
  const percentage = Math.round((dayOfMonth / daysInMonth) * 100);

  return {
    tone: "brass",
    accessibilityLabel: `Ritmo: día ${dayOfMonth} de ${daysInMonth}`,
    chip: (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
        <ChipEyebrow>Ritmo</ChipEyebrow>
        <ArcRing percentage={percentage} />
        <p className="text-[10px] text-muted-foreground whitespace-nowrap">
          día {dayOfMonth} de {daysInMonth}
        </p>
      </div>
    ),
    detail: (
      <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3 space-y-2")}>
        {burnRateData ? (
          <>
            <RunwayMiniChart
              dataPoints={burnRateData.discretionary.dataPoints}
              runwayDays={burnRateData.discretionary.runwayDays}
              dayOfMonth={dayOfMonth}
              daysInMonth={daysInMonth}
              obligations={burnRateData.obligations}
              nextIncomeDate={burnRateData.nextIncomeDate}
              currency={currency}
            />
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted-foreground">Promedio diario</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(burnRateData.discretionary.dailyAverage, currency)}/día
              </span>
            </div>
            {burnRateData.nextIncomeDate && (
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-z-income">Próximo ingreso</span>
                <span className="font-semibold tabular-nums text-z-income">
                  +{formatCurrency(burnRateData.nextIncomeAmount, currency)}
                  <span className="font-normal text-muted-foreground">
                    {" · día "}
                    {parseInt(burnRateData.nextIncomeDate.split("-")[2], 10)}
                  </span>
                </span>
              </div>
            )}
            <Link
              href="/plan"
              className="block rounded-xl border border-z-brass/20 bg-z-brass/8 px-3 py-2 text-center text-[11px] font-semibold text-z-brass transition-colors active:bg-z-brass/15"
            >
              Ver plan completo
            </Link>
          </>
        ) : (
          <div className="space-y-2 text-center">
            <p className="text-[11px] text-muted-foreground">
              Aún no hay historial suficiente para calcular tu ritmo en {currency}.
            </p>
            <Link
              href="/transactions/new"
              className="block rounded-xl border border-z-brass/20 bg-z-brass/8 px-3 py-2 text-[11px] font-semibold text-z-brass transition-colors active:bg-z-brass/15"
            >
              Agregar movimiento →
            </Link>
          </div>
        )}
      </div>
    ),
  };
}
