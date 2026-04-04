"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { MCard } from "./mobile-card";
import { HubEntry } from "./hub-entry";
import { LayoutGrid, BarChart3 } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

type DeudasHubProps = {
  monthlyPayment: number;
  monthlyInterest: number;
  cardUsagePercent: number;
  cardUsedAmount: number;
  cardTotalCupo: number;
  cardInterestMonthly: number;
  totalInterestMonthly: number;
  nearestPayoff: {
    name: string;
    remaining: number;
    months: number;
    progressPercent: number;
  } | null;
  accountCount: number;
  currency: CurrencyCode;
};

export function DeudasHub({
  monthlyPayment,
  monthlyInterest,
  cardUsagePercent,
  cardUsedAmount,
  cardTotalCupo,
  cardInterestMonthly,
  totalInterestMonthly,
  nearestPayoff,
  accountCount,
  currency,
}: DeudasHubProps) {
  const usageClamped = Math.min(100, Math.max(0, cardUsagePercent));
  const payoffClamped = nearestPayoff
    ? Math.min(100, Math.max(0, nearestPayoff.progressPercent))
    : 0;

  // Capital vs interest split for the bar
  const capitalAmount = monthlyPayment - monthlyInterest;
  const capitalPct =
    monthlyPayment > 0
      ? Math.round((capitalAmount / monthlyPayment) * 100)
      : 50;
  const interestPct = 100 - capitalPct;

  // Card interest as percent of total interest
  const cardInterestPct =
    totalInterestMonthly > 0
      ? Math.round((cardInterestMonthly / totalInterestMonthly) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. Cuota hero */}
      <MCard className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div>
            <p className={MOBILE_EYEBROW_CLASS}>CUOTA MENSUAL</p>
            <p
              className="tabular-nums text-[#e8e4dc]"
              style={{ fontSize: 28, fontWeight: 800 }}
            >
              {formatCurrency(monthlyPayment, currency)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <p
              className="tabular-nums text-red-500"
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              {formatCurrency(monthlyInterest, currency)}
            </p>
            <p className={MOBILE_EYEBROW_CLASS}>intereses</p>
          </div>
        </div>

        {/* Split bar: capital (white) vs interest (red) */}
        <div className="flex h-[5px] w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-l-full bg-[#e8e4dc]"
            style={{ width: `${capitalPct}%` }}
          />
          <div
            className="h-full rounded-r-full bg-red-500"
            style={{ width: `${interestPct}%` }}
          />
        </div>

        {/* Labels */}
        <div className="flex items-center justify-between">
          <p className={cn(MOBILE_EYEBROW_CLASS, "text-[9px]")}>
            Capital{" "}
            <span className="text-[#e8e4dc]">
              {formatCurrency(capitalAmount, currency)}
            </span>
          </p>
          <p className={cn(MOBILE_EYEBROW_CLASS, "text-[9px]")}>
            Intereses{" "}
            <span className="text-red-500">
              {formatCurrency(monthlyInterest, currency)}
            </span>
          </p>
        </div>
      </MCard>

      {/* 2. Card usage */}
      <MCard className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <p className={MOBILE_EYEBROW_CLASS}>USO DEL CUPO</p>
          <p
            className="tabular-nums text-z-brass"
            style={{ fontSize: 17, fontWeight: 700 }}
          >
            {cardUsagePercent}%
          </p>
        </div>

        {/* Gradient gauge bar */}
        <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full"
            style={{
              width: `${usageClamped}%`,
              background:
                "linear-gradient(to right, #4ade80, #c4a94d, #ef4444)",
              backgroundSize: "200% 100%",
              backgroundPosition: `${usageClamped}% 0`,
            }}
          />
        </div>

        {/* Used / cupo */}
        <div className="flex items-center justify-between">
          <p className={cn(MOBILE_EYEBROW_CLASS, "text-[9px]")}>
            Usado{" "}
            <span className="text-[#e8e4dc]">
              {formatCurrency(cardUsedAmount, currency)}
            </span>
          </p>
          <p className={cn(MOBILE_EYEBROW_CLASS, "text-[9px]")}>
            Cupo{" "}
            <span className="text-[#e8e4dc]">
              {formatCurrency(cardTotalCupo, currency)}
            </span>
          </p>
        </div>
      </MCard>

      {/* 3. Card interest */}
      <MCard className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className={MOBILE_EYEBROW_CLASS}>INTERESES TARJETAS / MES</p>
          <p
            className="tabular-nums text-red-500"
            style={{ fontSize: 22, fontWeight: 800 }}
          >
            {formatCurrency(cardInterestMonthly, currency)}
          </p>
          <p className={cn(MOBILE_EYEBROW_CLASS, "text-[9px]")}>
            de {formatCurrency(totalInterestMonthly, currency)} total
          </p>
        </div>
        <p
          className="shrink-0 tabular-nums text-[#8a9a7b]"
          style={{ fontSize: 20, fontWeight: 700 }}
        >
          {cardInterestPct}%
        </p>
      </MCard>

      {/* 4. Nearest payoff */}
      {nearestPayoff && (
        <MCard className="flex flex-col gap-2.5 border-emerald-500/10">
          <div className="flex items-start justify-between">
            <div>
              <p className={cn(MOBILE_EYEBROW_CLASS, "text-emerald-500")}>
                MAS CERCA DE LIQUIDAR
              </p>
              <p
                className="mt-0.5 text-[#e8e4dc]"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                {nearestPayoff.name}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-right">
              <p
                className="tabular-nums text-emerald-500"
                style={{ fontSize: 13, fontWeight: 700 }}
              >
                {nearestPayoff.months}m
              </p>
              <p className={MOBILE_EYEBROW_CLASS}>
                {formatCurrency(nearestPayoff.remaining, currency)} restante
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${payoffClamped}%` }}
            />
          </div>
        </MCard>
      )}

      {/* 5. Hub entries */}
      <HubEntry
        href="/deudas/detalle"
        icon={LayoutGrid}
        title="Ver todas las deudas"
        hint={`${accountCount} cuenta${accountCount !== 1 ? "s" : ""} activa${accountCount !== 1 ? "s" : ""}`}
      />
      <HubEntry
        href="/deudas/planificador"
        icon={BarChart3}
        title="Simular escenarios"
        hint="Planifica tu estrategia de pago"
      />
    </div>
  );
}
