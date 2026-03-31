"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { createReminder } from "@/actions/reminders";
import { toast } from "sonner";

interface ReminderQuickAddProps {
  showExtras?: boolean;
}

export function ReminderQuickAdd({ showExtras = false }: ReminderQuickAddProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dueDate, setDueDate] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createReminder(formData);
      if (result.success) {
        formRef.current?.reset();
        setDueDate(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex items-center gap-2">
      <Input
        name="title"
        placeholder="Nuevo recordatorio..."
        required
        className="h-9 flex-1 bg-card border-white/6 text-sm"
        disabled={isPending}
      />

      {showExtras && (
        <>
          <Input
            name="amount"
            type="number"
            placeholder="Monto"
            step="0.01"
            min="0"
            className="h-9 w-28 bg-card border-white/6 text-sm"
            disabled={isPending}
          />
          <DatePicker
            value={dueDate}
            onChange={setDueDate}
            name="due_date"
            placeholder="Fecha límite"
            disabled={isPending}
            className="w-36"
          />
        </>
      )}

      <Button
        type="submit"
        size="icon"
        variant="ghost"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
        disabled={isPending}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}
