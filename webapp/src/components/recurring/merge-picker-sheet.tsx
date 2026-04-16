"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { frequencyLabel } from "@zeta/shared";
import { BRASS_BUTTON_CLASS, MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import {
  getMergeablTemplates,
  mergeRecurringTemplates,
} from "@/actions/recurring-templates";
import { toast } from "sonner";
import type { CurrencyCode, RecurringTemplateWithRelations } from "@/types/domain";

interface MergePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The template that will keep its identity (absorbs the picked one) */
  sourceTemplate: RecurringTemplateWithRelations;
  onMerged: () => void;
}

export function MergePickerSheet({
  open,
  onOpenChange,
  sourceTemplate,
  onMerged,
}: MergePickerSheetProps) {
  const [candidates, setCandidates] = useState<RecurringTemplateWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    getMergeablTemplates(sourceTemplate.id).then((res) => {
      if (res.success) setCandidates(res.data);
      setIsLoading(false);
    });
  }, [open, sourceTemplate.id]);

  function handleMerge(absorbId: string) {
    startTransition(async () => {
      const result = await mergeRecurringTemplates(sourceTemplate.id, absorbId);
      if (result.success) {
        toast.success("Plantillas combinadas");
        onOpenChange(false);
        onMerged();
      } else {
        toast.error(result.error ?? "Error al combinar");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("max-h-[70vh]", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
        <SheetHeader>
          <SheetTitle>Combinar con otra recurrente</SheetTitle>
        </SheetHeader>

        <p className="mt-1 text-xs text-muted-foreground">
          Selecciona la plantilla que quieres absorber en{" "}
          <span className="font-semibold text-foreground">
            {sourceTemplate.merchant_name}
          </span>
          . Sus pagos pendientes se moverán aquí y la otra plantilla se eliminará.
        </p>

        <div className="mt-4 space-y-2 overflow-y-auto">
          {isLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
              Buscando plantillas compatibles...
            </div>
          )}

          {!isLoading && candidates.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay otras plantillas de la misma cuenta para combinar.
            </div>
          )}

          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              disabled={isPending}
              onClick={() => handleMerge(candidate.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-white/6 bg-white/[0.03] px-3 py-3 text-left transition-colors active:bg-white/[0.06]",
                isPending && "opacity-50 pointer-events-none",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {candidate.merchant_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {candidate.account?.name} · {frequencyLabel(candidate.frequency)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCurrency(candidate.amount, candidate.currency_code as CurrencyCode)}
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
