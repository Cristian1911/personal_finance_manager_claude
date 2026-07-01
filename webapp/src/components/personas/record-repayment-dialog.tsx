"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/ui/amount-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { useAccounts } from "@/components/providers/app-data-provider";
import {
  recordRepayment,
  settlePersonalDebt,
  linkTransactionToPersonalDebt,
  getLinkableRepaymentTransactions,
  type LinkableTransaction,
} from "@/actions/personal-debts";
import type { CurrencyCode } from "@/types/domain";

interface RecordRepaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personalDebtId: string;
  personName: string;
  /** Remaining balance — enables "Pagar todo" and is shown as "Pendiente". */
  outstandingAmount: number;
  currency: CurrencyCode;
}

type Mode = "abono" | "vincular" | "saldar";

const MODES: { value: Mode; label: string }[] = [
  { value: "abono", label: "Abono" },
  { value: "vincular", label: "Vincular" },
  { value: "saldar", label: "Saldar" },
];

export function RecordRepaymentDialog({
  open,
  onOpenChange,
  personalDebtId,
  personName,
  outstandingAmount,
  currency,
}: RecordRepaymentDialogProps) {
  const router = useRouter();
  const accounts = useAccounts();
  const today = format(new Date(), "yyyy-MM-dd");

  const [mode, setMode] = useState<Mode>("abono");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  // Vincular mode: lazy-loaded candidate transactions.
  const [candidates, setCandidates] = useState<LinkableTransaction[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    if (mode !== "vincular" || candidates !== null || loadingCandidates) return;
    setLoadingCandidates(true);
    getLinkableRepaymentTransactions(personalDebtId)
      .then((res) => setCandidates(res.success ? res.data : []))
      .catch(() => setCandidates([]))
      .finally(() => setLoadingCandidates(false));
  }, [mode, candidates, loadingCandidates, personalDebtId]);

  function done(ok: string) {
    toast.success(ok);
    onOpenChange(false);
    router.refresh();
  }

  function submitAbono() {
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("account_id", accountId);
    fd.set("transaction_date", date);
    fd.set("notes", notes);
    startTransition(async () => {
      const res = await recordRepayment(personalDebtId, fd);
      if (res.success) done("Abono registrado");
      else toast.error(res.error ?? "Error al registrar el abono");
    });
  }

  function linkTx(txId: string) {
    startTransition(async () => {
      const res = await linkTransactionToPersonalDebt(personalDebtId, txId);
      if (res.success) done("Movimiento vinculado");
      else toast.error(res.error ?? "No se pudo vincular");
    });
  }

  function settle() {
    startTransition(async () => {
      const res = await settlePersonalDebt(personalDebtId);
      if (res.success) done("Deuda saldada");
      else toast.error(res.error ?? "No se pudo saldar");
    });
  }

  const canAbono = !pending && !!accountId && Number.parseFloat(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago · {personName}</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-center text-xs text-muted-foreground">
          Pendiente{" "}
          <span className="font-semibold tabular-nums text-z-sage-light">
            {formatCurrency(outstandingAmount, currency)}
          </span>
        </p>

        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/6 bg-black/20 p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                "rounded-lg py-2 text-sm font-semibold transition-colors",
                mode === m.value ? "bg-z-brass/15 text-z-brass" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ── Abono (parcial/total): crea un movimiento ── */}
        {mode === "abono" && (
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
              <Label htmlFor="repay-notes">Notas (opcional)</Label>
              <Input id="repay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalle" />
            </div>
            <Button
              type="button"
              className={cn(BRASS_BUTTON_CLASS, "w-full")}
              disabled={!canAbono}
              onClick={submitAbono}
            >
              {pending ? "Guardando..." : "Registrar abono"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Crea un movimiento nuevo. Para efectivo o dinero que aún no está en tus movimientos.
            </p>
          </div>
        )}

        {/* ── Vincular un movimiento existente (no duplica) ── */}
        {mode === "vincular" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Elige el movimiento que corresponde a este pago (no crea uno nuevo — ideal para
              transferencias que ya te llegaron al banco).
            </p>
            {loadingCandidates || candidates === null ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Cargando movimientos…</p>
            ) : candidates.length === 0 ? (
              <p className="rounded-xl border border-white/6 bg-black/10 px-3 py-4 text-center text-sm text-muted-foreground">
                No hay movimientos sin vincular. Registra un abono nuevo desde la pestaña “Abono”.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {candidates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={pending}
                    onClick={() => linkTx(t.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-3 text-left transition-colors hover:border-z-brass/40 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{t.description}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {formatDate(t.transaction_date)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-z-income">
                      {formatCurrency(t.amount, t.currency_code as CurrencyCode)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Saldar sin registrar movimiento (con advertencia) ── */}
        {mode === "saldar" && (
          <div className="space-y-3">
            <div className="flex gap-2.5 rounded-xl border border-z-debt/30 bg-z-debt/10 p-3 text-[13px] leading-relaxed text-z-expense">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <b>Saldar sin registrar movimiento.</b> No se crea ninguna transacción ni se mueve tu
                saldo. Úsalo solo si perdonaste la deuda o el pago fue en efectivo y no quieres
                registrarlo.
              </span>
            </div>
            <Button
              type="button"
              className={cn(DESTRUCTIVE_BUTTON_CLASS, "w-full")}
              disabled={pending}
              onClick={settle}
            >
              {pending ? "Guardando..." : "Saldar de todas formas"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(GHOST_BUTTON_CLASS, "w-full")}
              onClick={() => setMode("abono")}
            >
              <Link2 className="mr-1.5 size-4" />
              Mejor registro el pago
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
