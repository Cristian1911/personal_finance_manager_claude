"use client";

import { formatCurrency } from "@/lib/utils/currency";
import {
  MOBILE_TAB_BAR_CLEARANCE_CLASS,
  PANEL_SURFACE_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { SubscriptionRow } from "./subscription-row";
import type { SubscriptionWithDetails, CurrencyCode } from "@/types/domain";
import type { RecurringOccurrence } from "@/actions/occurrences";

interface SubscriptionsViewProps {
  subscriptions: SubscriptionWithDetails[];
  occurrences: RecurringOccurrence[];
  authoritativeMonthly: number;
  estimatedMonthly: number;
  currency: CurrencyCode;
}

export function SubscriptionsView({
  subscriptions,
  occurrences,
  authoritativeMonthly,
  estimatedMonthly,
  currency,
}: SubscriptionsViewProps) {
  const nextByTemplate = new Map<string, string>();
  for (const o of occurrences) {
    if (o.status === "pending" && !nextByTemplate.has(o.template_id)) {
      nextByTemplate.set(o.template_id, o.occurrence_date);
    }
  }

  const tracked = subscriptions.filter((s) => s.status !== "suggested");

  return (
    <div className={`space-y-4 ${MOBILE_TAB_BAR_CLEARANCE_CLASS}`}>
      <div className={cn(PANEL_SURFACE_CLASS, "p-5")}>
        <p className="text-sm text-z-sage-light/70">Gasto mensual en suscripciones</p>
        <p className="text-3xl font-semibold tabular-nums text-z-sage-light">
          {formatCurrency(authoritativeMonthly, currency)}
        </p>
        <p className="text-sm tabular-nums text-z-sage-light/60">
          {formatCurrency(authoritativeMonthly * 12, currency)} al año
        </p>
        {estimatedMonthly > 0 && (
          <p className="mt-1 text-xs tabular-nums text-z-sage-light/50">
            + {formatCurrency(estimatedMonthly, currency)}/mes estimado (sin programar)
          </p>
        )}
      </div>

      <div className="space-y-2">
        {tracked.map((s) => (
          <SubscriptionRow
            key={s.id}
            subscription={s}
            currency={currency}
            nextDate={
              s.recurring_template_id
                ? (nextByTemplate.get(s.recurring_template_id) ?? null)
                : null
            }
          />
        ))}
        {tracked.length === 0 && (
          <p className="py-8 text-center text-sm text-z-sage-light/60">
            No tienes suscripciones registradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}
