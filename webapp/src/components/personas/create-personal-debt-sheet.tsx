"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/ui/amount-input";
import { DatePicker } from "@/components/ui/date-picker";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import { createPersonalDebt } from "@/actions/personal-debts";
import type { CurrencyCode } from "@/types/domain";

interface CreatePersonalDebtSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
}

export function CreatePersonalDebtSheet({
  open,
  onOpenChange,
  currency,
}: CreatePersonalDebtSheetProps) {
  const router = useRouter();
  const today = format(new Date(), "yyyy-MM-dd");
  const [destinatarioId, setDestinatarioId] = useState<string | null>(null);
  const [destinatarioName, setDestinatarioName] = useState<string | null>(null);
  const [direction, setDirection] = useState<"borrowed" | "lent">("borrowed");
  const [openedOn, setOpenedOn] = useState(today);
  const [dueDate, setDueDate] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setDestinatarioId(null);
    setDestinatarioName(null);
    setDirection("borrowed");
    setOpenedOn(today);
    setDueDate("");
  }

  function handleSubmit(formData: FormData) {
    if (!destinatarioId) {
      toast.error("Elige una persona");
      return;
    }
    formData.set("destinatario_id", destinatarioId);
    formData.set("direction", direction);
    formData.set("currency_code", currency);
    formData.set("opened_on", openedOn);
    formData.set("due_date", dueDate);
    startTransition(async () => {
      const res = await createPersonalDebt(undefined, formData);
      if (res.success) {
        toast.success("Cuenta creada");
        reset();
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al crear la cuenta");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("max-h-[90dvh] overflow-y-auto", MOBILE_SHEET_SAFE_AREA_CLASS)}
      >
        <SheetHeader>
          <SheetTitle>Nueva cuenta con persona</SheetTitle>
        </SheetHeader>
        <form action={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <DirectionButton
              active={direction === "borrowed"}
              onClick={() => setDirection("borrowed")}
              label="Debo"
              hint="Pedí prestado"
            />
            <DirectionButton
              active={direction === "lent"}
              onClick={() => setDirection("lent")}
              label="Me deben"
              hint="Yo presté"
            />
          </div>

          <div className="space-y-2">
            <Label>Persona</Label>
            <DestinatarioZonePicker
              value={destinatarioId}
              onValueChange={(id, name) => {
                setDestinatarioId(id);
                setDestinatarioName(name);
              }}
              selectedName={destinatarioName}
              placeholder="Elegir o crear persona"
              triggerClassName="w-full"
              kindFilter={["person"]}
              createKind="person"
            />
          </div>

          <AmountInput name="principal_amount" currency={currency} />

          <div className="space-y-2">
            <Label>Fecha de apertura</Label>
            <DatePicker value={openedOn} onChange={(v) => setOpenedOn(v ?? today)} />
          </div>

          <div className="space-y-2">
            <Label>Fecha de vencimiento (opcional)</Label>
            <DatePicker
              value={dueDate || undefined}
              onChange={(v) => setDueDate(v ?? "")}
              placeholder="Sin fecha"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="debt-notes">Notas (opcional)</Label>
            <Input id="debt-notes" name="notes" placeholder="Detalle" />
          </div>

          <Button type="submit" className={cn(BRASS_BUTTON_CLASS, "w-full")} disabled={pending}>
            {pending ? "Guardando..." : "Crear cuenta"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DirectionButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-left transition-colors",
        active ? "border-z-brass/40 bg-z-brass/10" : "border-white/6 bg-z-surface-2",
      )}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}
