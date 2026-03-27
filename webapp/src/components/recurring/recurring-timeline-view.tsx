"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useRecurringMonth } from "./use-recurring-month";
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
          <RecurringCompletedSection completed={hook.completed} />
        </div>
      </div>
    </div>
  );
}
