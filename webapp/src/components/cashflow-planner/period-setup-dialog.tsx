"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarPlus } from "lucide-react";
import { createPlanningPeriod, seedPeriodFromRecurring } from "@/actions/cashflow-planner";
import { toast } from "sonner";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { PlanningPeriodPreset } from "@/types/domain";
import type { CurrencyCode } from "@/types/domain";

interface PeriodSetupDialogProps {
  currency: CurrencyCode;
  trigger?: React.ReactNode;
  suggestedStartDate?: string;
}

const PRESETS: { label: string; value: PlanningPeriodPreset; days: number }[] = [
  { label: "Semanal", value: "WEEKLY", days: 7 },
  { label: "Quincenal", value: "BIWEEKLY", days: 15 },
  { label: "Mensual", value: "MONTHLY", days: 0 },
  { label: "Personalizado", value: "CUSTOM", days: 0 },
];

function getPresetDates(preset: PlanningPeriodPreset, baseDate?: string) {
  const base = baseDate ? new Date(baseDate + "T12:00:00") : new Date();
  const start = base.toISOString().split("T")[0];

  if (preset === "WEEKLY") {
    const end = new Date(base);
    end.setDate(end.getDate() + 6);
    return { start, end: end.toISOString().split("T")[0] };
  }
  if (preset === "BIWEEKLY") {
    const end = new Date(base);
    end.setDate(end.getDate() + 14);
    return { start, end: end.toISOString().split("T")[0] };
  }
  if (preset === "MONTHLY") {
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      start: new Date(base.getFullYear(), base.getMonth(), 1)
        .toISOString()
        .split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  }
  return { start, end: start };
}

export function PeriodSetupDialog({
  currency,
  trigger,
  suggestedStartDate,
}: PeriodSetupDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [preset, setPreset] = useState<PlanningPeriodPreset>("MONTHLY");
  const [startDate, setStartDate] = useState<string | null>(
    suggestedStartDate ?? getPresetDates("MONTHLY").start
  );
  const [endDate, setEndDate] = useState<string | null>(
    getPresetDates("MONTHLY", suggestedStartDate).end
  );
  const [seedFromRecurring, setSeedFromRecurring] = useState(true);

  function handlePresetChange(newPreset: PlanningPeriodPreset) {
    setPreset(newPreset);
    if (newPreset !== "CUSTOM") {
      const dates = getPresetDates(newPreset, suggestedStartDate);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      formData.set("preset", preset);
      if (startDate) formData.set("start_date", startDate);
      if (endDate) formData.set("end_date", endDate);
      formData.set("currency_code", currency);

      const result = await createPlanningPeriod(null, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (seedFromRecurring) {
        const seedResult = await seedPeriodFromRecurring(result.data.id);
        if (seedResult.success && seedResult.data.created > 0) {
          toast.success(
            `Periodo creado con ${seedResult.data.created} ${seedResult.data.created === 1 ? "entrada" : "entradas"} desde tus recurrentes`
          );
        } else {
          toast.success("Periodo creado");
        }
      } else {
        toast.success("Periodo creado");
      }

      setOpen(false);
      formRef.current?.reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className={BRASS_BUTTON_CLASS}>
            <CalendarPlus className="mr-2 h-4 w-4" />
            Nuevo periodo
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Planear nuevo periodo</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de periodo</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePresetChange(p.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    preset === p.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-white/10 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="period-name">Nombre (opcional)</Label>
            <Input
              id="period-name"
              name="name"
              placeholder="Ej: Abril 2026"
              className="bg-card border-white/6"
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Inicio</Label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                name="start_date"
                disabled={isPending || preset !== "CUSTOM"}
              />
            </div>
            <div className="space-y-2">
              <Label>Fin</Label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                name="end_date"
                disabled={isPending || preset !== "CUSTOM"}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="seed-recurring"
              checked={seedFromRecurring}
              onCheckedChange={(checked) =>
                setSeedFromRecurring(checked === true)
              }
            />
            <Label htmlFor="seed-recurring" className="text-sm text-muted-foreground">
              Poblar con pagos e ingresos recurrentes
            </Label>
          </div>

          <Button
            type="submit"
            className={`w-full ${BRASS_BUTTON_CLASS}`}
            disabled={isPending}
          >
            {isPending ? "Creando..." : "Crear periodo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
