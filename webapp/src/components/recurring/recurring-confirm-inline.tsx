"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { OccurrenceItem } from "./use-recurring-month";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RecurringConfirmInlineProps {
  item: OccurrenceItem;
  onConfirm: (amount: number, date: string, sourceAccountId?: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RecurringConfirmInline({
  item,
  onConfirm,
  onCancel,
  isPending,
}: RecurringConfirmInlineProps) {
  const [amount, setAmount] = useState<string>(String(item.plannedAmount));
  const [paymentDate, setPaymentDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    onConfirm(numericAmount, paymentDate);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-b-lg border-t bg-muted/50 px-3 py-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        {/* Amount */}
        <div className="flex-1 space-y-1">
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
        <div className="flex-1 space-y-1">
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

        {/* Actions */}
        <div className="flex gap-2 sm:shrink-0">
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="flex-1 sm:flex-initial"
          >
            {isPending ? "Registrando..." : "Confirmar pago"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 sm:flex-initial"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  );
}
