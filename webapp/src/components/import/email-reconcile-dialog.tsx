"use client";

import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { ReconciliationCandidatePreview } from "@/actions/email-ingest";
import type { CurrencyCode } from "@/types/domain";

interface EmailReconcileDialogProps {
  candidate: ReconciliationCandidatePreview | null;
  currency: CurrencyCode;
  loading?: boolean;
  onClose: () => void;
  /** `true` → merge into the existing transaction; `false` → import as new. */
  onChoose: (reconcile: boolean) => void;
}

/**
 * "Posible duplicado" prompt shown before importing a queued email
 * transaction that matches an existing one. Shared by every queue surface so
 * the decision always reads the same.
 */
export function EmailReconcileDialog({
  candidate,
  currency,
  loading = false,
  onClose,
  onChoose,
}: EmailReconcileDialogProps) {
  const isInflow = candidate?.direction === "INFLOW";
  return (
    <Dialog open={!!candidate} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Posible duplicado encontrado</DialogTitle>
          <DialogDescription>
            Ya existe una transacción similar en esta cuenta:
          </DialogDescription>
        </DialogHeader>
        {candidate && (
          <div className="rounded-lg border border-white/6 bg-white/3 p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  isInflow ? "bg-z-income/10 text-z-income" : "bg-white/5 text-muted-foreground",
                )}
              >
                {isInflow ? (
                  <ArrowDownLeft className="size-3.5" />
                ) : (
                  <ArrowUpRight className="size-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {candidate.merchant_name ?? candidate.raw_description ?? "Transacción"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(candidate.transaction_date)}
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  isInflow && "text-z-income",
                )}
              >
                {isInflow ? "+" : "-"}
                {formatCurrency(candidate.amount, currency)}
              </p>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onChoose(false)} disabled={loading}>
            Importar como nueva
          </Button>
          <Button onClick={() => onChoose(true)} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Reconciliar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
