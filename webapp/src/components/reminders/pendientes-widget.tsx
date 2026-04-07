"use client";

import { useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReminderItem } from "./reminder-item";
import { ReminderQuickAdd } from "./reminder-quick-add";
import { cn } from "@/lib/utils";
import type { FinancialReminder } from "@/types/domain";

interface PendientesWidgetProps {
  reminders: FinancialReminder[];
  completedReminders?: FinancialReminder[];
}

export function PendientesWidget({ reminders, completedReminders = [] }: PendientesWidgetProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-z-sage-dark" />
          <CardTitle className="text-sm font-semibold">Pendientes</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">
          {reminders.length} pendiente{reminders.length !== 1 ? "s" : ""}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {reminders.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Sin pendientes. Agrega uno arriba.
          </p>
        ) : (
          <div className="space-y-1">
            {reminders.map((r) => (
              <ReminderItem key={r.id} reminder={r} compact />
            ))}
          </div>
        )}
        <ReminderQuickAdd />

        {completedReminders.length > 0 && (
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex w-full items-center justify-between rounded-lg border border-white/6 bg-black/10 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/5"
          >
            <span>Completados ({completedReminders.length})</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform", showCompleted && "rotate-180")} />
          </button>
        )}

        {showCompleted && completedReminders.length > 0 && (
          <div className="space-y-1 opacity-60">
            {completedReminders.map((r) => (
              <ReminderItem key={r.id} reminder={r} compact />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
