"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HandCoins } from "lucide-react";
import { toast } from "sonner";
import { registerPayment } from "@/actions/accounts";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { formatCurrency } from "@/lib/utils/currency";
import { toColombiaDateString } from "@/lib/utils/date";
import type { Account } from "@/types/domain";
import type { CurrencyCode } from "@/types/domain";

const EXCLUDED_SOURCE_TYPES = new Set(["LOAN", "INVESTMENT"]);

interface QuickPaymentDialogProps {
  accountId: string;
  accountName: string;
  accountType: string;
  currentBalance: number;
  currencyCode: string;
  /** Other accounts the user can pick as source/destination */
  accounts: Pick<Account, "id" | "name" | "account_type" | "currency_code">[];
  /** Custom trigger button — defaults to an icon button */
  trigger?: React.ReactNode;
}

export function QuickPaymentDialog({
  accountId,
  accountName,
  accountType,
  currentBalance,
  currencyCode,
  accounts,
  trigger,
}: QuickPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amountRaw, setAmountRaw] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDebt = isDebtAccountType(accountType);

  // Only liquid accounts (not the target account itself) as source options.
  // Same currency only: the payment is booked as a transfer and there is no FX
  // here, so a different-currency source would be rejected server-side.
  const sourceAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.id !== accountId &&
          !EXCLUDED_SOURCE_TYPES.has(a.account_type) &&
          a.currency_code === currencyCode,
      ),
    [accounts, accountId, currencyCode]
  );

  const parsedAmount = amountRaw === "" ? NaN : parseFloat(amountRaw);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

  // Projected new balance
  const newBalance = useMemo(() => {
    if (!isValidAmount) return null;
    if (isDebt) {
      return Math.max(0, currentBalance - parsedAmount);
    }
    return currentBalance + parsedAmount;
  }, [isValidAmount, isDebt, currentBalance, parsedAmount]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setAmountRaw("");
      setSourceAccountId("");
      setNotes("");
      // Read the clock on open, on the client — never during render.
      setDate(toColombiaDateString(new Date()));
      setError(null);
    }
  }

  function handleSubmit() {
    if (!isValidAmount) return;

    startTransition(async () => {
      const result = await registerPayment(accountId, {
        amount: parsedAmount,
        sourceAccountId: sourceAccountId || undefined,
        notes: notes || undefined,
        date: date || undefined,
      });

      if (result.success) {
        setOpen(false);
        toast.success(
          isDebt
            ? `Pago de ${formatCurrency(parsedAmount, currencyCode as CurrencyCode)} registrado`
            : `Ingreso de ${formatCurrency(parsedAmount, currencyCode as CurrencyCode)} registrado`
        );
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <HandCoins className="mr-2 h-4 w-4" />
            {isDebt ? "Registrar pago" : "Registrar ingreso"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isDebt ? "Registrar pago" : "Registrar ingreso"}</DialogTitle>
          <DialogDescription>
            {isDebt
              ? `Registra un pago a ${accountName}`
              : `Registra un ingreso en ${accountName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Monto</Label>
            <CurrencyInput
              id="payment-amount"
              autoFocus
              placeholder="0"
              value={amountRaw}
              onChange={(e) => {
                setAmountRaw(e.target.value);
                setError(null);
              }}
              disabled={isPending}
            />
          </div>

          {/* Source account */}
          {sourceAccounts.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="source-account">Cuenta origen</Label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId} disabled={isPending}>
                <SelectTrigger id="source-account" className="w-full">
                  <SelectValue placeholder="Seleccionar cuenta (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si seleccionas una cuenta, se descontará el monto de su saldo
              </p>
            </div>
          )}

          {/* Date — a payment made days ago used to require editing both legs (#388) */}
          <div className="space-y-2">
            <Label>Fecha</Label>
            <DatePicker
              value={date}
              disabled={isPending}
              onChange={(v) => setDate(v ?? toColombiaDateString(new Date()))}
              placeholder="Seleccionar fecha"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notas (opcional)</Label>
            <Input
              id="payment-notes"
              type="text"
              placeholder="Ej: Pago mínimo tarjeta"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Balance preview */}
          {isValidAmount && newBalance !== null && (
            <div className="rounded-xl border border-white/6 bg-black/10 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Saldo actual</span>
                <span className="font-medium text-z-white">
                  {formatCurrency(currentBalance, currencyCode as CurrencyCode)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nuevo saldo</span>
                <span
                  className={
                    isDebt
                      ? "font-semibold text-z-income"
                      : "font-semibold text-z-sage-light"
                  }
                >
                  {formatCurrency(newBalance, currencyCode as CurrencyCode)}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!isValidAmount || isPending}
          >
            {isPending
              ? "Registrando..."
              : isDebt
                ? "Registrar pago"
                : "Registrar ingreso"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
