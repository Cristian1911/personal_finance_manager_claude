"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OccurrenceItem } from "./use-recurring-month";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SourceAccount {
  id: string;
  name: string;
}

interface RecurringConfirmInlineProps {
  item: OccurrenceItem;
  onConfirm: (amount: number, date: string, sourceAccountId?: string) => void;
  onSkip: () => void;
  onCancel: () => void;
  isPending: boolean;
  sourceAccounts?: SourceAccount[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RecurringConfirmInline({
  item,
  onConfirm,
  onSkip,
  onCancel,
  isPending,
  sourceAccounts,
}: RecurringConfirmInlineProps) {
  const isIncome = item.direction === "INFLOW" && !item.isDebtPayment;
  const [amount, setAmount] = useState<string>(String(item.plannedAmount));
  const [paymentDate, setPaymentDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [sourceAccountId, setSourceAccountId] = useState<string>(
    item.transferSourceAccountId ?? ""
  );

  const needsSource = item.isDebtPayment;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    onConfirm(
      numericAmount,
      paymentDate,
      needsSource ? sourceAccountId || undefined : undefined
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-b-lg border-t bg-muted/50 px-3 py-3"
    >
      <div className="space-y-2">
        {/* Fields row */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_auto]">
          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {isIncome ? "Monto recibido" : "Monto pagado"}
            </label>
            <CurrencyInput
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-sm"
              placeholder={isIncome ? "Monto recibido" : "Monto pagado"}
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {isIncome ? "Fecha de ingreso" : "Fecha de pago"}
            </label>
            <DatePicker
              value={paymentDate}
              onChange={(v) => setPaymentDate(v ?? format(new Date(), "yyyy-MM-dd"))}
              placeholder={isIncome ? "Fecha de ingreso" : "Fecha de pago"}
              className="h-8 w-full"
            />
          </div>

          {/* Source account (debt payments only) */}
          {needsSource && sourceAccounts && sourceAccounts.length > 0 && (
            <div className="col-span-2 space-y-1 lg:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">
                Cuenta origen
              </label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Registrando..." : isIncome ? "Confirmar ingreso" : "Confirmar pago"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSkip}
            disabled={isPending}
          >
            {isIncome ? "Ya recibí" : "Ya pagué"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}
