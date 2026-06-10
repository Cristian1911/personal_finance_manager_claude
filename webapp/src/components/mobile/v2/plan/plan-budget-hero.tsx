"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronDown } from "lucide-react";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { StateChip } from "@/components/mobile/v2/state-chip";
import type { CurrencyCode, CategoryBudgetData } from "@/types/domain";
import type { PlanPressure } from "@/types/plan";

interface PlanBudgetHeroProps {
  totalSpent: number;
  totalBudgeted: number;
  pressure: PlanPressure;
  dayOfMonth: number;
  daysInMonth: number;
  currency: CurrencyCode;
  categories: CategoryBudgetData[];
  expanded: boolean;
  onToggle: () => void;
}

const pressureConfig = {
  stable: { label: "Holgado", variant: "sage" as const },
  watch: { label: "Atención", variant: "warn" as const },
  critical: { label: "Crítico", variant: "danger" as const },
} as const;

export function PlanBudgetHero({
  totalSpent,
  totalBudgeted,
  pressure,
  dayOfMonth,
  daysInMonth,
  currency,
  categories,
  expanded,
  onToggle,
}: PlanBudgetHeroProps) {
  const progress = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const pacePosition = Math.round((dayOfMonth / daysInMonth) * 100);
  const remaining = totalBudgeted - totalSpent;
  const dailyAvailable = remaining > 0 ? remaining / Math.max(daysInMonth - dayOfMonth, 1) : 0;
  const paceDiff = progress - pacePosition;
  const chip = pressureConfig[pressure];

  const topCategories = categories
    .filter((c) => c.budget && c.budget > 0 && c.direction === "OUTFLOW")
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, 4);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(PANEL_INSET_CLASS, "block w-full p-3.5 text-left")}
      aria-expanded={expanded}
    >
      {/* Eyebrow */}
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
        Gastado este mes
      </p>

      {/* Hero row */}
      <div className="mt-2 flex items-center justify-between">
        <span
          className={cn(
            "text-[46px] font-[680] leading-none tracking-[-0.06em]",
            progress >= 100 ? "text-z-debt" : "text-z-income"
          )}
        >
          {progress}%
        </span>
        <div className="text-right">
          <p className="text-lg font-semibold">{formatCurrency(totalSpent, currency)}</p>
          <p className="text-[11px] text-muted-foreground">
            de {formatCurrency(totalBudgeted, currency)}
          </p>
        </div>
      </div>

      {/* Progress bar with pace marker */}
      <div className="relative mt-3 h-2.5 rounded-full bg-[#1e221d]">
        <div
          className={cn(
            "h-full rounded-full",
            progress >= 100
              ? "bg-gradient-to-r from-z-debt/90 to-z-debt/65"
              : "bg-gradient-to-r from-z-income/90 to-z-income/65"
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
        <div
          className="absolute top-[-2px] h-[14px] w-[2px] rounded-[1px] bg-white/25"
          style={{ left: `${pacePosition}%` }}
        />
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {formatCurrency(dailyAvailable, currency)}/día ·{" "}
          {Math.abs(paceDiff)} pts {paceDiff > 0 ? "sobre" : "bajo"} ritmo
        </span>
        <div className="flex items-center gap-2">
          <StateChip label={chip.label} variant={chip.variant} />
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Expanded: per-category breakdown */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-3 space-y-2 transition-opacity duration-150",
              expanded ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {topCategories.map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium">{cat.name_es ?? cat.name}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      cat.percentUsed >= 100
                        ? "text-z-debt"
                        : cat.percentUsed >= 80
                          ? "text-z-alert"
                          : "text-z-income"
                    )}
                  >
                    {Math.round(cat.percentUsed)}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      cat.percentUsed >= 100
                        ? "bg-z-debt"
                        : cat.percentUsed >= 80
                          ? "bg-z-alert"
                          : "bg-z-income"
                    )}
                    style={{ width: `${Math.min(cat.percentUsed, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">
              {topCategories.length} de {categories.filter((c) => c.budget && c.budget > 0).length} categorías
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
