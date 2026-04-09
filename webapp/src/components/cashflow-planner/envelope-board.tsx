"use client";

import { useState } from "react";
import { IncomeEnvelopeCard } from "./income-envelope-card";
import { ExpenseEntryRow } from "./expense-entry-row";
import { AssignmentDialog } from "./assignment-dialog";
import { EntryFormDialog } from "./entry-form-dialog";
import { EditEntryDialog } from "./edit-entry-dialog";
import { AutoAssignButton } from "./auto-assign-button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { Wallet, Receipt } from "lucide-react";
import type { Account, Category } from "@/types/domain";
import type { PeriodPlanData, PlanningEntryWithRelations } from "@/types/cashflow-planner";

interface EnvelopeBoardProps {
  data: PeriodPlanData;
  accounts?: Pick<Account, "id" | "name" | "icon" | "color">[];
  categories?: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
}

export function EnvelopeBoard({ data, accounts = [], categories = [] }: EnvelopeBoardProps) {
  const [assignTarget, setAssignTarget] = useState<PlanningEntryWithRelations | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlanningEntryWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { income_envelopes, expense_entries, unassigned_expenses, currency, period } = data;

  const assignedPerExpense = new Map<string, number>();
  for (const env of income_envelopes) {
    for (const { assignment } of env.assignments) {
      const prev = assignedPerExpense.get(assignment.expense_entry_id) ?? 0;
      assignedPerExpense.set(
        assignment.expense_entry_id,
        prev + Number(assignment.assigned_amount)
      );
    }
  }

  const incomeColorMap = new Map<string, number>();
  income_envelopes.forEach((env, index) => incomeColorMap.set(env.entry.id, index));

  type AssignmentChip = { colorIndex: number; amount: number; label: string };
  const expenseAssignmentChips = new Map<string, AssignmentChip[]>();
  for (const env of income_envelopes) {
    const colorIdx = incomeColorMap.get(env.entry.id) ?? 0;
    for (const { assignment } of env.assignments) {
      const chips = expenseAssignmentChips.get(assignment.expense_entry_id) ?? [];
      chips.push({ colorIndex: colorIdx, amount: Number(assignment.assigned_amount), label: env.entry.label });
      expenseAssignmentChips.set(assignment.expense_entry_id, chips);
    }
  }

  function openAssignDialog(expense: PlanningEntryWithRelations) {
    setAssignTarget(expense);
    setAssignDialogOpen(true);
  }

  function openEditDialog(entry: PlanningEntryWithRelations) {
    setEditTarget(entry);
    setEditDialogOpen(true);
  }

  return (
    <>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Income envelopes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-z-income" />
              <SectionEyebrow>Ingresos</SectionEyebrow>
            </div>
            <EntryFormDialog
              periodId={period.id}
              currency={currency}
              defaultType="INCOME"
              accounts={accounts}
              categories={categories}
            />
          </div>

          {income_envelopes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No hay ingresos en este periodo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Agrega un ingreso para empezar a asignar gastos
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {income_envelopes.map((env, index) => (
                <IncomeEnvelopeCard
                  key={env.entry.id}
                  envelope={env}
                  currency={currency}
                  colorIndex={index}
                  onEdit={openEditDialog}
                />
              ))}
            </div>
          )}
        </div>

        {/* Expense pool */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-z-expense" />
              <SectionEyebrow>Gastos</SectionEyebrow>
            </div>
            <div className="flex items-center gap-2">
              {unassigned_expenses.length > 0 && income_envelopes.length > 0 && (
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

          {expense_entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No hay gastos en este periodo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Agrega un gasto o pobla desde tus recurrentes
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {expense_entries.map((entry) => (
                <ExpenseEntryRow
                  key={entry.id}
                  entry={entry}
                  currency={currency}
                  assignedAmount={assignedPerExpense.get(entry.id) ?? 0}
                  assignmentChips={expenseAssignmentChips.get(entry.id) ?? []}
                  onAssign={() => openAssignDialog(entry)}
                  onEdit={openEditDialog}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        expense={assignTarget}
        incomeEnvelopes={income_envelopes}
        currency={currency}
        existingAssignedToExpense={
          assignTarget ? (assignedPerExpense.get(assignTarget.id) ?? 0) : 0
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
    </>
  );
}
