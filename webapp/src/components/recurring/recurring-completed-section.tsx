"use client";

import { CheckCircle2, ExternalLink, SkipForward, Undo2, Pencil } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { OccurrenceItem } from "./use-recurring-month";
import type { CurrencyCode } from "@/types/domain";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RecurringCompletedSectionProps {
  completed: OccurrenceItem[];
  onRevert?: (item: OccurrenceItem) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RecurringCompletedSection({
  completed,
  onRevert,
}: RecurringCompletedSectionProps) {
  if (completed.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50">
        <CheckCircle2 className="size-4" />
        <span>
          {completed.length}{" "}
          {completed.length === 1 ? "pago completado" : "pagos completados"}{" "}
          este mes
        </span>
        <ChevronDown className="size-4 ml-auto transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 divide-y divide-green-200/50 rounded-lg border border-green-200/50 bg-green-50/50 dark:divide-green-900/30 dark:border-green-900/30 dark:bg-green-950/20">
          {completed.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-2 px-3 py-2"
            >
              {item.status === "paid" ? (
                <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-500" />
              ) : (
                <SkipForward className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
              )}

              <div className="min-w-0 flex-1">
                <span className="truncate text-sm font-medium text-green-800 dark:text-green-300">
                  {item.merchant}
                </span>
                <span className="ml-1.5 text-xs text-green-600/70 dark:text-green-500/70">
                  {formatDate(item.date, "d MMM")}
                  {item.status === "skipped" && " · Omitido"}
                </span>
              </div>

              <span className="shrink-0 text-sm font-medium tabular-nums text-green-700 dark:text-green-400">
                {formatCurrency(
                  item.plannedAmount,
                  item.currencyCode as CurrencyCode
                )}
              </span>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1 ml-1">
                {item.transactionId && (
                  <Link
                    href={`/transactions/${item.transactionId}`}
                    className="rounded-md p-1.5 text-green-600/70 transition-colors hover:bg-green-200/50 hover:text-green-800 dark:text-green-500/70 dark:hover:bg-green-900/40 dark:hover:text-green-300"
                    title="Ver transacción"
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                )}
                <Link
                  href={`/recurrentes/${item.templateId}/edit`}
                  className="rounded-md p-1.5 text-green-600/70 transition-colors hover:bg-green-200/50 hover:text-green-800 dark:text-green-500/70 dark:hover:bg-green-900/40 dark:hover:text-green-300"
                  title="Editar plantilla"
                >
                  <Pencil className="size-3.5" />
                </Link>
                {onRevert && (
                  <button
                    type="button"
                    onClick={() => onRevert(item)}
                    className="rounded-md p-1.5 text-green-600/70 transition-colors hover:bg-green-200/50 hover:text-green-800 dark:text-green-500/70 dark:hover:bg-green-900/40 dark:hover:text-green-300"
                    title="Deshacer — volver a pendiente"
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
