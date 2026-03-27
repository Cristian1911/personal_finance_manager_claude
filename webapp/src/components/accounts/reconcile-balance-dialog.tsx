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
import { getDirectionForBalanceDelta, isDebtAccountType } from "@/lib/utils/account-balance";
import { getTrackedCurrencyBalances } from "@/lib/utils/currency-balances";
import { formatCurrency } from "@/lib/utils/currency";
import type { Json } from "@/types/database";
import type { CurrencyCode } from "@/types/domain";

interface ReconcileBalanceDialogProps {
  accountId: string;
  accountName: string;
  accountType: string;
  currentBalance: number;
  currencyBalances?: Json | null;
  currencyCode: string;
  trigger?: React.ReactNode;
}

export function ReconcileBalanceDialog({
  accountId,
  accountName,
  accountType,
  currentBalance,
  currencyBalances,
  currencyCode,
  trigger,
}: ReconcileBalanceDialogProps) {
  const [open, setOpen] = useState(false);
  const trackedBalances = useMemo(
    () =>
      getTrackedCurrencyBalances({
        currencyCode,
        currentBalance,
        currencyBalances,
      }),
    [currencyBalances, currencyCode, currentBalance]
  );
  const isMultiCurrency = trackedBalances.length > 1;
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const balanceStates = useMemo(
    () =>
      trackedBalances.map((balance) => {
        const rawValue = balanceInputs[balance.currency] ?? "";
        const parsedValue = rawValue === "" ? Number.NaN : parseFloat(rawValue);
        const delta = isNaN(parsedValue) ? 0 : parsedValue - balance.currentBalance;

        return {
          currency: balance.currency,
          currentBalance: balance.currentBalance,
          rawValue,
          parsedValue,
          delta,
          direction: getDirectionForBalanceDelta({ accountType, delta }),
          isValid: rawValue !== "" && !isNaN(parsedValue) && parsedValue >= 0,
        };
      }),
    [accountType, balanceInputs, trackedBalances]
  );
  const isDebtAccount = isDebtAccountType(accountType);
  const isValid = balanceStates.length > 0 && balanceStates.every((balance) => balance.isValid);
  const hasChanges = balanceStates.some((balance) => balance.delta !== 0);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setBalanceInputs(
        Object.fromEntries(
          trackedBalances.map((balance) => [
            balance.currency,
            isMultiCurrency ? String(balance.currentBalance) : "",
          ])
        )
      );
      setNotes("");
      setError(null);
    }
  }

  function handleSubmit() {
    if (!isValid) return;

    startTransition(async () => {
      const nextBalances = Object.fromEntries(
        balanceStates.map((balance) => [balance.currency, balance.parsedValue])
      );
      const result = await reconcileBalance(
        accountId,
        isMultiCurrency
          ? {
              currentBalance: nextBalances[currencyCode],
              currencyBalances: nextBalances,
              notes: notes || undefined,
            }
          : {
              currentBalance: nextBalances[currencyCode],
              notes: notes || undefined,
            }
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
      <DialogContent className={isMultiCurrency ? "sm:max-w-lg" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>Sobrescribir saldo real</DialogTitle>
          <DialogDescription>
            {accountName} —{" "}
            {isMultiCurrency ? "Saldos registrados" : "Saldo registrado"}:
            {isMultiCurrency ? (
              <span className="mt-2 block space-y-1">
                {trackedBalances.map((balance) => (
                  <span key={balance.currency} className="block">
                    {balance.currency}:{" "}
                    {formatCurrency(balance.currentBalance, balance.currency)}
                  </span>
                ))}
              </span>
            ) : (
              <span className="font-medium">
                {" "}
                {formatCurrency(currentBalance, currencyCode as CurrencyCode)}
              </span>
            )}
            <span className="mt-2 block">
              Guarda el saldo que ves en tu banco o billetera. Si hay diferencia,
              Zeta creará un ajuste temporal que luego podrás conciliar con tu próximo extracto.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            {balanceStates.map((balance, index) => (
              <div key={balance.currency} className="space-y-2">
                <Label htmlFor={`new-balance-${balance.currency}`}>
                  {isMultiCurrency ? `Nuevo saldo ${balance.currency}` : "Nuevo saldo"}
                </Label>
                <CurrencyInput
                  id={`new-balance-${balance.currency}`}
                  autoFocus={index === 0}
                  placeholder="0"
                  value={balance.rawValue}
                  onChange={(event) => {
                    setBalanceInputs((prev) => ({
                      ...prev,
                      [balance.currency]: event.target.value,
                    }));
                    setError(null);
                  }}
                  disabled={isPending}
                />
                {isMultiCurrency ? (
                  <p className="text-xs text-muted-foreground">
                    Registrado: {formatCurrency(balance.currentBalance, balance.currency)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Este valor reemplaza el saldo actual y deja trazabilidad de la diferencia
                  </p>
                )}
              </div>
            ))}
          </div>

          {isValid && hasChanges ? (
            <div className="space-y-2">
              {balanceStates
                .filter((balance) => balance.delta !== 0 && balance.direction)
                .map((balance) => (
                  <div
                    key={balance.currency}
                    className={[
                      "rounded-md border p-3 space-y-1",
                      isDebtAccount
                        ? balance.delta > 0
                          ? "border-orange-500/20 bg-orange-500/10"
                          : "border-z-income/20 bg-z-income/10"
                        : balance.direction === "INFLOW"
                          ? "border-z-income/20 bg-z-income/10"
                          : "border-orange-500/20 bg-orange-500/10",
                    ].join(" ")}
                  >
                    <p
                      className={[
                        "text-sm font-medium",
                        isDebtAccount
                          ? balance.delta > 0
                            ? "text-orange-700 dark:text-orange-400"
                            : "text-z-income"
                          : balance.direction === "INFLOW"
                            ? "text-z-income"
                            : "text-orange-700 dark:text-orange-400",
                      ].join(" ")}
                    >
                      {balance.currency}:{" "}
                      {isDebtAccount
                        ? balance.delta > 0
                          ? "la deuda registrada subirá"
                          : "la deuda registrada bajará"
                        : balance.direction === "INFLOW"
                          ? "el saldo registrado subirá"
                          : "el saldo registrado bajará"}{" "}
                      {formatCurrency(Math.abs(balance.delta), balance.currency)}
                    </p>
                    <p
                      className={[
                        "text-xs",
                        isDebtAccount
                          ? balance.delta > 0
                            ? "text-orange-600 dark:text-orange-500"
                            : "text-z-income"
                          : balance.direction === "INFLOW"
                            ? "text-z-income"
                            : "text-orange-600 dark:text-orange-500",
                      ].join(" ")}
                    >
                      Se guardará un ajuste temporal para cuadrar este saldo hasta la próxima importación.
                    </p>
                  </div>
                ))}
            </div>
          ) : null}

          {isValid && !hasChanges && (
            <p className="text-sm text-muted-foreground">
              {isMultiCurrency ? "Los saldos ya coinciden." : "El saldo ya coincide."} Solo se
              actualizará la fecha de sincronización.
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
            {isPending
              ? "Guardando..."
              : isMultiCurrency
                ? "Guardar saldos reales"
                : "Guardar saldo real"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
