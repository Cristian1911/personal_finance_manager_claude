"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { PlanFlowChart } from "./plan-flow-chart";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type { PeriodPlanData, IncomeEnvelope, PlanningEntryWithRelations } from "@/types/cashflow-planner";
import type { CurrencyCode } from "@/types/domain";

interface MobilePeriodoViewProps {
  planData: PeriodPlanData;
  timelineData: PlanTimelineData;
  currency: CurrencyCode;
  isExpired: boolean;
}

export function MobilePeriodoView({
  planData,
  timelineData,
  currency,
  isExpired,
}: MobilePeriodoViewProps) {
  const {
    period,
    income_envelopes,
    expense_entries,
    total_expenses,
    total_assigned,
  } = planData;

  const percentAssigned =
    total_expenses > 0 ? Math.round((total_assigned / total_expenses) * 100) : 0;

  return (
    <div className={cn("space-y-4", isExpired && "opacity-60")}>
      {/* Chart hero — always visible */}
      <PlanFlowChart timelineData={timelineData} currency={currency} />

      {/* Period summary bar */}
      <div
        className={cn(
          PANEL_INSET_CLASS,
          "flex items-center justify-between px-4 py-2.5"
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
              : "bg-z-brass/10 text-z-brass"
          )}
        >
          {percentAssigned}% asignado
        </span>
      </div>

      {/* Income envelopes */}
      {income_envelopes.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark mb-2">
            Ingresos
          </p>
          <div className="space-y-2">
            {income_envelopes.map((envelope) => (
              <IncomeCard
                key={envelope.entry.id}
                envelope={envelope}
                currency={currency}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expenses */}
      {expense_entries.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark mb-2">
            Gastos
          </p>
          <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/5")}>
            {expense_entries.map((entry) => (
              <ExpenseRow key={entry.id} entry={entry} currency={currency} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────── Income card ────── */

function IncomeCard({
  envelope,
  currency,
}: {
  envelope: IncomeEnvelope;
  currency: CurrencyCode;
}) {
  const { entry, total_amount, assigned_amount, remaining_amount } = envelope;
  const pct =
    total_amount > 0 ? Math.min(100, (assigned_amount / total_amount) * 100) : 0;

  return (
    <div className={cn(PANEL_INSET_CLASS, "p-3.5 space-y-2")}>
      {/* Name + amount */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{entry.label}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDate(entry.expected_date, "dd MMM yyyy")}
            {entry.account && ` · ${entry.account.name}`}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-z-income shrink-0">
          {formatCurrency(total_amount, currency)}
        </p>
      </div>

      {/* Assignment progress bar */}
      <div className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden">
        <div
          className="h-full rounded-full bg-z-income transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Disponible line — never truncated */}
      <p className="text-xs text-muted-foreground">
        Disponible:{" "}
        <span
          className={cn(
            "font-semibold",
            remaining_amount > 0 ? "text-z-brass" : "text-z-income"
          )}
        >
          {formatCurrency(remaining_amount, currency)}
        </span>
      </p>
    </div>
  );
}

/* ────── Expense row ────── */

function ExpenseRow({
  entry,
  currency,
}: {
  entry: PlanningEntryWithRelations;
  currency: CurrencyCode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{entry.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {formatDate(entry.expected_date, "dd MMM yyyy")}
          {entry.account && ` · ${entry.account.name}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="text-sm font-semibold tabular-nums text-z-debt">
          {formatCurrency(entry.converted_amount, currency)}
        </p>
        <span className="rounded-md bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          Pendiente
        </span>
      </div>
    </div>
  );
}
