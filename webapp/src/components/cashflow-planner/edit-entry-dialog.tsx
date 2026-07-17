"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { updatePlanningEntry } from "@/actions/cashflow-planner";
import { toast } from "sonner";
import type { Account, CategoryWithChildren, CurrencyCode } from "@/types/domain";
import type { PlanningEntryWithRelations } from "@/types/cashflow-planner";

interface EditEntryDialogProps {
  entry: PlanningEntryWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  accounts?: Pick<Account, "id" | "name" | "icon" | "color">[];
  categories?: CategoryWithChildren[];
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
  const [categoryId, setCategoryId] = useState<string | null>(
    entry?.category?.id ?? null
  );

  // Sync date/category when entry changes
  if (entry && expectedDate !== entry.expected_date && !open) {
    setExpectedDate(entry.expected_date);
  }
  if (entry && categoryId !== (entry.category?.id ?? null) && !open) {
    setCategoryId(entry.category?.id ?? null);
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
              <CurrencyInput
                id="edit-amount"
                name="amount"
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
              <CategoryZonePicker
                categories={categories}
                value={categoryId}
                onValueChange={setCategoryId}
                direction="OUTFLOW"
                variant="popover"
                name="category_id"
                placeholder="Seleccionar categoría"
                triggerClassName="w-full bg-card border-white/6"
              />
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
