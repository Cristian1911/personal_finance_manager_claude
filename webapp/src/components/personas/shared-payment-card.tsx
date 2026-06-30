"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { BRASS_GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { RecordRepaymentDialog } from "./record-repayment-dialog";
import type { CurrencyCode, SharedPaymentGroup } from "@/types/domain";

interface SharedPaymentCardProps {
  group: SharedPaymentGroup;
  currency: CurrencyCode;
}

export function SharedPaymentCard({ group, currency }: SharedPaymentCardProps) {
  const [repayDebtId, setRepayDebtId] = useState<string | null>(null);
  const repayDebt = group.debts.find((d) => d.id === repayDebtId) ?? null;

  return (
    <div className="space-y-3 rounded-2xl border border-white/6 bg-black/10 p-4">
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
        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Tu parte
          </p>
          <p className="text-sm font-semibold tabular-nums text-z-brass">
            {formatCurrency(group.userShare, currency)}
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/6 pt-3">
        {group.debts.map((d) => {
          const isActive = d.status === "active";
          return (
            <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{d.destinatario_name}</span>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    "tabular-nums",
                    isActive ? "text-z-sage-light" : "text-muted-foreground line-through",
                  )}
                >
                  {formatCurrency(d.outstanding_amount, d.currency_code as CurrencyCode)}
                </span>
                {isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(BRASS_GHOST_BUTTON_CLASS, "h-7 px-2 text-xs")}
                    onClick={() => setRepayDebtId(d.id)}
                  >
                    Abono
                  </Button>
                ) : (
                  <span className="text-xs text-z-sage-light">Saldado</span>
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
        />
      )}
    </div>
  );
}
