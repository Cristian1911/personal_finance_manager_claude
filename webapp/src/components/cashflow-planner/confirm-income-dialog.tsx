"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import {
  findCandidateTransactions,
  confirmIncomeReceived,
} from "@/actions/cashflow-planner";
import type { PlanCandidateTransaction } from "@/actions/cashflow-planner";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import type { PlanningEntryWithRelations } from "@/types/cashflow-planner";
import type { CurrencyCode } from "@/types/domain";
import type { PlanAccount } from "@/components/mobile/v2/plan/mobile-periodo-view";
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";

interface ConfirmIncomeDialogProps {
  entry: PlanningEntryWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  accounts: PlanAccount[];
  periodMonth: string; // YYYY-MM
}

const SPENDABLE_TYPES = ["CHECKING", "SAVINGS", "CASH"] as const;

/**
 * Income confirmation sheet (pure-C — always opens, deliberate accuracy gate).
 * Confirm-by-amount is primary (records a real INFLOW → raises Saldo actual);
 * linking an already-imported movement is offered below.
 */
export function ConfirmIncomeDialog({
  entry,
  open,
  onOpenChange,
  currency,
  accounts,
  periodMonth,
}: ConfirmIncomeDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [candidates, setCandidates] = useState<PlanCandidateTransaction[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const spendableAccounts = accounts.filter((a) =>
    (SPENDABLE_TYPES as readonly string[]).includes(a.account_type)
  );

  useEffect(() => {
    if (!open || !entry) return;
    setAmount(String(Math.round(Number(entry.amount))));
    // Prefer the entry's own account when it's spendable, else first spendable.
    const own = entry.account_id
      ? spendableAccounts.find((a) => a.id === entry.account_id)
      : null;
    setAccountId(own?.id ?? spendableAccounts[0]?.id ?? "");
    setLoadingCandidates(true);
    findCandidateTransactions({
      entryLabel: entry.label,
      entryAmount: Number(entry.amount),
      month: periodMonth,
    }).then((result) => {
      setLoadingCandidates(false);
      setCandidates(result.success ? result.data : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, periodMonth]);

  if (!entry) return null;

  const effectiveAmount = Number(amount) || 0;

  function handleConfirm() {
    if (!entry) return;
    if (effectiveAmount <= 0) {
      toast.error("El monto debe ser mayor a cero");
      return;
    }
    if (!accountId) {
      toast.error("Selecciona una cuenta");
      return;
    }
    startTransition(async () => {
      const result = await confirmIncomeReceived({
        entryId: entry.id,
        amount: effectiveAmount,
        accountId,
        currencyCode: entry.currency_code ?? currency,
        label: entry.label,
      });
      if (result.success) {
        toast.success("Ingreso confirmado");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleLink(txId: string) {
    if (!entry) return;
    startTransition(async () => {
      const result = await confirmIncomeReceived({
        entryId: entry.id,
        existingTransactionId: txId,
      });
      if (result.success) {
        toast.success("Ingreso vinculado");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar recibido</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {entry.label}
            {" · esperado "}
            {formatCurrency(Number(entry.amount), currency)}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-income-amount">Monto recibido</Label>
            <CurrencyInput
              id="confirm-income-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Monto"
              className="bg-card border-white/6"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-income-account">Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger
                id="confirm-income-account"
                className="bg-card border-white/6"
              >
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {spendableAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <AccountRowIdentity
                        account={{
                          name: a.name,
                          mask: a.mask ?? null,
                          bank_key: a.bank_key ?? null,
                          account_type: a.account_type,
                          color: a.color ?? null,
                        }}
                        density="picker"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {formatCurrency(
                          a.current_balance,
                          a.currency_code as CurrencyCode
                        )}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className={cn("w-full", BRASS_BUTTON_CLASS)}
            disabled={isPending || !accountId || effectiveAmount <= 0}
            onClick={handleConfirm}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Check className="size-4 mr-2" />
            )}
            Confirmar {formatCurrency(effectiveAmount, currency)}
          </Button>

          {/* Link an already-imported movement */}
          {(loadingCandidates || candidates.length > 0) && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/6" />
                <span className="text-[11px] text-muted-foreground">
                  o vincula un movimiento
                </span>
                <div className="h-px flex-1 bg-white/6" />
              </div>

              {loadingCandidates ? (
                <div className="flex items-center justify-center py-3 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin mr-2" />
                  <span className="text-xs">Buscando movimientos...</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {candidates.map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleLink(tx.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-black/10 p-3 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {tx.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(tx.transaction_date, "dd MMM")}
                          {tx.account_name && ` · ${tx.account_name}`}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-z-income">
                        {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
