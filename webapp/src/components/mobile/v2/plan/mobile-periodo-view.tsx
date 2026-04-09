"use client";

import { useState, useMemo, useTransition } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import { PlanFlowChart } from "./plan-flow-chart";
import { EntryFormDialog } from "@/components/cashflow-planner/entry-form-dialog";
import { EditEntryDialog } from "@/components/cashflow-planner/edit-entry-dialog";
import { AssignmentDialog } from "@/components/cashflow-planner/assignment-dialog";
import { AutoAssignButton } from "@/components/cashflow-planner/auto-assign-button";
import {
  toggleEntryStatus,
  deletePlanningEntry,
  deleteAssignment,
} from "@/actions/cashflow-planner";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type {
  PeriodPlanData,
  IncomeEnvelope,
  PlanningEntryWithRelations,
} from "@/types/cashflow-planner";
import type { PlanningEntryStatus, CurrencyCode, Account, Category } from "@/types/domain";

/* ────── Status badge map ────── */

const STATUS_BADGE: Record<
  PlanningEntryStatus,
  { label: string; className: string }
> = {
  PLANNED: { label: "Pendiente", className: "bg-amber-400/10 text-amber-400" },
  COMPLETED: { label: "Pagado", className: "bg-z-income/10 text-z-income" },
  SKIPPED: {
    label: "Omitido",
    className: "bg-white/5 text-muted-foreground line-through",
  },
};

/* ────── Main component ────── */

interface MobilePeriodoViewProps {
  planData: PeriodPlanData;
  timelineData: PlanTimelineData;
  currency: CurrencyCode;
  isExpired: boolean;
  accounts: Pick<Account, "id" | "name" | "icon" | "color">[];
  categories: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
}

