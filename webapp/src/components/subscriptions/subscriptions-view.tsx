"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { SubscriptionRow } from "./subscription-row";
import { SubscriptionSuggestions } from "./subscription-suggestions";
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

  const suggested = subscriptions.filter((s) => s.status === "suggested");
  const tracked = subscriptions.filter((s) => s.status !== "suggested");

  // Monthly cost of subscriptions marked for cancellation — occurrence-backed
  // when a template exists, estimated otherwise. Powers the "ahorro" judgment line.
  const monthlyByTemplate = new Map<string, number>();
  for (const o of occurrences) {
    if (o.direction === "OUTFLOW") {
      monthlyByTemplate.set(
        o.template_id,
        (monthlyByTemplate.get(o.template_id) ?? 0) + o.expected_amount,
      );
    }
  }
  const markedMonthly = tracked
    .filter((s) => s.status === "marked_for_cancellation")
    .reduce(
      (sum, s) =>
        sum +
        (s.recurring_template_id
          ? (monthlyByTemplate.get(s.recurring_template_id) ?? 0)
          : (s.estimated_amount ?? 0)),
      0,
    );

  const totalMonthly = authoritativeMonthly + estimatedMonthly;

  return (
    <div className="space-y-4">
      <div className={cn(PANEL_SURFACE_CLASS, "p-5")}>
        <p className="text-sm text-z-sage-light/70">Gasto fijo en suscripciones</p>
        <p className="text-2xl font-semibold tabular-nums text-z-sage-light lg:text-3xl">
          {tracked.length} {tracked.length === 1 ? "activa" : "activas"} ·{" "}
          {formatCurrency(totalMonthly, currency)}/mes
        </p>
        <p className="text-sm tabular-nums text-z-sage-light/60">
          {formatCurrency(totalMonthly * 12, currency)} al año
        </p>
        {markedMonthly > 0 && (
          <p className="mt-1 text-xs tabular-nums text-z-income">
            Cancelar las marcadas ahorra {formatCurrency(markedMonthly, currency)}/mes
          </p>
        )}
        {estimatedMonthly > 0 && (
          <p className="mt-1 text-xs tabular-nums text-z-sage-light/50">
            Incluye {formatCurrency(estimatedMonthly, currency)}/mes estimado (sin programar)
          </p>
        )}
      </div>

      {suggested.length > 0 && (
        <SubscriptionSuggestions suggestions={suggested} currency={currency} />
      )}

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
          <div className="space-y-1 py-8 text-center">
            <p className="text-sm text-z-sage-light/60">
              No tienes suscripciones registradas todavía.
            </p>
            <p className="text-xs text-z-sage-light/50">
              Marca una plantilla como suscripción en{" "}
              <Link
                href="/plan?tab=recurrentes"
                className="text-z-brass underline-offset-2 hover:underline"
              >
                Recurrentes
              </Link>{" "}
              o importa extractos para detectarlas automáticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
