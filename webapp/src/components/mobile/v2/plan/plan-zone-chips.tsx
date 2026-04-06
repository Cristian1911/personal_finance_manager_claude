"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { ChevronRight } from "lucide-react";
import type { PlanBudgetSummary, PlanRecurringSummary } from "@/types/plan";
import type { CurrencyCode } from "@/types/domain";

interface PlanZoneChipsProps {
  budget: PlanBudgetSummary;
  recurring: PlanRecurringSummary;
  currency: CurrencyCode;
  activeZone: string | null;
  onToggle: (zone: string) => void;
}

function compact(amount: number, currency: CurrencyCode): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`;
  return formatCurrency(amount, currency);
}

function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("text-[12px] font-semibold tabular-nums", valueClass)}>
        {value}
      </span>
    </div>
  );
}

export function PlanZoneChips({
  budget,
  recurring,
  currency,
  activeZone,
  onToggle,
}: PlanZoneChipsProps) {
  const budgetPct =
    budget.totalBudgeted > 0
      ? Math.round((budget.totalSpent / budget.totalBudgeted) * 100)
      : 0;

  const isBudgetActive = activeZone === "budget";
  const isRecurringActive = activeZone === "recurring";
  const hasActive = isBudgetActive || isRecurringActive;

  const netRecurring = recurring.totalMonthlyIncome - recurring.totalMonthlyExpenses;

  return (
    <div>
      {/* Chip row */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Presupuesto chip */}
        <button
          type="button"
          onClick={() => onToggle("budget")}
          className={cn(
            PANEL_INSET_CLASS,
            "flex w-full flex-col items-center justify-center px-3 py-3 transition-colors",
            isBudgetActive && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]"
          )}
          aria-expanded={isBudgetActive}
        >
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Presupuesto
          </p>
          <p className="text-[22px] font-[650] leading-tight">{budgetPct}%</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {compact(budget.totalSpent, currency)} de {compact(budget.totalBudgeted, currency)}
          </p>
        </button>

        {/* Obligaciones chip */}
        <button
          type="button"
          onClick={() => onToggle("recurring")}
          className={cn(
            PANEL_INSET_CLASS,
            "flex w-full flex-col items-center justify-center px-3 py-3 transition-colors",
            isRecurringActive && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]"
          )}
          aria-expanded={isRecurringActive}
        >
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Obligaciones
          </p>
          <p className="text-[18px] font-[650] leading-tight tabular-nums">
            {compact(recurring.totalMonthlyExpenses, currency)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {recurring.activeCount} activa{recurring.activeCount !== 1 ? "s" : ""}
          </p>
        </button>
      </div>

      {/* Full-width expanded panel */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: hasActive ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-1.5 transition-opacity duration-150",
              hasActive ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {/* Presupuesto expanded */}
            {isBudgetActive && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 px-3.5 py-2")}>
                <DetailRow
                  label="Gastado"
                  value={formatCurrency(budget.totalSpent, currency)}
                />
                <DetailRow
                  label="Presupuestado"
                  value={formatCurrency(budget.totalBudgeted, currency)}
                />
                {budget.overLimitCount > 0 && (
                  <DetailRow
                    label="Sobre el límite"
                    value={`${budget.overLimitCount} categoría${budget.overLimitCount !== 1 ? "s" : ""}`}
                    valueClass="text-z-debt"
                  />
                )}
                {budget.uncategorizedCount > 0 && (
                  <DetailRow
                    label="Sin categorizar"
                    value={`${budget.uncategorizedCount}`}
                    valueClass="text-amber-400"
                  />
                )}
                <Link
                  href="/categories"
                  className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-white/6 py-1.5 text-[11px] font-medium text-z-brass transition-colors hover:bg-white/[0.03]"
                >
                  Ver presupuesto
                  <ChevronRight className="size-3" />
                </Link>
              </div>
            )}

            {/* Obligaciones expanded */}
            {isRecurringActive && (
              <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 px-3.5 py-2")}>
                <DetailRow
                  label="Ingresos fijos"
                  value={formatCurrency(recurring.totalMonthlyIncome, currency)}
                  valueClass="text-z-income"
                />
                <DetailRow
                  label="Gastos fijos"
                  value={formatCurrency(recurring.totalMonthlyExpenses, currency)}
                />
                <DetailRow
                  label="Neto"
                  value={formatCurrency(Math.abs(netRecurring), currency)}
                  valueClass={netRecurring >= 0 ? "text-z-income" : "text-z-debt"}
                />
                {recurring.dueSoonCount > 0 && (
                  <DetailRow
                    label="Próximos a vencer"
                    value={`${recurring.dueSoonCount} · ${formatCurrency(recurring.dueSoonTotal, currency)}`}
                    valueClass="text-amber-400"
                  />
                )}
                <Link
                  href="/plan/periodo"
                  className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-white/6 py-1.5 text-[11px] font-medium text-z-brass transition-colors hover:bg-white/[0.03]"
                >
                  Planear periodo
                  <ChevronRight className="size-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
