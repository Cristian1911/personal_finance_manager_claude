"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { PlanFlowChart } from "./plan-flow-chart";
import { DragEnvelopeBoard } from "@/components/cashflow-planner/drag-envelope-board";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type { PeriodPlanData } from "@/types/cashflow-planner";
import type { Account, Category } from "@/types/domain";

/** Accounts need account_type + current_balance for the pay dialog */
export type PlanAccount = Pick<
  Account,
  | "id"
  | "name"
  | "icon"
  | "color"
  | "account_type"
  | "current_balance"
  | "currency_code"
  | "mask"
  | "bank_key"
>;

interface MobilePeriodoViewProps {
  planData: PeriodPlanData;
  timelineData: PlanTimelineData;
  accounts: PlanAccount[];
  categories: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
}

export function MobilePeriodoView({
  planData,
  timelineData,
  accounts,
  categories,
}: MobilePeriodoViewProps) {
  const { period, currency, total_expenses, total_assigned } = planData;

  const percentAssigned =
    total_expenses > 0 ? Math.round((total_assigned / total_expenses) * 100) : 0;

  const heroIncome = timelineData.totalIncome;
  const heroExpense = timelineData.totalExpense;
  const net = heroIncome - heroExpense;

  const periodLabel =
    timelineData.dayOfMonth <= 10
      ? "Comienzo de mes"
      : timelineData.dayOfMonth <= 20
        ? "Mitad de mes"
        : "Fin de mes";

  return (
    <div className="space-y-4">
      {/* NETO hero */}
      <div className="rounded-2xl border border-white/6 bg-z-surface-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            Neto del mes
          </p>
          <span className="text-[10px] text-muted-foreground">{periodLabel}</span>
        </div>
        <p
          className={cn(
            "mt-1 text-3xl font-bold tabular-nums",
            net > 0
              ? "text-z-income"
              : net < 0
                ? "text-z-expense"
                : "text-z-brass",
          )}
        >
          {net >= 0 ? "+" : ""}
          {formatCurrency(net, currency)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          +{formatCurrency(heroIncome, currency)} · −
          {formatCurrency(heroExpense, currency)}
        </p>
      </div>

      {/* Chart hero */}
      <PlanFlowChart timelineData={timelineData} currency={currency} />

      {/* Period summary bar */}
      <div
        className={cn(
          PANEL_INSET_CLASS,
          "flex items-center justify-between px-4 py-2.5",
        )}
      >
        <p className="text-xs text-muted-foreground">
          {formatDate(period.start_date, "dd MMM")} —{" "}
          {formatDate(period.end_date, "dd MMM yyyy")}
        </p>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold",
            percentAssigned >= 100
              ? "bg-z-income/10 text-z-income"
              : "bg-z-brass/10 text-z-brass",
          )}
        >
          {percentAssigned}% asignado
        </span>
      </div>

      {/* Unified drag board — owns the Edit/Pay dialogs */}
      <DragEnvelopeBoard
        dndId="planner-mobile"
        data={planData}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
