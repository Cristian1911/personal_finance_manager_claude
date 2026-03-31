"use client";

import { useState, useTransition } from "react";
import { Check, X, CheckCheck, Loader2, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  approveEmailTransaction,
  dismissEmailTransaction,
  bulkApproveEmailTransactions,
} from "@/actions/email-ingest";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { PendingEmailTransaction } from "@/types/domain";

interface ParsedData {
  direction: string;
  amount: number;
  merchant: string | null;
  destination: string | null;
  transaction_date: string;
  pattern_type: string;
}

interface PendingEmailTransactionsProps {
  transactions: PendingEmailTransaction[];
}

export function PendingEmailTransactions({
  transactions: initialTransactions,
}: PendingEmailTransactionsProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (transactions.length === 0) return null;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t) => t.id)));
    }
  }

  function removeFromState(ids: string[]) {
    setTransactions((prev) => prev.filter((t) => !ids.includes(t.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function handleApprove(pendingId: string) {
    startTransition(async () => {
      await approveEmailTransaction(pendingId);
      removeFromState([pendingId]);
    });
  }

  function handleDismiss(pendingId: string) {
    startTransition(async () => {
      await dismissEmailTransaction(pendingId);
      removeFromState([pendingId]);
    });
  }

  function handleBulkApprove() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkApproveEmailTransactions(ids);
      removeFromState(ids);
    });
  }

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-z-sage-dark" />
            <CardTitle className="text-base">Pendientes por correo</CardTitle>
            <span className="rounded-full bg-z-brass/20 px-2 py-0.5 text-xs font-semibold text-z-brass">
              {transactions.length}
            </span>
          </div>
          {selected.size > 0 && (
            <Button
              size="sm"
              className={BRASS_BUTTON_CLASS}
              onClick={handleBulkApprove}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCheck className="size-4" />
              )}
              Aprobar {selected.size} {selected.size === 1 ? "seleccionada" : "seleccionadas"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/6">
          {/* Select all row */}
          <div className="flex items-center gap-3 px-6 py-2">
            <Checkbox
              checked={
                selected.size === transactions.length
                  ? true
                  : selected.size > 0
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={toggleSelectAll}
              aria-label="Seleccionar todas"
            />
            <span className="text-xs text-muted-foreground">Seleccionar todas</span>
          </div>

          {transactions.map((tx) => {
            const parsed = tx.parsed_data as unknown as ParsedData;
            const merchant =
              parsed.merchant ?? parsed.destination ?? "Transacción";
            const isInflow = parsed.direction === "INFLOW";

            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-6 py-3 hover:bg-white/2 transition-colors"
              >
                <Checkbox
                  checked={selected.has(tx.id)}
                  onCheckedChange={() => toggleSelect(tx.id)}
                  aria-label={`Seleccionar ${merchant}`}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(parsed.transaction_date)}
                  </p>
                </div>

                <p
                  className={
                    isInflow
                      ? "text-sm font-semibold text-z-income"
                      : "text-sm font-semibold"
                  }
                >
                  {isInflow ? "+" : ""}
                  {formatCurrency(parsed.amount, "COP")}
                </p>

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-z-income hover:bg-z-income/10 hover:text-z-income"
                    onClick={() => handleApprove(tx.id)}
                    disabled={isPending}
                    aria-label="Aprobar"
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDismiss(tx.id)}
                    disabled={isPending}
                    aria-label="Descartar"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
