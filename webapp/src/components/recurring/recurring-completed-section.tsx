"use client";

import { CheckCircle2, ExternalLink, SkipForward, Undo2, Pencil, ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { OccurrenceItem } from "./use-recurring-month";
import type { CurrencyCode } from "@/types/domain";

interface RecurringCompletedSectionProps {
  completed: OccurrenceItem[];
  onRevert?: (item: OccurrenceItem) => void;
}

const ICON_BUTTON_CLASS =
  "rounded-md p-1.5 text-z-sage-dark transition-colors hover:bg-white/5 hover:text-z-white";

export function RecurringCompletedSection({
  completed,
  onRevert,
}: RecurringCompletedSectionProps) {
  if (completed.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-z-income/20 bg-z-income/8 px-3 py-2.5 text-sm font-medium text-z-income transition-colors hover:bg-z-income/12">
        <CheckCircle2 className="size-4" />
        {/* "Resueltos", not "pagados" — this list mixes paid and skipped. */}
        <span>
          {completed.length}{" "}
          {completed.length === 1 ? "pago resuelto" : "pagos resueltos"}{" "}
          este mes
        </span>
        <ChevronDown className="size-4 ml-auto transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className={cn(PANEL_INSET_CLASS, "mt-1 divide-y divide-white/6")}>
          {completed.map((item) => (
            <div key={item.key} className="flex items-center gap-2 px-3 py-2">
              {item.status === "paid" ? (
                <CheckCircle2 className="size-4 shrink-0 text-z-income" />
              ) : (
                <SkipForward className="size-4 shrink-0 text-z-alert" />
              )}

              <div className="min-w-0 flex-1">
                <span className="truncate text-sm font-medium text-z-white">
                  {item.merchant}
                </span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {formatDate(item.date, "d MMM")}
                  {item.status === "skipped" && " · Omitido"}
                </span>
              </div>

              <span className="shrink-0 text-sm font-medium tabular-nums text-z-white">
                {formatCurrency(
                  item.plannedAmount,
                  item.currencyCode as CurrencyCode,
                )}
              </span>

              <div className="flex shrink-0 items-center gap-1 ml-1">
                {item.transactionId && (
                  <Link
                    href={`/transactions/${item.transactionId}`}
                    className={ICON_BUTTON_CLASS}
                    title="Ver transacción"
                    aria-label={`Ver transacción de ${item.merchant}`}
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                )}
                <Link
                  href={`/recurrentes/${item.templateId}/edit`}
                  className={ICON_BUTTON_CLASS}
                  title="Editar plantilla"
                  aria-label={`Editar plantilla ${item.merchant}`}
                >
                  <Pencil className="size-3.5" />
                </Link>
                {onRevert && (
                  <button
                    type="button"
                    onClick={() => onRevert(item)}
                    className={ICON_BUTTON_CLASS}
                    title="Deshacer — volver a pendiente"
                    aria-label={`Deshacer ${item.merchant}`}
                  >
                    <Undo2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
