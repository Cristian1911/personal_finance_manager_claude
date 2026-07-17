"use client";

import { useMemo, useState } from "react";
import { IncomeEnvelopeCard } from "./income-envelope-card";
import { ExpenseEntryRow } from "./expense-entry-row";
import { AssignmentDialog } from "./assignment-dialog";
import { ConfirmIncomeDialog } from "./confirm-income-dialog";
import { PayExpenseDialog } from "./pay-expense-dialog";
import { BalanceSeedButton } from "./balance-seed-button";
import { EntryFormDialog } from "./entry-form-dialog";
import { EditEntryDialog } from "./edit-entry-dialog";
import { AutoAssignButton } from "./auto-assign-button";
import { SyncRecurringButton } from "./sync-recurring-button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { buildEnvelopeMaps } from "@/lib/utils/cashflow-planner";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toColombiaDateString } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { Wallet, Receipt, AlertTriangle, Info, ChevronDown } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { CategoryWithChildren } from "@/types/domain";
import type { PlanAccount } from "@/components/mobile/v2/plan/mobile-periodo-view";
import {
  BALANCE_SEED_NOTES,
  type PeriodPlanData,
  type PlanningEntryWithRelations,
} from "@/types/cashflow-planner";

interface EnvelopeBoardProps {
  data: PeriodPlanData;
  accounts?: PlanAccount[];
  categories?: CategoryWithChildren[];
}

