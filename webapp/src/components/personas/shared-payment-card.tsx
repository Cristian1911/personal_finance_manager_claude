"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BRASS_GHOST_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  ICON_DESTRUCTIVE_TRIGGER_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { RecordRepaymentDialog } from "./record-repayment-dialog";
import { reopenPersonalDebt } from "@/actions/personal-debts";
import { deleteSharedPayment } from "@/actions/shared-payments";
import type { CurrencyCode, SharedPaymentGroup } from "@/types/domain";

interface SharedPaymentCardProps {
  group: SharedPaymentGroup;
  currency: CurrencyCode;
}

export function SharedPaymentCard({ group, currency }: SharedPaymentCardProps) {
  const router = useRouter();
  const [repayDebtId, setRepayDebtId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const repayDebt = group.debts.find((d) => d.id === repayDebtId) ?? null;

  // owed = what others owe in total (total − your share); effective spend = what
  // you've actually borne so far (total − recovered).
  const owed = Math.max(0, group.total - group.userShare);
  const effectiveSpend = Math.max(0, group.total - group.recovered);

  function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await action();
      if (res.success) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo completar la acción");
      }
    });
  }

  return (
    <div className={cn("space-y-3 p-4", PANEL_INSET_CLASS)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-z-sage-light">
            <Receipt className="size-3.5 shrink-0 text-z-brass" />
            {group.description ?? "Pago compartido"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(group.paid_on)} · Total {formatCurrency(group.total, currency)}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <p className={SECTION_EYEBROW_CLASS}>Tu parte</p>
            <p className="text-sm font-semibold tabular-nums text-z-brass">
              {formatCurrency(group.userShare, currency)}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                aria-label="Eliminar pago compartido"
                disabled={pending}
                className={cn(ICON_DESTRUCTIVE_TRIGGER_CLASS, "mt-0.5 p-1")}
              >
                <Trash2 className="size-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este pago compartido?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán las deudas de las personas. La transacción del pago se
                  conserva (deja de estar marcada como compartida). Esta acción no se
                  puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="ghost"
                  className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
                  disabled={pending}
                  onClick={() =>
                    run(() => deleteSharedPayment(group.split_group_id), "Pago compartido eliminado")
                  }
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Recovered progress */}
      <p className="text-xs text-muted-foreground">
        Recuperado{" "}
        <span className="tabular-nums text-z-sage-light">{formatCurrency(group.recovered, currency)}</span>{" "}
        de {formatCurrency(owed, currency)} · Gasto actual{" "}
        <span className="tabular-nums text-z-sage-light">{formatCurrency(effectiveSpend, currency)}</span>
      </p>

      <div className="space-y-2 border-t border-white/6 pt-3">
        {group.debts.map((d) => {
          const isActive = d.status === "active";
          return (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{d.destinatario_name}</span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  isActive ? "text-z-sage-light" : "text-muted-foreground line-through",
                )}
              >
                {formatCurrency(d.outstanding_amount, d.currency_code as CurrencyCode)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    className={cn(BRASS_GHOST_BUTTON_CLASS, "h-7 px-2 text-xs")}
                    onClick={() => setRepayDebtId(d.id)}
                  >
                    Registrar pago
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    className={cn(GHOST_BUTTON_CLASS, "h-7 px-2 text-xs")}
                    onClick={() => run(() => reopenPersonalDebt(d.id), "Deuda reabierta")}
                  >
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {repayDebt && (
        <RecordRepaymentDialog
          open={!!repayDebtId}
          onOpenChange={(o) => !o && setRepayDebtId(null)}
          personalDebtId={repayDebt.id}
          personName={repayDebt.destinatario_name}
          outstandingAmount={repayDebt.outstanding_amount}
          currency={repayDebt.currency_code as CurrencyCode}
          defaultAccountId={group.origin_account_id}
        />
      )}
    </div>
  );
}
