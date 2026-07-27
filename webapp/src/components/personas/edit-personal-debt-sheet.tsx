"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/ui/amount-input";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import { updatePersonalDebt } from "@/actions/personal-debts";
import type { PersonalDebtWithDetails, CurrencyCode } from "@/types/domain";

interface EditPersonalDebtSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: PersonalDebtWithDetails;
  currency: CurrencyCode;
}

/**
 * Correct a personal debt's amount, due date or notes. Without it the only way
 * to fix a wrong principal was deleting the debt — which also threw away its
 * repayment history.
 *
 * The person and the direction are intentionally not editable: both are baked
 * into every linked transaction's pd_role. Changing them means a new debt.
 */
export function EditPersonalDebtSheet({
  open,
  onOpenChange,
  debt,
  currency,
}: EditPersonalDebtSheetProps) {
  const router = useRouter();
  const code = (debt.currency_code ?? currency) as CurrencyCode;
  const [dueDate, setDueDate] = useState<string>(debt.due_date ?? "");
  const [pending, startTransition] = useTransition();

  // A shared payment's shares must add up to the origin transaction's amount,
  // so this participant's principal is owned by that split, not by this form.
  const isSharedPayment = !!debt.split_group_id;

  function handleSubmit(formData: FormData) {
    if (isSharedPayment) formData.delete("principal_amount");
    formData.set("due_date", dueDate);
    startTransition(async () => {
      const res = await updatePersonalDebt(debt.id, formData);
      if (res.success) {
        onOpenChange(false);
        toast.success("Deuda actualizada");
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al actualizar la deuda");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("max-h-[90dvh] overflow-y-auto", MOBILE_SHEET_SAFE_AREA_CLASS)}
      >
        <div className="mx-auto w-full max-w-md px-7">
          <SheetHeader className="px-0 pt-1">
            <SheetTitle>Editar deuda · {debt.destinatario_name}</SheetTitle>
          </SheetHeader>
          <form action={handleSubmit} className="space-y-4 pb-4 pt-2">
            {isSharedPayment ? (
              <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Esta deuda es la parte de un pago compartido, así que su monto se calcula
                  desde el gasto repartido y no se edita aquí.
                </p>
              </div>
            ) : (
              <AmountInput
                name="principal_amount"
                currency={code}
                defaultValue={debt.principal_amount}
              />
            )}

            <div className="space-y-2">
              <Label>Vencimiento</Label>
              <DatePicker
                value={dueDate || undefined}
                onChange={(v) => setDueDate(v ?? "")}
                placeholder="Sin fecha"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-debt-notes">Notas (opcional)</Label>
              <Input
                id="edit-debt-notes"
                name="notes"
                placeholder="Detalle"
                defaultValue={debt.notes ?? ""}
              />
            </div>

            <Button type="submit" className={cn(BRASS_BUTTON_CLASS, "w-full")} disabled={pending}>
              {pending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
