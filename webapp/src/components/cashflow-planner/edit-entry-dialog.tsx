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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePlanningEntry } from "@/actions/cashflow-planner";
import { toast } from "sonner";
import type { Account, Category, CurrencyCode } from "@/types/domain";
import type { PlanningEntryWithRelations } from "@/types/cashflow-planner";

interface EditEntryDialogProps {
  entry: PlanningEntryWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  accounts?: Pick<Account, "id" | "name" | "icon" | "color">[];
  categories?: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
}

export function EditEntryDialog({
  entry,
  open,
  onOpenChange,
  currency,
  accounts = [],
  categories = [],
}: EditEntryDialogProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [expectedDate, setExpectedDate] = useState<string | null>(
    entry?.expected_date ?? null
  );

  // Sync date when entry changes
  if (entry && expectedDate !== entry.expected_date && !open) {
    setExpectedDate(entry.expected_date);
  }

  if (!entry) return null;

  function handleSubmit(formData: FormData) {
    if (!entry) return;
    startTransition(async () => {
      formData.set("period_id", entry.period_id);
      formData.set("entry_type", entry.entry_type);
      formData.set("currency_code", entry.currency_code ?? currency);
      if (expectedDate) formData.set("expected_date", expectedDate);

      const amountStr = formData.get("amount") as string;
      formData.set("amount", String(Number(amountStr)));

      const result = await updatePlanningEntry(entry.id, null, formData);
      if (result.success) {
        toast.success("Actualizado");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const isExpense = entry.entry_type === "EXPENSE";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Editar {isExpense ? "gasto" : "ingreso"}
          </DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-label">Nombre</Label>
            <Input
              id="edit-label"
              name="label"
              defaultValue={entry.label}
              required
              className="bg-card border-white/6"
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Monto</Label>
              <Input
                id="edit-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={Number(entry.amount)}
                required
                className="bg-card border-white/6"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha esperada</Label>
              <DatePicker
                value={expectedDate}
                onChange={setExpectedDate}
                name="expected_date"
                disabled={isPending}
              />
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Cuenta (opcional)</Label>
              <Select name="account_id" defaultValue={entry.account?.id ?? ""}>
                <SelectTrigger className="bg-card border-white/6">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isExpense && categories.length > 0 && (
            <div className="space-y-2">
              <Label>Categoría (opcional)</Label>
              <Select name="category_id" defaultValue={entry.category?.id ?? ""}>
                <SelectTrigger className="bg-card border-white/6">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name_es || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
