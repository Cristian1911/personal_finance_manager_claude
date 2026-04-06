"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { Banknote, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  allocateExtraPayment,
  computeExtraPaymentImpact,
  type DebtAccount,
  type ExtraPaymentAllocation,
} from "@zeta/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { applyExtraDebtPayment } from "@/actions/extra-payment";
import type { CurrencyCode } from "@/types/domain";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtraPaymentSheetProps {
  debtAccounts: DebtAccount[];
  sourceAccounts: Array<{
    id: string;
    name: string;
    current_balance: number;
    currency_code: string;
  }>;
  currency: CurrencyCode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExtraPaymentSheet({
  debtAccounts,
  sourceAccounts,
  currency,
  open,
  onOpenChange,
}: ExtraPaymentSheetProps) {
  const [totalAmount, setTotalAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(debtAccounts.filter((a) => a.balance > 0).map((a) => a.id))
  );
  const [manualOverrides, setManualOverrides] = useState<Map<string, number>>(
    new Map()
  );
  const [isPending, startTransition] = useTransition();

  // ── Computed ───────────────────────────────────────────────────────────────

  const parsedAmount = useMemo(() => {
    const cleaned = totalAmount.replace(/[^0-9.]/g, "");
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
  }, [totalAmount]);

  const allocations = useMemo<ExtraPaymentAllocation[]>(() => {
    if (parsedAmount <= 0 || selectedIds.size === 0) return [];
    return allocateExtraPayment({
      totalAmount: parsedAmount,
      accounts: debtAccounts,
      selectedIds: Array.from(selectedIds),
      manualOverrides,
    });
  }, [parsedAmount, debtAccounts, selectedIds, manualOverrides]);

  const impact = useMemo(() => {
    if (allocations.length === 0) return null;
    const hasNonZero = allocations.some((a) => a.allocatedAmount > 0);
    if (!hasNonZero) return null;
    return computeExtraPaymentImpact({ accounts: debtAccounts, allocations });
  }, [debtAccounts, allocations]);

  // ── Source account info ────────────────────────────────────────────────────

  const selectedSource = useMemo(
    () => sourceAccounts.find((a) => a.id === sourceAccountId),
    [sourceAccounts, sourceAccountId]
  );

  const isOverBalance =
    !!selectedSource && parsedAmount > selectedSource.current_balance;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleDebt = useCallback(
    (accountId: string, checked: boolean | "indeterminate") => {
      const isChecked = checked === true;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (isChecked) {
          next.add(accountId);
        } else {
          next.delete(accountId);
        }
        return next;
      });
      // Clear override when toggling
      setManualOverrides((prev) => {
        const next = new Map(prev);
        next.delete(accountId);
        return next;
      });
    },
    []
  );

  const handleOverrideAmount = useCallback(
    (accountId: string, rawDigits: string) => {
      if (rawDigits === "") {
        setManualOverrides((prev) => {
          const next = new Map(prev);
          next.set(accountId, 0);
          return next;
        });
        return;
      }
      const num = parseInt(rawDigits, 10);
      if (isNaN(num) || num < 0) return;
      setManualOverrides((prev) => {
        const next = new Map(prev);
        next.set(accountId, num);
        return next;
      });
    },
    []
  );

  const handleResetOverrides = useCallback(() => {
    setManualOverrides(new Map());
  }, []);

  const handleApply = useCallback(() => {
    if (!sourceAccountId || allocations.length === 0) return;

    const source = sourceAccounts.find((a) => a.id === sourceAccountId);
    if (!source) return;

    const validAllocations = allocations
      .filter((a) => a.allocatedAmount > 0)
      .map((a) => ({
        accountId: a.accountId,
        accountName: a.accountName,
        amount: a.allocatedAmount,
      }));

    if (validAllocations.length === 0) return;

    startTransition(async () => {
      const result = await applyExtraDebtPayment({
        sourceAccountId,
        sourceAccountName: source.name,
        allocations: validAllocations,
        description: "Pago extra",
      });

      if (result.success) {
        toast.success(
          `Pago aplicado: ${formatCurrency(result.data.totalPaid, currency)} distribuido en ${result.data.applied} ${result.data.applied === 1 ? "deuda" : "deudas"}`
        );
        // Reset state
        setTotalAmount("");
        setSourceAccountId("");
        setManualOverrides(new Map());
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Error al aplicar el pago");
      }
    });
  }, [sourceAccountId, sourceAccounts, allocations, currency, onOpenChange]);

  const hasValidAllocation =
    sourceAccountId &&
    parsedAmount > 0 &&
    allocations.some((a) => a.allocatedAmount > 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Banknote className="size-5 text-z-brass" />
            Pago extra a deudas
          </SheetTitle>
          <SheetDescription>
            Distribuye un abono adicional entre tus deudas usando la estrategia
            avalanche (mayor interés primero).
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          {/* ── Zone 1: Amount & Source ── */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="extra-amount">Monto a abonar</Label>
              <Input
                id="extra-amount"
                inputMode="numeric"
                placeholder="$0"
                value={parsedAmount > 0 ? formatCurrency(parsedAmount, currency) : ""}
                onChange={(e) => setTotalAmount(e.target.value.replace(/\D/g, ""))}
                className="text-2xl font-semibold h-14"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source-account">Cuenta origen</Label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger id="source-account">
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {sourceAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <span className="flex items-center gap-2">
                        <span>{account.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatCurrency(
                            account.current_balance,
                            account.currency_code as CurrencyCode
                          )}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isOverBalance && selectedSource && (
              <p className="text-amber-400 text-sm">
                El monto supera el saldo disponible de{" "}
                {formatCurrency(
                  selectedSource.current_balance,
                  selectedSource.currency_code as CurrencyCode
                )}{" "}
                en esta cuenta.
              </p>
            )}
          </div>

          {/* ── Impact Preview — pinned above allocation for constant visibility ── */}
          {impact && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/6 bg-z-surface-2/55 p-3 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                    Ahorro mensual en intereses
                  </span>
                  <span className="text-lg font-semibold text-z-brass">
                    {formatCurrency(impact.monthlyInterestSaved, currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(impact.monthlyInterestBefore, currency)}{" "}
                    →{" "}
                    {formatCurrency(impact.monthlyInterestAfter, currency)}
                  </span>
                </div>
                <div className="rounded-xl border border-white/6 bg-z-surface-2/55 p-3 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                    Meses menos de deuda
                  </span>
                  <span className="text-lg font-semibold text-z-brass">
                    {impact.monthsSaved}{" "}
                    {impact.monthsSaved === 1 ? "mes" : "meses"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {impact.monthsToDebtFreeBefore} →{" "}
                    {impact.monthsToDebtFreeAfter} meses
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/10 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Ahorro total en intereses
                </span>
                <span className="text-sm font-semibold text-z-brass">
                  {formatCurrency(impact.totalInterestSavedOverLife, currency)}
                </span>
              </div>
            </div>
          )}

          {/* ── Zone 2: Allocation ── */}
          {parsedAmount > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Distribución
                </span>
                <div className="flex items-center gap-3">
                  {allocations.length > 0 && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(allocations.reduce((s, a) => s + a.allocatedAmount, 0), currency)}
                      {(() => {
                        const remaining = parsedAmount - allocations.reduce((s, a) => s + a.allocatedAmount, 0);
                        if (remaining <= 0) return null;
                        return (
                          <span className="text-amber-400">
                            {" "}· {formatCurrency(remaining, currency)} sobrante
                          </span>
                        );
                      })()}
                    </span>
                  )}
                  {manualOverrides.size > 0 && (
                    <button
                      type="button"
                      onClick={handleResetOverrides}
                      className="flex items-center gap-1 text-xs text-z-brass hover:text-z-brass/80 transition-colors"
                    >
                      <RotateCcw className="size-3" />
                      Resetear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {debtAccounts
                  .filter((a) => a.balance > 0)
                  .map((account) => {
                    const isSelected = selectedIds.has(account.id);
                    const allocation = allocations.find(
                      (al) => al.accountId === account.id
                    );
                    const overrideValue = manualOverrides.get(account.id);
                    const displayAmount = overrideValue !== undefined
                      ? overrideValue
                      : allocation
                        ? Math.round(allocation.allocatedAmount)
                        : 0;

                    return (
                      <div
                        key={account.id}
                        className="flex items-center gap-3 rounded-lg border border-white/6 bg-black/10 p-3"
                      >
                        <Checkbox
                          id={`debt-${account.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleToggleDebt(account.id, checked)
                          }
                        />
                        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                          <label
                            htmlFor={`debt-${account.id}`}
                            className="text-sm font-medium leading-none cursor-pointer truncate"
                          >
                            {account.name}
                          </label>
                          <span className="text-xs text-muted-foreground">
                            {account.interestRate != null
                              ? `${account.interestRate}% · `
                              : ""}
                            {formatCurrency(account.balance, currency)}
                          </span>
                          {account.currencyBreakdown
                            ?.filter((cb) => cb.currency !== currency && cb.balance > 0)
                            .map((cb) => (
                              <span key={cb.currency} className="text-[10px] text-amber-400">
                                + {formatCurrency(cb.balance, cb.currency as CurrencyCode)} {cb.currency}
                              </span>
                            ))}

                        </div>
                        <Input
                          inputMode="numeric"
                          disabled={!isSelected}
                          value={isSelected && displayAmount > 0 ? formatCurrency(displayAmount, currency) : ""}
                          onChange={(e) =>
                            handleOverrideAmount(account.id, e.target.value.replace(/\D/g, ""))
                          }
                          className="w-28 text-right text-sm"
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        </div>

        <SheetFooter className="flex flex-row gap-2 px-4 pt-2">
          <Button
            className={BRASS_BUTTON_CLASS}
            disabled={!hasValidAllocation || isPending}
            onClick={handleApply}
          >
            {isPending ? "Aplicando..." : "Aplicar pagos"}
          </Button>
          <Button
            variant="outline"
            className={GHOST_BUTTON_CLASS}
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
