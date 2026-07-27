"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useRecurringMonth, type OccurrenceItem } from "./use-recurring-month";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RecurringSummaryBar } from "./recurring-summary-bar";
import { RecurringMiniCalendar } from "./recurring-mini-calendar";
import { PaymentTimeline } from "./recurring-payment-timeline";
import { RecurringCompletedSection } from "./recurring-completed-section";
import type { RecurringTemplateWithRelations, Account } from "@/types/domain";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RecurringTimelineViewProps {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RecurringTimelineView({
  templates,
  accounts,
}: RecurringTimelineViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Undo used to fire straight from the icon button. When the occurrence was
  // auto-matched to an imported transaction, that DELETED the bank record on a
  // single click — ask first, and offer keeping the movimiento.
  const [revertTarget, setRevertTarget] = useState<OccurrenceItem | null>(null);
  const hook = useRecurringMonth(templates, accounts);

  // Adapt goNextMonth/goPrevMonth to the calendar's (delta: number) => void
  const handleNavigate = (delta: number) => {
    if (delta > 0) hook.goNextMonth();
    else hook.goPrevMonth();
  };

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarClock className="size-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-1">Sin pagos recurrentes</p>
        <p className="text-sm text-muted-foreground mb-4">
          Registra tus pagos fijos como arriendo, servicios o suscripciones para no olvidar ninguno.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RecurringSummaryBar
        totalPlanned={hook.totalPlanned}
        pendingCount={hook.pending.length}
        completedCount={hook.completed.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Mini calendar sidebar */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <RecurringMiniCalendar
            monthCursor={hook.monthCursor}
            onNavigate={handleNavigate}
            monthLabel={hook.monthLabel}
            dateOccurrenceCounts={hook.dateOccurrenceCounts}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {/* Timeline + completed */}
        <div className="space-y-6">
          {!hook.isHydrated ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground animate-pulse">
                Verificando estado de pagos...
              </p>
            </div>
          ) : (
            <>
              <PaymentTimeline
                pendingByDate={hook.pendingByDate}
                getDateStatus={hook.getDateStatus}
                onConfirm={hook.confirmPayment}
                onSkip={hook.skipPayment}
                busyItems={hook.busyItems}
                selectedDate={selectedDate}
                sourceAccounts={accounts
                  .filter(
                    (a) =>
                      a.account_type === "CHECKING" ||
                      a.account_type === "SAVINGS"
                  )
                  .map((a) => ({ id: a.id, name: a.name }))}
              />
              <RecurringCompletedSection
                completed={hook.completed}
                onRevert={setRevertTarget}
              />
            </>
          )}
        </div>
      </div>

      <AlertDialog
        open={revertTarget !== null}
        onOpenChange={(open) => !open && setRevertTarget(null)}
      >
        {/* No size="sm": that footer variant is a fixed 2-column grid, which
            strands the third button on its own row. */}
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer este pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {revertTarget?.merchant ?? "Este pago"} volverá a quedar pendiente en Plan. Si el
              movimiento se creó al registrar el pago, eliminarlo también revierte su efecto en
              el saldo; si venía de tu banco, conviene conservarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (revertTarget) hook.revertPayment(revertTarget, { keepTransaction: true });
                setRevertTarget(null);
              }}
            >
              Mantener movimiento
            </AlertDialogAction>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                if (revertTarget) hook.revertPayment(revertTarget);
                setRevertTarget(null);
              }}
            >
              Eliminar movimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
