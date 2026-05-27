"use client";

import { Badge } from "@/components/ui/badge";
import { cancelSubscription, markForCancellation } from "@/actions/subscriptions";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import {
  GHOST_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
} from "@/lib/constants/styles";
import { ROW_ACTION_CLASS, useRowAction } from "./use-row-action";
import type { SubscriptionWithDetails, CurrencyCode } from "@/types/domain";

interface SubscriptionRowProps {
  subscription: SubscriptionWithDetails;
  currency: CurrencyCode;
  nextDate: string | null;
}

export function SubscriptionRow({
  subscription: s,
  currency,
  nextDate,
}: SubscriptionRowProps) {
  const { pending, run } = useRowAction();

  const amount = s.template_amount ?? s.estimated_amount ?? 0;

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/6 bg-z-surface-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-z-sage-light">{s.destinatario_name}</span>
          {!s.recurring_template_id && (
            <Badge variant="outline">estimado</Badge>
          )}
          {s.status === "marked_for_cancellation" && (
            <Badge variant="outline" className="surface-expense">
              por cancelar
            </Badge>
          )}
          {s.status === "trial" && (
            <Badge variant="outline" className="surface-alert">
              prueba
            </Badge>
          )}
        </div>
        <p className="text-sm tabular-nums text-z-sage-light/60">
          {formatCurrency(amount, currency)}
          {nextDate ? ` · próx. ${formatDate(nextDate)}` : ""}
        </p>
      </div>

      <div className="ml-3 flex shrink-0 gap-2">
        {s.status !== "marked_for_cancellation" && (
          <button
            disabled={pending}
            onClick={() => run(() => markForCancellation(s.id))}
            className={cn(ROW_ACTION_CLASS, GHOST_BUTTON_CLASS)}
          >
            Marcar
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => run(() => cancelSubscription(s.id))}
          className={cn(ROW_ACTION_CLASS, DESTRUCTIVE_GHOST_BUTTON_CLASS)}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
