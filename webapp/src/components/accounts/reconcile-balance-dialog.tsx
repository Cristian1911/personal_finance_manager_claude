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
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { reconcileBalance } from "@/actions/accounts";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface ReconcileBalanceDialogProps {
  accountId: string;
  accountName: string;
  currentBalance: number;
  currencyCode: string;
  trigger?: React.ReactNode;
}

export function ReconcileBalanceDialog({
  accountId,
  accountName,
  currentBalance,
  currencyCode,
  trigger,
}: ReconcileBalanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsedBalance = useMemo(() => parseFloat(newBalance), [newBalance]);
  const delta = useMemo(
    () => (isNaN(parsedBalance) ? 0 : parsedBalance - currentBalance),
    [parsedBalance, currentBalance]
  );
  const isValid = !isNaN(parsedBalance) && parsedBalance >= 0 && newBalance !== "";

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      // Reset all state when opening
      setNewBalance("");
      setNotes("");
      setError(null);
    }
  }

  function handleSubmit() {
    if (!isValid) return;

    startTransition(async () => {
      const result = await reconcileBalance(
        accountId,
        parsedBalance,
        notes || undefined
      );

      if (result.success) {
        setOpen(false);
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
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar saldo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar saldo</DialogTitle>
          <DialogDescription>
            {accountName} — Saldo registrado:{" "}
            {formatCurrency(currentBalance, currencyCode as CurrencyCode)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* New balance input */}
          <div className="space-y-2">
            <Label htmlFor="new-balance">Nuevo saldo</Label>
            <CurrencyInput
              id="new-balance"
              autoFocus
              placeholder="0"
              value={newBalance}
              onChange={(e) => {
                setNewBalance(e.target.value);
                setError(null);
              }}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Ingresa el saldo que ves en tu app bancaria o billetera
            </p>
          </div>

          {/* Live delta preview */}
          {isValid && delta > 0 && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Diferencia:{" "}
                +{formatCurrency(delta, currencyCode as CurrencyCode)}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                Se creará un ajuste de ingreso por esta diferencia
              </p>
            </div>
          )}

          {isValid && delta < 0 && (
            <div className="rounded-md bg-orange-500/10 border border-orange-500/20 p-3 space-y-1">
              <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                Diferencia:{" "}
                {formatCurrency(delta, currencyCode as CurrencyCode)}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-500">
                Se creará un ajuste de gasto por esta diferencia
              </p>
            </div>
          )}

          {isValid && delta === 0 && (
            <p className="text-sm text-muted-foreground">
              El saldo ya coincide. Solo se actualizará la fecha de
              sincronización.
            </p>
          )}

          {/* Notes input */}
          <div className="space-y-2">
            <Label htmlFor="reconcile-notes">Notas (opcional)</Label>
            <Input
              id="reconcile-notes"
              type="text"
              placeholder="Ej: Saldo verificado en app bancaria"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
          >
            {isPending ? "Actualizando..." : "Actualizar saldo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
