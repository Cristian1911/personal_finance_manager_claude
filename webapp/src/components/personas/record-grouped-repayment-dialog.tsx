"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/ui/amount-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, BRASS_GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { toColombiaDateString } from "@/lib/utils/date";
import { useAccounts } from "@/components/providers/app-data-provider";
import { recordGroupedRepayment } from "@/actions/personal-debts";
import { isDebtAccountType } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

interface RecordGroupedRepaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active debts the payment is spread across (oldest first, server-side). */
  debtIds: string[];
  personName: string;
  /** What the payment is for — the trip's name, or "todo lo pendiente". */
  scopeLabel: string;
  outstandingAmount: number;
  currency: CurrencyCode;
  direction: "lent" | "borrowed";
  defaultAccountId?: string | null;
}

/**
 * One payment against a whole viaje (or everything a person owes). The amount
 * is spread across the debts oldest-first on the server, one repayment
 * movement per debt it reaches — so the user confirms once, not once per
 * expense.
 */
export function RecordGroupedRepaymentDialog({
  open,
  onOpenChange,
  debtIds,
  personName,
  scopeLabel,
  outstandingAmount,
  currency,
  direction,
  defaultAccountId,
}: RecordGroupedRepaymentDialogProps) {
  const router = useRouter();
  const accounts = useAccounts();
  const today = toColombiaDateString(new Date());

  // Money coming back lands where it left from; never default onto a credit card.
  const preferredAccountId = useMemo(() => {
    const origin = defaultAccountId ? accounts.find((a) => a.id === defaultAccountId) : undefined;
    if (origin && !isDebtAccountType(origin.account_type)) return origin.id;
    return accounts.find((a) => !isDebtAccountType(a.account_type))?.id ?? accounts[0]?.id ?? "";
  }, [defaultAccountId, accounts]);

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(preferredAccountId);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const parsedAmount = Number.parseFloat(amount);
  const overpay = parsedAmount > outstandingAmount + 0.005;
  const canSubmit = !pending && !!accountId && parsedAmount > 0 && !overpay;

  function submit() {
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("account_id", accountId);
    fd.set("transaction_date", date);
    fd.set("notes", notes.trim() || `Abono ${scopeLabel} · ${personName}`);
    startTransition(async () => {
      const res = await recordGroupedRepayment(debtIds, fd);
      if (res.success) {
        const n = res.data.transactions;
        const dup = res.data.skipped > 0 ? ` (${res.data.skipped} ya existían)` : "";
        toast.success((n === 1 ? "Abono registrado" : `Abono registrado en ${n} movimientos`) + dup);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al registrar el abono");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {direction === "borrowed" ? "Pagar" : "Registrar pago"} · {personName}
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-center text-xs text-muted-foreground">
          {scopeLabel} · pendiente{" "}
          <span className="font-semibold tabular-nums text-z-sage-light">
            {formatCurrency(outstandingAmount, currency)}
          </span>
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <AmountInput
              name="amount"
              currency={currency}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setAmount(String(outstandingAmount))}
                className={cn(BRASS_GHOST_BUTTON_CLASS, "rounded-full px-4 py-1.5 text-xs font-semibold")}
              >
                Pagar todo · {formatCurrency(outstandingAmount, currency)}
              </button>
            </div>
            {overpay && (
              <p className="text-center text-[11px] text-z-expense">
                El abono supera lo pendiente.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <DatePicker value={date} onChange={(v) => setDate(v ?? today)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grouped-repay-notes">Notas (opcional)</Label>
            <Input
              id="grouped-repay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Abono ${scopeLabel}`}
            />
          </div>
          <Button type="button" className={cn(BRASS_BUTTON_CLASS, "w-full")} disabled={!canSubmit} onClick={submit}>
            {pending ? "Guardando..." : "Registrar abono"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Se reparte entre {debtIds.length === 1 ? "la deuda" : `las ${debtIds.length} deudas`} de más antigua a más
            reciente, un movimiento por cada una que alcance.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
