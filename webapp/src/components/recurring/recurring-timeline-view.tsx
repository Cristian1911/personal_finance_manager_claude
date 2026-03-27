"use client";

import { useState } from "react";
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
