"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Trash2 } from "lucide-react";
import { deleteAssignment, toggleEntryStatus } from "@/actions/cashflow-planner";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import type { CurrencyCode, PlanningEntryStatus } from "@/types/domain";
import type { IncomeEnvelope } from "@/types/cashflow-planner";

interface IncomeEnvelopeCardProps {
  envelope: IncomeEnvelope;
  currency: CurrencyCode;
}

export function IncomeEnvelopeCard({ envelope, currency }: IncomeEnvelopeCardProps) {
  const [isPending, startTransition] = useTransition();
  const { entry, total_amount, assigned_amount, remaining_amount, assignments } = envelope;
  const percentUsed = total_amount > 0
    ? Math.round((assigned_amount / total_amount) * 100)
    : 0;

  function handleRemoveAssignment(assignmentId: string) {
    startTransition(async () => {
      await deleteAssignment(assignmentId);
    });
  }

  function handleToggleStatus() {
    const nextStatus: PlanningEntryStatus =
      entry.status === "PLANNED" ? "COMPLETED" : "PLANNED";
    startTransition(async () => {
      await toggleEntryStatus(entry.id, nextStatus);
    });
  }

  return (
    <div className="rounded-xl border border-white/6 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={isPending}
            className="shrink-0 rounded-md border border-white/10 p-1 transition-colors hover:border-z-income/30"
          >
            <Check
              className={`h-3.5 w-3.5 ${
                entry.status === "COMPLETED" ? "text-z-income" : "text-muted-foreground"
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-semibold">{entry.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(entry.expected_date)}
              {entry.account && ` · ${entry.account.name}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-z-income">
            {formatCurrency(total_amount, currency)}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Asignado: {formatCurrency(assigned_amount, currency)}</span>
          <span>Disponible: {formatCurrency(remaining_amount, currency)}</span>
        </div>
        <Progress value={percentUsed} className="h-1.5" />
      </div>

      {assignments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Gastos asignados
          </p>
          {assignments.map(({ assignment, expense_entry }) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/4 bg-background/50 px-3 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                {expense_entry.category && (
                  <span className="text-xs">{expense_entry.category.icon}</span>
                )}
                <span className="text-sm truncate">
                  {expense_entry.label}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {formatDate(expense_entry.expected_date)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(Number(assignment.assigned_amount), currency)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-red-400"
                  onClick={() => handleRemoveAssignment(assignment.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
