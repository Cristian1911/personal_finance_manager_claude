"use client";

import { useRef, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  toggleReminder,
  deleteReminder,
  updateReminder,
} from "@/actions/reminders";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toISODateString } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState<string | null>(
    reminder.due_date ?? null
  );
  const formRef = useRef<HTMLFormElement>(null);
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

  function startEdit() {
    setEditDate(reminder.due_date ?? null);
    setEditing(true);
  }

  function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = await updateReminder(reminder.id, formData);
      if (result.success) {
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (editing) {
    return (
      <form
        ref={formRef}
        action={handleSave}
        className={cn(
          "rounded-lg border border-white/10 bg-card p-3 space-y-2",
          isPending && "opacity-50"
        )}
      >
        <Input
          name="title"
          defaultValue={reminder.title}
          placeholder="Titulo"
          required
          autoFocus
          className="h-8 bg-transparent border-white/6 text-sm"
          disabled={isPending}
        />
        <div className="flex items-center gap-2">
          <Input
            name="amount"
            type="number"
            defaultValue={reminder.amount ?? ""}
            placeholder="Monto"
            step="0.01"
            min="0"
            className="h-8 w-28 bg-transparent border-white/6 text-sm"
            disabled={isPending}
          />
          <DatePicker
            value={editDate}
            onChange={setEditDate}
            name="due_date"
            placeholder="Fecha"
            disabled={isPending}
            className="w-36"
          />
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-z-income hover:text-z-income"
              disabled={isPending}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setEditing(false)}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </form>
    );
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

      <div className="min-w-0 flex-1" onClick={compact ? undefined : startEdit}>
        <p
          className={cn(
            "truncate font-medium",
            compact ? "text-xs" : "text-sm cursor-pointer",
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
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
