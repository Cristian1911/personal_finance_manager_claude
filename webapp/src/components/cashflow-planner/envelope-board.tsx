"use client";

import { useMemo, useState } from "react";
import { IncomeEnvelopeCard } from "./income-envelope-card";
import { ExpenseEntryRow } from "./expense-entry-row";
import { AssignmentDialog } from "./assignment-dialog";
import { BalanceSeedButton } from "./balance-seed-button";
import { EntryFormDialog } from "./entry-form-dialog";
import { EditEntryDialog } from "./edit-entry-dialog";
import { AutoAssignButton } from "./auto-assign-button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { buildEnvelopeMaps } from "@/lib/utils/cashflow-planner";
import { Wallet, Receipt } from "lucide-react";
import type { Account, Category } from "@/types/domain";
import {
  BALANCE_SEED_NOTES,
  type PeriodPlanData,
  type PlanningEntryWithRelations,
} from "@/types/cashflow-planner";

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

  const { assignedPerExpense, incomeColorMap, expenseAssignmentChips } = useMemo(
    () => buildEnvelopeMaps(income_envelopes),
    [income_envelopes],
  );

  const hasBalanceEnvelopes = useMemo(
    () => income_envelopes.some((env) => env.entry.notes === BALANCE_SEED_NOTES),
    [income_envelopes],
  );

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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-z-income" />
              <SectionEyebrow>Ingresos</SectionEyebrow>
            </div>
            <div className="flex items-center gap-2">
              <BalanceSeedButton
                periodId={period.id}
                hasExistingBalances={hasBalanceEnvelopes}
              />
              <EntryFormDialog
                periodId={period.id}
                currency={currency}
                defaultType="INCOME"
                accounts={accounts}
                categories={categories}
              />
            </div>
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
