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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createPlanningEntry } from "@/actions/cashflow-planner";
import { toast } from "sonner";
import type { PlanningEntryType, Account, Category } from "@/types/domain";

interface EntryFormDialogProps {
  periodId: string;
  defaultType?: PlanningEntryType;
  accounts?: Pick<Account, "id" | "name" | "icon" | "color">[];
  categories?: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
  trigger?: React.ReactNode;
}

export function EntryFormDialog({
  periodId,
  defaultType = "EXPENSE",
  accounts = [],
  categories = [],
  trigger,
}: EntryFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [entryType, setEntryType] = useState<PlanningEntryType>(defaultType);
  const [expectedDate, setExpectedDate] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      formData.set("period_id", periodId);
      formData.set("entry_type", entryType);
      if (expectedDate) formData.set("expected_date", expectedDate);

      const amountStr = formData.get("amount") as string;
      formData.set("amount", String(Number(amountStr)));

      const result = await createPlanningEntry(null, formData);
      if (result.success) {
        toast.success(entryType === "INCOME" ? "Ingreso agregado" : "Gasto agregado");
        setOpen(false);
        formRef.current?.reset();
        setExpectedDate(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entryType === "INCOME" ? "Agregar ingreso" : "Agregar gasto"}
          </DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["INCOME", "EXPENSE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEntryType(type)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    entryType === type
                      ? type === "INCOME"
                        ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
                        : "border-red-400/50 bg-red-400/10 text-red-400"
                      : "border-white/10 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  {type === "INCOME" ? "Ingreso" : "Gasto"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-label">Nombre</Label>
            <Input
              id="entry-label"
              name="label"
              placeholder={entryType === "INCOME" ? "Ej: Nómina" : "Ej: Electricidad"}
              required
              className="bg-card border-white/6"
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entry-amount">Monto</Label>
              <Input
                id="entry-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
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
              <Select name="account_id">
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

          {entryType === "EXPENSE" && categories.length > 0 && (
            <div className="space-y-2">
              <Label>Categoría (opcional)</Label>
              <Select name="category_id">
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
            {isPending ? "Guardando..." : "Agregar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
