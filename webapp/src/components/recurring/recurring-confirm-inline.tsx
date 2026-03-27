"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
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
              Monto
            </label>
            <CurrencyInput
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-sm"
              placeholder="Monto real"
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Fecha de pago
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
            {isPending ? "Registrando..." : "Confirmar pago"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSkip}
            disabled={isPending}
          >
            Ya pagué
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
