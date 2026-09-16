"use client";

import { startTransition, useState, type ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import type { RecurringCandidate } from "@zeta/shared";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { dismissDiscovery } from "@/actions/guided-experience";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GHOST_BUTTON_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { recurringDiscoveryId } from "@/lib/recurring/discovery-id";
import type { CurrencyCode } from "@/types/domain";

type Props = {
  candidate: RecurringCandidate;
  /** The transaction being viewed; its own date is left out of the copy. */
  transactionId: string;
  currency: CurrencyCode;
  /** The "Programar" action — the caller owns the promote dialog. */
  children: ReactNode;
};

/**
 * "Parece recurrente" — the week-1 discovery, inline on the transaction it
 * was detected from. States only what the data shows (the other dates and
 * the amount); the conclusion stays a "parece".
 */
export function RecurringCandidateCallout({ candidate, transactionId, currency, children }: Props) {
  const [hidden, setHidden] = useState(false);

  const otherDates = candidate.dates
    .filter((_, i) => candidate.transaction_ids[i] !== transactionId)
    .slice(-2)
    .reverse();
  if (hidden || otherDates.length === 0) return null;

  const allSameAmount = new Set(candidate.amounts).size === 1;
  const amountText = allSameAmount
    ? formatCurrency(candidate.amounts[0], currency)
    : `cerca de ${formatCurrency(candidate.median_amount, currency)}`;
  const datesText = otherDates.map((d) => `el ${formatDate(d, "d 'de' MMMM")}`).join(" y ");

  function handleDismiss() {
    setHidden(true);
    startTransition(async () => {
      const result = await dismissDiscovery(recurringDiscoveryId(candidate));
      if (!result.success) {
        setHidden(false);
        toast.error(result.error ?? "No se pudo guardar");
      }
    });
  }

  return (
    <section className="px-4 pt-5">
      <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-z-brass/8 px-3.5 py-3")}>
        <Badge variant="outline" className="border-z-brass/30 bg-z-brass/12 text-z-brass">
          <CalendarClock aria-hidden="true" />
          Parece recurrente
        </Badge>
        <p className="mt-2 text-[13px] leading-relaxed text-z-sage-light">
          También se cobró {datesText} por <span className="tabular-nums">{amountText}</span>. Si
          lo programas, Zeta lo espera cada mes y te avisa antes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {children}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(GHOST_BUTTON_CLASS, "text-xs")}
            onClick={handleDismiss}
          >
            No es recurrente
          </Button>
        </div>
      </div>
    </section>
  );
}