export function MobilePeriodoView({
  planData,
  timelineData,
  currency,
  isExpired,
  accounts,
  categories,
}: MobilePeriodoViewProps) {
  const {
    period,
    income_envelopes,
    expense_entries,
    total_expenses,
    total_assigned,
  } = planData;

  /* ── State ── */
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null
  );
  const [expandedIncomeId, setExpandedIncomeId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] =
    useState<PlanningEntryWithRelations | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editTarget, setEditTarget] =
    useState<PlanningEntryWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  /* ── Computed data ── */
  const assignedPerExpense = useMemo(() => {
    const map = new Map<string, number>();
    for (const env of income_envelopes) {
      for (const { assignment } of env.assignments) {
        map.set(
          assignment.expense_entry_id,
          (map.get(assignment.expense_entry_id) ?? 0) +
            Number(assignment.assigned_amount)
        );
      }
    }
    return map;
  }, [income_envelopes]);

  const incomeColorMap = useMemo(() => {
    const map = new Map<string, number>();
    income_envelopes.forEach((env, i) => map.set(env.entry.id, i));
    return map;
  }, [income_envelopes]);

  const expenseAssignmentChips = useMemo(() => {
    const map = new Map<
      string,
      { colorIndex: number; amount: number; label: string }[]
    >();
    for (const env of income_envelopes) {
      const ci = incomeColorMap.get(env.entry.id) ?? 0;
      for (const { assignment } of env.assignments) {
        const chips = map.get(assignment.expense_entry_id) ?? [];
        chips.push({
          colorIndex: ci,
          amount: Number(assignment.assigned_amount),
          label: env.entry.label,
        });
        map.set(assignment.expense_entry_id, chips);
      }
    }
    return map;
  }, [income_envelopes, incomeColorMap]);

  const percentAssigned =
    total_expenses > 0
      ? Math.round((total_assigned / total_expenses) * 100)
      : 0;

  const hasUnassigned = planData.unassigned_expenses.length > 0;

  /* ── Handlers ── */
  function cycleExpenseStatus(entry: PlanningEntryWithRelations) {
    const next: PlanningEntryStatus =
      entry.status === "PLANNED"
        ? "COMPLETED"
        : entry.status === "COMPLETED"
          ? "SKIPPED"
          : "PLANNED";
    startTransition(async () => {
      await toggleEntryStatus(entry.id, next);
    });
  }

  function toggleIncomeStatus(entry: PlanningEntryWithRelations) {
    const next: PlanningEntryStatus =
      entry.status === "PLANNED" ? "COMPLETED" : "PLANNED";
    startTransition(async () => {
      await toggleEntryStatus(entry.id, next);
    });
  }

  function handleDeleteEntry(id: string) {
    startTransition(async () => {
      const result = await deletePlanningEntry(id);
      if (result.success) toast.success("Eliminado");
      else toast.error(result.error);
    });
  }

  function handleRemoveAssignment(assignmentId: string) {
    startTransition(async () => {
      const result = await deleteAssignment(assignmentId);
      if (result.success) toast.success("Asignación eliminada");
      else toast.error(result.error);
    });
  }

  function openAssign(entry: PlanningEntryWithRelations) {
    setAssignTarget(entry);
    setAssignDialogOpen(true);
  }

  function openEdit(entry: PlanningEntryWithRelations) {
    setEditTarget(entry);
    setEditDialogOpen(true);
  }

  return (
    <div className={cn("space-y-4", isExpired && "opacity-60")}>
      {/* Chart hero */}
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

      {/* ── Ingresos section ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Ingresos
          </p>
          <EntryFormDialog
            periodId={period.id}
            currency={currency}
            defaultType="INCOME"
            accounts={accounts}
            categories={categories}
          />
        </div>
        {income_envelopes.length > 0 && (
          <div className="space-y-2">
            {income_envelopes.map((envelope, idx) => (
              <IncomeCard
                key={envelope.entry.id}
                envelope={envelope}
                colorIndex={idx}
                currency={currency}
                isExpanded={expandedIncomeId === envelope.entry.id}
                onToggle={() =>
                  setExpandedIncomeId(
                    expandedIncomeId === envelope.entry.id
                      ? null
                      : envelope.entry.id
                  )
                }
                onEdit={openEdit}
                onDelete={handleDeleteEntry}
                onToggleStatus={toggleIncomeStatus}
                onRemoveAssignment={handleRemoveAssignment}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Gastos section ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Gastos
          </p>
          <div className="flex items-center gap-2">
            {hasUnassigned && income_envelopes.length > 0 && (
              <AutoAssignButton periodId={period.id} />
            )}
            <EntryFormDialog
              periodId={period.id}
              currency={currency}
              defaultType="EXPENSE"
              accounts={accounts}
              categories={categories}
            />
          </div>
        </div>
        {expense_entries.length > 0 && (
          <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/5")}>
            {expense_entries.map((entry) => (
              <ExpenseRow
                key={entry.id}
                entry={entry}
                currency={currency}
                assignedAmount={assignedPerExpense.get(entry.id) ?? 0}
                assignmentChips={expenseAssignmentChips.get(entry.id) ?? []}
                isExpanded={expandedExpenseId === entry.id}
                onToggle={() =>
                  setExpandedExpenseId(
                    expandedExpenseId === entry.id ? null : entry.id
                  )
                }
                onCycleStatus={() => cycleExpenseStatus(entry)}
                onAssign={() => openAssign(entry)}
                onEdit={() => openEdit(entry)}
                onDelete={() => handleDeleteEntry(entry.id)}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <AssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        expense={assignTarget}
        incomeEnvelopes={income_envelopes}
        currency={currency}
        existingAssignedToExpense={
          assignTarget
            ? (assignedPerExpense.get(assignTarget.id) ?? 0)
            : 0
        }
        incomeColorMap={incomeColorMap}
      />
      <EditEntryDialog
        entry={editTarget}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        currency={currency}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}

/* ────── Income card ────── */

function IncomeCard({
  envelope,
  colorIndex,
  currency,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onToggleStatus,
  onRemoveAssignment,
  isPending,
}: {
  envelope: IncomeEnvelope;
  colorIndex: number;
  currency: CurrencyCode;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (entry: PlanningEntryWithRelations) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (entry: PlanningEntryWithRelations) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  isPending: boolean;
}) {
  const { entry, total_amount, assigned_amount, remaining_amount, assignments } =
    envelope;
  const pct =
    total_amount > 0
      ? Math.min(100, (assigned_amount / total_amount) * 100)
      : 0;
  const color = getEnvelopeColor(colorIndex);

  return (
    <div
      className={cn(PANEL_INSET_CLASS, "overflow-hidden border-l-2")}
      style={{ borderLeftColor: color.hex }}
    >
      {/* Main card content — tap to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3.5 text-left space-y-2"
      >
        {/* Name + status + amount */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{entry.label}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatDate(entry.expected_date, "dd MMM yyyy")}
              {entry.account && ` · ${entry.account.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <p
              className="text-sm font-semibold tabular-nums"
              style={{ color: color.hex }}
            >
              {formatCurrency(total_amount, currency)}
            </p>
            {/* Status toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(entry);
              }}
              disabled={isPending}
              className={cn(
                "flex size-5 items-center justify-center rounded-md border transition-colors",
                entry.status === "COMPLETED"
                  ? "border-z-income/40 bg-z-income/15 text-z-income"
                  : "border-white/10 bg-white/5 text-muted-foreground"
              )}
            >
              {entry.status === "COMPLETED" && <Check className="size-3" />}
            </button>
          </div>
        </div>

        {/* Assignment progress bar */}
        <div className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color.hex }}
          />
        </div>

        {/* Disponible */}
        <div className="flex items-center justify-between">
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
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expanded: assignments list + actions */}
      {isExpanded && (
        <div className="border-t border-white/5">
          {/* Assignments */}
          {assignments.length > 0 && (
            <div className="divide-y divide-white/5">
              {assignments.map(({ assignment, expense_entry }) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-2 px-3.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium truncate text-muted-foreground">
                      {expense_entry.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold tabular-nums text-z-debt">
                      {formatCurrency(
                        Number(assignment.assigned_amount),
                        currency
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveAssignment(assignment.id)}
                      disabled={isPending}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:text-red-400"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-2 px-3.5 py-2 border-t border-white/5 bg-black/20">
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="size-3" />
              Editar
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              disabled={isPending}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-red-400 transition-colors hover:text-red-300"
            >
              <Trash2 className="size-3" />
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────── Expense row ────── */

function ExpenseRow({
  entry,
  currency,
  assignedAmount,
  assignmentChips,
  isExpanded,
  onToggle,
  onCycleStatus,
  onAssign,
  onEdit,
  onDelete,
  isPending,
}: {
  entry: PlanningEntryWithRelations;
  currency: CurrencyCode;
  assignedAmount: number;
  assignmentChips: { colorIndex: number; amount: number; label: string }[];
  isExpanded: boolean;
  onToggle: () => void;
  onCycleStatus: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  return (
    <div className={cn(entry.status === "SKIPPED" && "opacity-50")}>
      {/* Main row — tap to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{entry.label}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDate(entry.expected_date, "dd MMM yyyy")}
            {entry.account && ` · ${entry.account.name}`}
          </p>
          {/* Colored assignment chips */}
          {assignmentChips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {assignmentChips.map((chip, i) => {
                const c = getEnvelopeColor(chip.colorIndex);
                return (
                  <span
                    key={i}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium",
                      c.bg,
                      c.text
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: c.hex }}
                    />
                    {formatCurrency(chip.amount, currency)}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-sm font-semibold tabular-nums text-z-debt">
            {formatCurrency(entry.converted_amount, currency)}
          </p>
          {/* Status badge — tappable */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCycleStatus();
            }}
            disabled={isPending}
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-medium",
              STATUS_BADGE[entry.status].className
            )}
          >
            {STATUS_BADGE[entry.status].label}
          </button>
        </div>
      </button>

      {/* Expanded action bar */}
      {isExpanded && (
        <div className="flex items-center gap-2 px-3.5 py-2 border-t border-white/5 bg-black/20">
          <button
            type="button"
            onClick={onAssign}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRightLeft className="size-3" />
            Asignar
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="size-3" />
            Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-red-400 transition-colors hover:text-red-300"
          >
            <Trash2 className="size-3" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
