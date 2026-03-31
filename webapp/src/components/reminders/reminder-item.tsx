"use client";

import { useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toggleReminder, deleteReminder } from "@/actions/reminders";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toISODateString } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { FinancialReminder, CurrencyCode } from "@/types/domain";

interface ReminderItemProps {
  reminder: FinancialReminder;
  compact?: boolean;
}

function isOverdue(reminder: FinancialReminder): boolean {
  if (!reminder.due_date || reminder.is_completed) return false;
  const today = toISODateString(new Date());
  return reminder.due_date < today;
}

export function ReminderItem({ reminder, compact = false }: ReminderItemProps) {
  const [isPending, startTransition] = useTransition();
  const overdue = isOverdue(reminder);

  function handleToggle() {
    startTransition(async () => {
      await toggleReminder(reminder.id);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteReminder(reminder.id);
    });
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        overdue && "border border-z-debt/30 bg-z-debt/5",
        isPending && "opacity-50"
      )}
    >
      <Checkbox
        checked={reminder.is_completed}
        onCheckedChange={handleToggle}
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium",
            compact ? "text-xs" : "text-sm",
            reminder.is_completed && "line-through text-muted-foreground"
          )}
        >
          {reminder.title}
        </p>

        {!compact && (
          <div className="flex items-center gap-2 mt-0.5">
            {reminder.amount != null && (
              <span className="text-xs text-muted-foreground">
                {formatCurrency(
                  reminder.amount,
                  (reminder.currency_code ?? "COP") as CurrencyCode
                )}
              </span>
            )}
            {reminder.due_date && (
              <span
                className={cn(
                  "text-xs",
                  overdue ? "text-z-debt font-medium" : "text-muted-foreground"
                )}
              >
                {formatDate(reminder.due_date, "dd MMM")}
              </span>
            )}
          </div>
        )}
      </div>

      {!compact && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
