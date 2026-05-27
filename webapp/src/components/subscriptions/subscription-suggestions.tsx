"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { confirmSubscription, dismissSubscription } from "@/actions/subscriptions";
import type { SubscriptionWithDetails, CurrencyCode } from "@/types/domain";

interface SubscriptionSuggestionsProps {
  suggestions: SubscriptionWithDetails[];
  currency: CurrencyCode;
}

const ROW_ACTION_CLASS =
  "rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-50";

const MUTED_GHOST_CLASS =
  "border-white/6 bg-black/10 text-z-sage-light/50 hover:bg-white/5 hover:text-z-sage-light/70";

export function SubscriptionSuggestions({
  suggestions,
  currency,
}: SubscriptionSuggestionsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (suggestions.length === 0) return null;

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-z-sage-light/50">
        Sugerencias
      </p>
      {suggestions.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-xl border border-white/6 bg-z-surface-2 px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <span className="font-medium text-z-sage-light">{s.destinatario_name}</span>
            <p className="text-sm tabular-nums text-z-sage-light/60">
              {formatCurrency(s.estimated_amount ?? 0, currency)}
              {" · "}
              <span className="text-z-sage-light/40">Parece una suscripción</span>
            </p>
          </div>

          <div className="ml-3 flex shrink-0 gap-2">
            <button
              disabled={pending}
              onClick={() => run(() => confirmSubscription(s.id))}
              className={cn(ROW_ACTION_CLASS, GHOST_BUTTON_CLASS)}
            >
              Rastrear
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => dismissSubscription(s.id))}
              className={cn(ROW_ACTION_CLASS, MUTED_GHOST_CLASS)}
            >
              Descartar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
