"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { MCard } from "./mobile-card";
import { HubEntry } from "./hub-entry";
import { LayoutGrid, CalendarDays } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

type PlanHubProps = {
  budgetPercent: number;
  spent: number;
  total: number;
  dailyAvailable: number;
  daysRemaining: number;
  overBudgetCount: number;
  nextPaymentName: string | null;
  nextPaymentDays: number | null;
  allocationStyle: "50_30_20" | "ynab" | "per_category";
  distribution: { label: string; percent: number; color: string }[];
  currency: CurrencyCode;
};

const ALLOCATION_STYLE_LABELS: Record<PlanHubProps["allocationStyle"], string> =
  {
    "50_30_20": "50/30/20",
    ynab: "YNAB",
    per_category: "Por categoría",
  };

function statusChip(percent: number) {
  if (percent >= 100)
    return { label: "Sobre el ritmo", className: "bg-red-500/10 text-red-500" };
  if (percent >= 75)
    return {
      label: "Al límite",
      className: "bg-amber-400/10 text-amber-400",
    };
  return {
    label: "Holgado",
    className: "bg-emerald-500/10 text-emerald-500",
  };
}

export function PlanHub({
  budgetPercent,
  spent,
  total,
  dailyAvailable,
  daysRemaining,
  overBudgetCount,
  nextPaymentName,
  nextPaymentDays,
  allocationStyle,
  distribution,
  currency,
}: PlanHubProps) {
  const clamped = Math.min(100, Math.max(0, budgetPercent));
  const chip = statusChip(budgetPercent);

  const pctColor =
    budgetPercent >= 100
      ? "text-red-500"
      : budgetPercent >= 75
        ? "text-amber-400"
        : "text-emerald-500";

  const barColor =
    budgetPercent >= 100
      ? "bg-red-500"
      : budgetPercent >= 75
        ? "bg-amber-400"
        : "bg-emerald-500";

  const hubPresupuestoHint =
    overBudgetCount > 0
      ? `${overBudgetCount} categoría${overBudgetCount > 1 ? "s" : ""} sobre el límite`
      : "Todo dentro del plan";

  const hubPagosHint =
    nextPaymentName && nextPaymentDays != null
      ? `${nextPaymentName} en ${nextPaymentDays}d`
      : "Sin pagos próximos";

  return (
    <div className="flex flex-col gap-2.5">
      {/* Budget health card */}
      <MCard className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div>
            <p className={MOBILE_EYEBROW_CLASS}>GASTADO ESTE MES</p>
            <p
              className={cn("tabular-nums", pctColor)}
              style={{ fontSize: 28, fontWeight: 800 }}
            >
              {budgetPercent}%
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <p
              className="tabular-nums text-[#e8e4dc]"
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              {formatCurrency(spent, currency)}
            </p>
            <p className={cn(MOBILE_EYEBROW_CLASS)}>
              de {formatCurrency(total, currency)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/8">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${clamped}%` }}
          />
        </div>

        {/* Pace + chip */}
        <div className="flex items-center justify-between">
          <p className={cn(MOBILE_EYEBROW_CLASS, "text-[9px]")}>
            {formatCurrency(dailyAvailable, currency)}/día · {daysRemaining}d
            restantes
          </p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-semibold",
              chip.className,
            )}
          >
            {chip.label}
          </span>
        </div>
      </MCard>

      {/* Hub entries */}
      <HubEntry
        href="/presupuesto"
        icon={LayoutGrid}
        title="Presupuesto"
        hint={hubPresupuestoHint}
      />
      <HubEntry
        href="/recurrentes"
        icon={CalendarDays}
        title="Pagos"
        hint={hubPagosHint}
      />

      {/* Distribution card */}
      <MCard className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className={MOBILE_EYEBROW_CLASS}>DISTRIBUCION</p>
          <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[9px] font-medium text-[#8a9a7b]">
            {ALLOCATION_STYLE_LABELS[allocationStyle]}
          </span>
        </div>

        {/* Horizontal bar sections */}
        <div className="flex h-[5px] w-full overflow-hidden rounded-full">
          {distribution.map((seg, i) => (
            <div
              key={i}
              style={{ width: `${seg.percent}%`, backgroundColor: seg.color }}
              className="h-full first:rounded-l-full last:rounded-r-full"
            />
          ))}
        </div>

        {/* Labels */}
        <div className="flex flex-col gap-1">
          {distribution.map((seg, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className="size-[6px] shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <p className={cn(MOBILE_EYEBROW_CLASS, "text-[9px]")}>
                  {seg.label}
                </p>
              </div>
              <p className="tabular-nums text-[9px] font-semibold text-[#e8e4dc]">
                {seg.percent}%
              </p>
            </div>
          ))}
        </div>
      </MCard>
    </div>
  );
}
