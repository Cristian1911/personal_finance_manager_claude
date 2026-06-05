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
import {
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
} from "@/lib/constants/styles";
import { createPersonalDebt } from "@/actions/personal-debts";
import type { CurrencyCode } from "@/types/domain";

interface CreatePersonalDebtSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  /** When provided, called with the new debt id instead of toasting success —
   *  lets callers (e.g. "Vincular a deuda personal") link a transaction to it. */
  onCreated?: (debtId: string) => void;
  /** Prefill — used when creating from a transaction. */
  defaultDirection?: "borrowed" | "lent";
  defaultAmount?: number;
  defaultDestinatarioId?: string | null;
  defaultDestinatarioName?: string | null;
  /** yyyy-MM-dd — defaults to today. */
  defaultOpenedOn?: string;
}

export function CreatePersonalDebtSheet({
  open,
  onOpenChange,
  currency,
  onCreated,
  defaultDirection = "borrowed",
  defaultAmount,
  defaultDestinatarioId = null,
  defaultDestinatarioName = null,
  defaultOpenedOn,
}: CreatePersonalDebtSheetProps) {
  const router = useRouter();
  const today = format(new Date(), "yyyy-MM-dd");
  const initialOpenedOn = defaultOpenedOn ?? today;
  const [destinatarioId, setDestinatarioId] = useState<string | null>(defaultDestinatarioId);
  const [destinatarioName, setDestinatarioName] = useState<string | null>(defaultDestinatarioName);
  const [direction, setDirection] = useState<"borrowed" | "lent">(defaultDirection);
  const [openedOn, setOpenedOn] = useState(initialOpenedOn);
  const [dueDate, setDueDate] = useState<string>("");
  const [pending, startTransition] = useTransition();

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
        // Both callers mount this sheet conditionally, so it unmounts on close
        // and re-initializes from defaults on the next open — no manual reset.
        onOpenChange(false);
        if (onCreated) {
          // Caller (auto-link flow) runs its own server action + revalidation —
          // don't refresh here or the row renders before the link resolves.
          onCreated(res.data.id);
        } else {
          toast.success("Deuda creada");
          router.refresh();
        }
      } else {
        toast.error(res.error ?? "Error al crear la deuda");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("max-h-[90dvh] overflow-y-auto", MOBILE_SHEET_SAFE_AREA_CLASS)}
      >
        <div className="mx-auto w-full max-w-md px-5">
          <SheetHeader className="px-0 pt-1">
            <SheetTitle>Nueva deuda personal</SheetTitle>
          </SheetHeader>
          <form action={handleSubmit} className="space-y-4 pb-4 pt-2">
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
              // This sheet is a radix Dialog (modal); the picker's default mobile
              // vaul Drawer renders as a sibling portal that the modal's
              // pointer-events lock makes unreachable. A nested radix Dialog
              // stacks correctly inside the sheet.
              variant="dialog"
            />
          </div>

          <AmountInput name="principal_amount" currency={currency} defaultValue={defaultAmount} />

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
            {pending ? "Guardando..." : "Crear deuda"}
          </Button>
          </form>
        </div>
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
        active ? BRASS_GHOST_BUTTON_CLASS : GHOST_BUTTON_CLASS,
      )}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}
