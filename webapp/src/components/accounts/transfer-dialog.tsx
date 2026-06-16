"use client";

import { useActionState, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { createTransfer } from "@/actions/transfers";
import type { Account } from "@/types/domain";

interface TransferDialogProps {
  account: Account;
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferDialog({
  account,
  accounts,
  open,
  onOpenChange,
}: TransferDialogProps) {
  // Any other same-currency account is a valid destination — transferring to a
  // CREDIT_CARD or LOAN registers a payment (inflow reduces the owed balance).
  // createTransfer rejects cross-currency, so filter those out up front.
  const destinationAccounts = accounts.filter(
    (a) => a.id !== account.id && a.currency_code === account.currency_code
  );

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);

  const [state, formAction, isPending] = useActionState(createTransfer, {
    success: false as const,
    error: "",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir desde {account.name}</DialogTitle>
          <DialogDescription>
            Mueve fondos hacia otra cuenta
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {/* Hidden fields */}
          <input type="hidden" name="fromAccountId" value={account.id ?? ""} />
          <input type="hidden" name="currencyCode" value={account.currency_code ?? "COP"} />

          {/* Destination */}
          <div className="space-y-2">
            <Label htmlFor="transfer-destination">Cuenta destino</Label>
            <Select name="toAccountId" required>
              <SelectTrigger id="transfer-destination" className="w-full">
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {destinationAccounts.map((a) => (
                  <SelectItem key={a.id ?? ""} value={a.id ?? ""}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="transfer-amount">Monto</Label>
            <CurrencyInput
              id="transfer-amount"
              name="amount"
              required
              autoFocus
              placeholder="0"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Fecha</Label>
            <DatePicker
              name="date"
              value={date}
              onChange={(v) => setDate(v ?? today)}
              className="w-full"
              placeholder="Seleccionar fecha"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="transfer-notes">Notas (opcional)</Label>
            <Input
              id="transfer-notes"
              name="notes"
              type="text"
              placeholder="Ej: Ahorro mensual"
            />
          </div>

          {/* Error */}
          {!state.success && state.error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{state.error}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={isPending}
            className={cn(BRASS_BUTTON_CLASS, "w-full")}
          >
            {isPending ? "Transfiriendo..." : "Transferir"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
