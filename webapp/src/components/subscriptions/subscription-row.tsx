"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cancelSubscription, markForCancellation } from "@/actions/subscriptions";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
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
  const router = useRouter();
  const [pending, start] = useTransition();

  const amount = s.template_amount ?? s.estimated_amount ?? 0;

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/6 bg-z-surface-2 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-z-sage-light">{s.destinatario_name}</span>
          {!s.recurring_template_id && (
            <Badge variant="outline">estimado</Badge>
          )}
          {s.status === "marked_for_cancellation" && (
            <Badge variant="outline">por cancelar</Badge>
          )}
          {s.status === "trial" && (
            <Badge variant="outline">prueba</Badge>
          )}
        </div>
        <p className="text-sm text-z-sage-light/60">
          {formatCurrency(amount, currency)}
          {nextDate ? ` · próx. ${formatDate(nextDate)}` : ""}
        </p>
      </div>

      <div className="ml-3 flex shrink-0 gap-3">
        {s.status !== "marked_for_cancellation" && (
          <button
            disabled={pending}
            onClick={() => run(() => markForCancellation(s.id))}
            className="text-xs text-z-sage-light/70 hover:text-z-sage-light disabled:opacity-50"
          >
            Marcar
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => run(() => cancelSubscription(s.id))}
          className="text-xs text-z-expense hover:underline disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
