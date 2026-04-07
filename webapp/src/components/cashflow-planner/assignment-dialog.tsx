"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createAssignment } from "@/actions/cashflow-planner";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import type { CurrencyCode } from "@/types/domain";
import type { IncomeEnvelope, PlanningEntryWithRelations } from "@/types/cashflow-planner";

interface AssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: PlanningEntryWithRelations | null;
  incomeEnvelopes: IncomeEnvelope[];
  currency: CurrencyCode;
  existingAssignedToExpense?: number;
}

export function AssignmentDialog({
  open,
  onOpenChange,
  expense,
  incomeEnvelopes,
  currency,
  existingAssignedToExpense = 0,
}: AssignmentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedIncome, setSelectedIncome] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  // Use converted_amount since assignments are in period currency
  const expenseRemaining = expense ? expense.converted_amount - existingAssignedToExpense : 0;

  if (!expense) return null;

  // Filter envelopes with remaining capacity, sorted by remaining desc
  const availableEnvelopes = incomeEnvelopes
    .filter((env) => env.remaining_amount > 0)
    .sort((a, b) => b.remaining_amount - a.remaining_amount);

  function handleSelectIncome(incomeId: string, maxAmount: number) {
    setSelectedIncome(incomeId);
    setAmount(String(Math.min(maxAmount, expenseRemaining)));
  }

  function handleAssign() {
    if (!selectedIncome || !amount || !expense) return;

    startTransition(async () => {
      const result = await createAssignment(
        selectedIncome,
        expense.id,
        Number(amount)
      );
      if (result.success) {
        toast.success("Asignación creada");
        onOpenChange(false);
        setSelectedIncome(null);
        setAmount("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar gasto a un ingreso</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-white/6 bg-card/50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{expense.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(expense.expected_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(Number(expense.amount), expense.currency_code)}
                </p>
                {expense.currency_code !== currency && (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    ≈ {formatCurrency(expense.converted_amount, currency)}
                  </p>
                )}
                {existingAssignedToExpense > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Falta: {formatCurrency(expenseRemaining, currency)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Selecciona un ingreso</Label>
            {availableEnvelopes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay ingresos con saldo disponible
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableEnvelopes.map((env) => (
                  <button
                    key={env.entry.id}
                    type="button"
                    onClick={() =>
                      handleSelectIncome(env.entry.id, env.remaining_amount)
                    }
                    className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      selectedIncome === env.entry.id
                        ? "border-z-income/50 bg-z-income/5"
                        : "border-white/6 hover:border-white/12"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{env.entry.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(env.entry.expected_date)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-z-income">
                      {formatCurrency(env.remaining_amount, currency)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedIncome && (
            <div className="space-y-2">
              <Label htmlFor="assign-amount">Monto a asignar</Label>
              <CurrencyInput
                id="assign-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-card border-white/6"
                disabled={isPending}
              />
            </div>
          )}

          <Button
            onClick={handleAssign}
            className="w-full"
            disabled={!selectedIncome || !amount || isPending}
          >
            {isPending ? "Asignando..." : "Asignar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
