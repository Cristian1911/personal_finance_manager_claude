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
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import {
  findCandidateTransactions,
  payPlanningEntry,
} from "@/actions/cashflow-planner";
import type { PlanCandidateTransaction } from "@/actions/cashflow-planner";
import { toast } from "sonner";
import { Check, Link, CreditCard, Loader2 } from "lucide-react";
import type { PlanningEntryWithRelations } from "@/types/cashflow-planner";
import type { CurrencyCode } from "@/types/domain";
import type { PlanAccount } from "@/components/mobile/v2/plan/mobile-periodo-view";

/* ── Amount Mode ── */
type AmountMode = "planned" | "total_debt" | "custom";

interface PayExpenseDialogProps {
  entry: PlanningEntryWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  accounts: PlanAccount[];
  periodMonth: string; // YYYY-MM
}

export function PayExpenseDialog({
  entry,
  open,
  onOpenChange,
  currency,
  accounts,
  periodMonth,
}: PayExpenseDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"link" | "create">("link");
  const [candidates, setCandidates] = useState<PlanCandidateTransaction[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  // Create mode state
  const [amountMode, setAmountMode] = useState<AmountMode>("planned");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [sourceAccountId, setSourceAccountId] = useState<string>("");

  // Derive debt account info from the entry's account
  const entryAccountId = entry?.account_id;
  const entryAccount = entryAccountId
    ? accounts.find((a) => a.id === entryAccountId)
    : null;
  const isDebtEntry =
    entryAccount != null && isDebtAccountType(entryAccount.account_type);
  const debtBalance = isDebtEntry ? Math.abs(Number(entryAccount.current_balance)) : 0;

  // Source accounts = CHECKING + SAVINGS
  const sourceAccounts = accounts.filter(
    (a) => a.account_type === "CHECKING" || a.account_type === "SAVINGS",
  );

  // Load candidates when dialog opens
  useEffect(() => {
    if (!open || !entry) return;
    setMode("link");
    setSelectedTxId(null);
    setAmountMode("planned");
    setCustomAmount("");
    setSourceAccountId("");
    setLoadingCandidates(true);

    findCandidateTransactions({
      entryLabel: entry.label,
      entryAmount: Number(entry.amount),
      debtAccountId: isDebtEntry ? entryAccountId : null,
      month: periodMonth,
    }).then((result) => {
      setLoadingCandidates(false);
      if (result.success) {
        setCandidates(result.data);
        // If no candidates found, go straight to create mode
        if (result.data.length === 0) setMode("create");
      } else {
        setCandidates([]);
        setMode("create");
      }
    });
  }, [open, entry, entryAccountId, isDebtEntry, periodMonth]);

  if (!entry) return null;

  const entryAmount = entry.converted_amount;

  function getEffectiveAmount(): number {
    switch (amountMode) {
      case "planned":
        return entryAmount;
      case "total_debt":
        return debtBalance;
      case "custom":
        return Number(customAmount) || 0;
    }
  }

  function handleLinkTransaction() {
    if (!selectedTxId || !entry) return;
    startTransition(async () => {
      const result = await payPlanningEntry({
        entryId: entry.id,
        existingTransactionId: selectedTxId,
      });
      if (result.success) {
        toast.success("Pago vinculado");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCreatePayment() {
    if (!entry) return;
    const amount = getEffectiveAmount();
    if (amount <= 0) {
      toast.error("El monto debe ser mayor a cero");
      return;
    }
    if (!sourceAccountId) {
      toast.error("Selecciona una cuenta origen");
      return;
    }

    startTransition(async () => {
      const result = await payPlanningEntry({
        entryId: entry.id,
        amount,
        sourceAccountId,
        debtAccountId: isDebtEntry ? entryAccountId! : undefined,
        currencyCode: entry.currency_code ?? currency,
        categoryId: entry.category_id,
        recurringTemplateId: entry.recurring_template_id,
        label: entry.label,
      });
      if (result.success) {
        toast.success("Pago registrado");
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
          <DialogTitle>
            Pagar: {entry.label}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(entryAmount, currency)}
            {" \u00b7 "}
            {formatDate(entry.expected_date, "dd MMM yyyy")}
          </p>
        </DialogHeader>

        {/* ── LINK MODE ── */}
        {mode === "link" && (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              Ya hiciste este pago?
            </p>

            {loadingCandidates && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" />
                <span className="text-xs">Buscando transacciones...</span>
              </div>
            )}

            {!loadingCandidates && candidates.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {candidates.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setSelectedTxId(tx.id === selectedTxId ? null : tx.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      selectedTxId === tx.id
                        ? "border-z-brass/50 bg-z-brass/8"
                        : "border-white/6 bg-black/10 hover:bg-white/[0.03]",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border",
                        selectedTxId === tx.id
                          ? "border-z-brass bg-z-brass text-z-ink"
                          : "border-white/10 bg-white/5",
                      )}
                    >
                      {selectedTxId === tx.id && <Check className="size-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">
                        {tx.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(tx.transaction_date, "dd MMM")}
                        {tx.account_name && ` \u00b7 ${tx.account_name}`}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-z-debt shrink-0">
                      {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                className={cn("w-full", BRASS_BUTTON_CLASS)}
                disabled={!selectedTxId || isPending}
                onClick={handleLinkTransaction}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Link className="size-4 mr-2" />
                )}
                Vincular transaccion
              </Button>

              <button
                type="button"
                onClick={() => setMode("create")}
                className="text-xs text-z-brass hover:underline text-center py-1"
              >
                No, registrar nuevo pago
              </button>
            </div>
          </div>
        )}

        {/* ── CREATE MODE ── */}
        {mode === "create" && (
          <div className="space-y-4">
            {/* Amount options */}
            <div className="space-y-2">
              <Label>Monto del pago</Label>
              <div className="space-y-2">
                {/* Planned amount */}
                <button
                  type="button"
                  onClick={() => setAmountMode("planned")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                    amountMode === "planned"
                      ? "border-z-brass/50 bg-z-brass/8"
                      : "border-white/6 bg-black/10 hover:bg-white/[0.03]",
                  )}
                >
                  <span className="text-xs font-medium">Cuota planeada</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(entryAmount, currency)}
                  </span>
                </button>

                {/* Total debt — only for CREDIT_CARD/LOAN */}
                {isDebtEntry && debtBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountMode("total_debt")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                      amountMode === "total_debt"
                        ? "border-z-brass/50 bg-z-brass/8"
                        : "border-white/6 bg-black/10 hover:bg-white/[0.03]",
                    )}
                  >
                    <span className="text-xs font-medium">Pago total deuda</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(debtBalance, entryAccount!.currency_code as CurrencyCode)}
                    </span>
                  </button>
                )}

                {/* Custom amount */}
                <button
                  type="button"
                  onClick={() => setAmountMode("custom")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                    amountMode === "custom"
                      ? "border-z-brass/50 bg-z-brass/8"
                      : "border-white/6 bg-black/10 hover:bg-white/[0.03]",
                  )}
                >
                  <span className="text-xs font-medium">Otro monto</span>
                </button>

                {amountMode === "custom" && (
                  <CurrencyInput
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Monto"
                    className="bg-card border-white/6"
                    disabled={isPending}
                  />
                )}
              </div>
            </div>

            {/* Source account */}
            <div className="space-y-2">
              <Label>Cuenta origen</Label>
              <Select
                value={sourceAccountId}
                onValueChange={setSourceAccountId}
              >
                <SelectTrigger className="bg-card border-white/6">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        {a.name}
                        <span className="text-[10px] text-muted-foreground">
                          {formatCurrency(a.current_balance, a.currency_code as CurrencyCode)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className={cn("w-full", BRASS_BUTTON_CLASS)}
                disabled={isPending || !sourceAccountId || getEffectiveAmount() <= 0}
                onClick={handleCreatePayment}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="size-4 mr-2" />
                )}
                Confirmar pago
              </Button>

              {candidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode("link")}
                  className="text-xs text-z-brass hover:underline text-center py-1"
                >
                  Vincular transaccion existente
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
