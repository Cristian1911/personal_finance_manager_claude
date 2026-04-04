"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { MCard, MCardGrid, MCardTight, MCardHeader } from "./mobile-card";
import type { CurrencyCode } from "@/types/domain";

type FocusProps = {
  healthScore: number;
  availableToSpend: number;
  budgetPercent: number;
  pendingCount: number;
  debtFreeMonths: number | null;
  lastTransaction: { description: string; amount: number } | null;
  currency: CurrencyCode;
};

export function DashboardFocus({
  healthScore,
  availableToSpend,
  budgetPercent,
  pendingCount,
  debtFreeMonths,
  lastTransaction,
  currency,
}: FocusProps) {
  // SVG ring: r=46, circumference = 2π*46 ≈ 289
  const circumference = 289;
  const arcLength = (circumference * Math.min(100, Math.max(0, healthScore))) / 100;

  const planColor =
    budgetPercent >= 100
      ? "text-red-500"
      : budgetPercent >= 75
        ? "text-amber-400"
        : "text-emerald-500";

  return (
    <div className="flex flex-col gap-2.5">
      {/* Health ring */}
      <MCard className="flex flex-col items-center py-5">
        <p className={cn(MOBILE_EYEBROW_CLASS, "mb-3")}>SALUD FINANCIERA</p>
        <div className="relative flex items-center justify-center">
          <svg width={112} height={112} viewBox="0 0 100 100">
            {/* Track */}
            <circle
              cx={50}
              cy={50}
              r={46}
              fill="none"
              stroke="#c4a94d"
              strokeOpacity={0.15}
              strokeWidth={6}
            />
            {/* Arc */}
            <circle
              cx={50}
              cy={50}
              r={46}
              fill="none"
              stroke="#c4a94d"
              strokeOpacity={0.8}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span
              className="tabular-nums leading-none text-[#e8e4dc]"
              style={{ fontSize: 28, fontWeight: 800 }}
            >
              {healthScore}
            </span>
            <span className={cn(MOBILE_EYEBROW_CLASS, "mt-0.5")}>DE 100</span>
          </div>
        </div>
      </MCard>

      {/* 2×2 metrics */}
      <MCardGrid>
        {/* Disponible */}
        <div className="flex flex-col gap-0.5">
          <p className={MOBILE_EYEBROW_CLASS}>DISPONIBLE</p>
          <p
            className="tabular-nums text-[#e8e4dc]"
            style={{ fontSize: 17, fontWeight: 700 }}
          >
            {formatCurrency(availableToSpend, currency)}
          </p>
        </div>

        {/* Plan % */}
        <div className="flex flex-col gap-0.5">
          <p className={MOBILE_EYEBROW_CLASS}>PLAN %</p>
          <p
            className={cn("tabular-nums", planColor)}
            style={{ fontSize: 17, fontWeight: 700 }}
          >
            {budgetPercent}%
          </p>
        </div>

        {/* Pendientes */}
        <div className="relative flex flex-col gap-0.5">
          <p className={MOBILE_EYEBROW_CLASS}>PENDIENTES</p>
          <div className="relative inline-flex items-center gap-1">
            <p
              className="tabular-nums text-[#e8e4dc]"
              style={{ fontSize: 17, fontWeight: 700 }}
            >
              {pendingCount}
            </p>
            {pendingCount > 0 && (
              <span className="size-[5px] shrink-0 rounded-full bg-z-brass" />
            )}
          </div>
        </div>

        {/* Libre de deuda */}
        <div className="flex flex-col gap-0.5">
          <p className={MOBILE_EYEBROW_CLASS}>LIBRE DEUDA</p>
          <p
            className="tabular-nums text-[#e8e4dc]"
            style={{ fontSize: 17, fontWeight: 700 }}
          >
            {debtFreeMonths != null ? `${debtFreeMonths}m` : "—"}
          </p>
        </div>
      </MCardGrid>

      {/* Last transaction */}
      {lastTransaction && (
        <MCardTight>
          <MCardHeader>
            <p className={MOBILE_EYEBROW_CLASS}>ULTIMO</p>
          </MCardHeader>
          <div className="flex items-center justify-between px-3.5 pb-3">
            <p
              className="min-w-0 flex-1 truncate text-[#e8e4dc]"
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              {lastTransaction.description}
            </p>
            <p
              className="ml-2 shrink-0 tabular-nums text-[#e8e4dc]"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {formatCurrency(lastTransaction.amount, currency)}
            </p>
          </div>
        </MCardTight>
      )}
    </div>
  );
}