export function EnvelopeBoard({ data, accounts = [], categories = [] }: EnvelopeBoardProps) {
  const [assignTarget, setAssignTarget] = useState<PlanningEntryWithRelations | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlanningEntryWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<PlanningEntryWithRelations | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<PlanningEntryWithRelations | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [openSettled, setOpenSettled] = useState<"income" | "expense" | null>(null);

  const { income_envelopes, expense_entries, unassigned_expenses, currency, period, commitments } = data;

  const { assignedPerExpense, incomeColorMap, expenseAssignmentChips } = useMemo(
    () => buildEnvelopeMaps(income_envelopes),
    [income_envelopes],
  );

  const hasBalanceEnvelopes = useMemo(
    () => income_envelopes.some((env) => env.entry.notes === BALANCE_SEED_NOTES),
    [income_envelopes],
  );

  // Settled (above HOY) vs actionable (below HOY).
  // Opening-balance "Saldo" envelopes stay VISIBLE even when confirmed — they're
  // the current spendable balance you assign expenses against. Only confirmed
  // paychecks collapse into the settled chip.
  const openingBalances = income_envelopes.filter((e) => e.is_opening_balance);
  const confirmedIncome = income_envelopes.filter(
    (e) => e.state === "confirmado" && !e.is_opening_balance
  );
  const actionableIncome = income_envelopes.filter(
    (e) => e.state !== "confirmado" && !e.is_opening_balance
  );
  const visibleIncome = [...openingBalances, ...actionableIncome];
  const paidExpenses = expense_entries.filter((e) => e.status === "COMPLETED");
  const pendingExpenses = expense_entries.filter((e) => e.status !== "COMPLETED");

  const confirmedTotal = confirmedIncome.reduce((s, e) => s + e.total_amount, 0);
  const paidTotal = paidExpenses.reduce((s, e) => s + e.converted_amount, 0);
  const actionableIncomeTotal = actionableIncome.reduce((s, e) => s + e.total_amount, 0);
  const pendingExpenseTotal = pendingExpenses.reduce((s, e) => s + e.converted_amount, 0);
  const atrasadoCount = actionableIncome.filter((e) => e.state === "atrasado").length;

  const todayISO = toColombiaDateString(new Date());
  const daysLeft = Math.max(0, differenceInCalendarDays(parseISO(period.end_date), parseISO(todayISO)));

  function openAssignDialog(expense: PlanningEntryWithRelations) {
    setAssignTarget(expense);
    setAssignDialogOpen(true);
  }
  function openEditDialog(entry: PlanningEntryWithRelations) {
    setEditTarget(entry);
    setEditDialogOpen(true);
  }
  function openConfirmDialog(entry: PlanningEntryWithRelations) {
    setConfirmTarget(entry);
    setConfirmDialogOpen(true);
  }
  function openPayDialog(entry: PlanningEntryWithRelations) {
    setPayTarget(entry);
    setPayDialogOpen(true);
  }

  const colorIndexOf = (id: string) => incomeColorMap.get(id) ?? 0;

  return (
    <>
      {/* ── Settled (past): compact green/red chips; expand full-width below ── */}
      {(confirmedIncome.length > 0 || paidExpenses.length > 0) && (
        <div className="mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {confirmedIncome.length > 0 ? (
              <button
                type="button"
                aria-expanded={openSettled === "income"}
                aria-controls="settled-income-list"
                onClick={() => setOpenSettled((o) => (o === "income" ? null : "income"))}
                className={cn(
                  "flex min-w-0 items-center gap-2.5 rounded-xl border border-dashed px-3 py-2.5 text-left transition-colors",
                  openSettled === "income"
                    ? "border-z-income/30 bg-z-income/5"
                    : "border-white/6 hover:bg-white/3"
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-z-income/12 text-z-income">
                  <Wallet className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-z-white">
                    {confirmedIncome.length} confirmados
                  </span>
                  <span className="block truncate text-[11px] font-semibold tabular-nums text-z-income">
                    {formatCurrency(confirmedTotal, currency)}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    openSettled === "income" && "rotate-180"
                  )}
                />
              </button>
            ) : (
              <div className="min-w-0" />
            )}
            {paidExpenses.length > 0 ? (
              <button
                type="button"
                aria-expanded={openSettled === "expense"}
                aria-controls="settled-expense-list"
                onClick={() => setOpenSettled((o) => (o === "expense" ? null : "expense"))}
                className={cn(
                  "flex min-w-0 items-center gap-2.5 rounded-xl border border-dashed px-3 py-2.5 text-left transition-colors",
                  openSettled === "expense"
                    ? "border-z-expense/30 bg-z-expense/5"
                    : "border-white/6 hover:bg-white/3"
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-z-expense/12 text-z-expense">
                  <Receipt className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-z-white">
                    {paidExpenses.length} pagados
                  </span>
                  <span className="block truncate text-[11px] font-semibold tabular-nums text-z-expense">
                    {formatCurrency(paidTotal, currency)}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    openSettled === "expense" && "rotate-180"
                  )}
                />
              </button>
            ) : (
              <div className="min-w-0" />
            )}
          </div>

          {openSettled === "income" && (
            <div id="settled-income-list" className="space-y-2.5">
              {confirmedIncome.map((env) => (
                <IncomeEnvelopeCard
                  key={env.entry.id}
                  envelope={env}
                  currency={currency}
                  colorIndex={colorIndexOf(env.entry.id)}
                  onEdit={openEditDialog}
                />
              ))}
            </div>
          )}
          {openSettled === "expense" && (
            <div id="settled-expense-list" className="space-y-2">
              {paidExpenses.map((entry) => (
                <ExpenseEntryRow
                  key={entry.id}
                  entry={entry}
                  currency={currency}
                  assignedAmount={assignedPerExpense.get(entry.id) ?? 0}
                  assignmentChips={expenseAssignmentChips.get(entry.id) ?? []}
                  onEdit={openEditDialog}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HOY divider ── */}
      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-white/6" />
        <div className="flex items-center gap-2 rounded-full border border-z-brass/30 bg-z-brass/7 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-z-brass" />
          <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-z-brass">
            Hoy · {formatDate(todayISO, "d MMM")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            quedan {daysLeft} {daysLeft === 1 ? "día" : "días"}
          </span>
        </div>
        <div className="h-px flex-1 bg-white/6" />
      </div>

      {/* ── Actionable (present/future): esperado/atrasado income | pending expenses ── */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Income */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-z-income" />
              <SectionEyebrow>Ingresos</SectionEyebrow>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BalanceSeedButton periodId={period.id} hasExistingBalances={hasBalanceEnvelopes} />
              <EntryFormDialog
                periodId={period.id}
                currency={currency}
                defaultType="INCOME"
                accounts={accounts}
                categories={categories}
              />
            </div>
          </div>
          {actionableIncomeTotal > 0 && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {formatCurrency(actionableIncomeTotal, currency)} por confirmar
            </p>
          )}
          {atrasadoCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-z-expense/20 bg-z-expense/6 px-3 py-2 text-xs text-z-expense">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {atrasadoCount} {atrasadoCount === 1 ? "ingreso atrasado" : "ingresos atrasados"} sin confirmar
              </span>
            </div>
          )}
          {visibleIncome.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/6 p-4 text-center text-xs text-muted-foreground">
              Usa “Actualizar saldos” para ver tu saldo disponible
            </p>
          ) : (
            visibleIncome.map((env) => (
              <IncomeEnvelopeCard
                key={env.entry.id}
                envelope={env}
                currency={currency}
                colorIndex={colorIndexOf(env.entry.id)}
                onEdit={openEditDialog}
                onConfirm={openConfirmDialog}
              />
            ))
          )}
        </div>

        {/* Expenses */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-z-expense" />
              <SectionEyebrow>Gastos</SectionEyebrow>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {unassigned_expenses.length > 0 && income_envelopes.length > 0 && (
                <AutoAssignButton periodId={period.id} />
              )}
              <SyncRecurringButton periodId={period.id} />
              <EntryFormDialog
                periodId={period.id}
                currency={currency}
                defaultType="EXPENSE"
                accounts={accounts}
                categories={categories}
              />
            </div>
          </div>
          {pendingExpenseTotal > 0 && (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {formatCurrency(pendingExpenseTotal, currency)} por pagar
            </p>
          )}
          {unassigned_expenses.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-z-brass/20 bg-z-brass/6 px-3 py-2 text-xs text-z-brass">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                {unassigned_expenses.length}{" "}
                {unassigned_expenses.length === 1 ? "gasto sin asignar" : "gastos sin asignar"} a un ingreso
              </span>
            </div>
          )}
          {pendingExpenses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/6 p-4 text-center text-xs text-muted-foreground">
              Nada pendiente por pagar
            </p>
          ) : (
            <div className="space-y-2">
              {pendingExpenses.map((entry) => (
                <ExpenseEntryRow
                  key={entry.id}
                  entry={entry}
                  currency={currency}
                  assignedAmount={assignedPerExpense.get(entry.id) ?? 0}
                  assignmentChips={expenseAssignmentChips.get(entry.id) ?? []}
                  commitment={commitments[entry.id]}
                  onAssign={() => openAssignDialog(entry)}
                  onEdit={openEditDialog}
                  onPay={() => openPayDialog(entry)}
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
        // Only assignable income: current Saldo + still-expected/atrasado income.
        // Confirmed paychecks already folded into the Saldo, so excluded.
        incomeEnvelopes={visibleIncome}
        currency={currency}
        existingAssignedToExpense={assignTarget ? (assignedPerExpense.get(assignTarget.id) ?? 0) : 0}
        incomeColorMap={incomeColorMap}
      />

      <EditEntryDialog
        // Remount per entry so uncontrolled defaults (label/amount) and local
        // state can never leak from a previously edited entry.
        key={editTarget?.id ?? "edit-entry"}
        entry={editTarget}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        currency={currency}
        accounts={accounts}
        categories={categories}
      />

      <ConfirmIncomeDialog
        entry={confirmTarget}
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        currency={currency}
        accounts={accounts}
        periodMonth={period.start_date.slice(0, 7)}
      />

      <PayExpenseDialog
        entry={payTarget}
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        currency={currency}
        accounts={accounts}
        periodMonth={period.start_date.slice(0, 7)}
      />
    </>
  );
}
