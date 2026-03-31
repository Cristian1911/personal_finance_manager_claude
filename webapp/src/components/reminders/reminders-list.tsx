"use client";

import { ReminderItem } from "./reminder-item";
import { ReminderQuickAdd } from "./reminder-quick-add";
import type { FinancialReminder } from "@/types/domain";

interface RemindersListProps {
  pending: FinancialReminder[];
  completed: FinancialReminder[];
}

export function RemindersList({ pending, completed }: RemindersListProps) {
  return (
    <div className="space-y-6">
      <ReminderQuickAdd showExtras />

      {/* Pendientes */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground px-1">
          Pendientes ({pending.length})
        </h3>

        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground px-3 py-4">
            Sin pendientes. Agrega uno arriba.
          </p>
        ) : (
          <div className="space-y-1">
            {pending.map((r) => (
              <ReminderItem key={r.id} reminder={r} />
            ))}
          </div>
        )}
      </div>

      {/* Completados */}
      {completed.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground px-1">
            Completados ({completed.length})
          </h3>
          <div className="space-y-1">
            {completed.map((r) => (
              <ReminderItem key={r.id} reminder={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
