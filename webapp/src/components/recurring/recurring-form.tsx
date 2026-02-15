"use client";

import { useActionState } from "react";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
} from "@/actions/recurring-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/types/actions";
import type { Account, Category, RecurringTemplate } from "@/types/domain";

const FREQUENCY_OPTIONS = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "ANNUAL", label: "Anual" },
] as const;

export function RecurringForm({
  template,
  accounts,
  categories,
  onSuccess,
}: {
  template?: RecurringTemplate;
  accounts: Account[];
  categories: Category[];
  onSuccess?: () => void;
}) {
  const action = template
    ? updateRecurringTemplate.bind(null, template.id)
    : createRecurringTemplate;

  const [state, formAction, pending] = useActionState<
    ActionResult<RecurringTemplate>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await action(prevState, formData);
      if (result.success) onSuccess?.();
      return result;
    },
    { success: false, error: "" }
  );

  const defaultAccount = accounts[0];

  return (
    <form action={formAction} className="space-y-4">
      {!state.success && state.error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="merchant_name">Nombre / Comercio</Label>
        <Input
          id="merchant_name"
          name="merchant_name"
          defaultValue={template?.merchant_name ?? ""}
          placeholder="Ej: Netflix, Arriendo, Salario"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="direction">Tipo</Label>
          <Select
            name="direction"
            defaultValue={template?.direction ?? "OUTFLOW"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OUTFLOW">Gasto</SelectItem>
              <SelectItem value="INFLOW">Ingreso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={template?.amount}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="account_id">Cuenta</Label>
          <Select
            name="account_id"
            defaultValue={template?.account_id ?? defaultAccount?.id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cuenta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="frequency">Frecuencia</Label>
          <Select
            name="frequency"
            defaultValue={template?.frequency ?? "MONTHLY"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <input
        type="hidden"
        name="currency_code"
        value={
          template?.currency_code ?? defaultAccount?.currency_code ?? "COP"
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha de inicio</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={
              template?.start_date ??
              new Date().toISOString().split("T")[0]
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">Fecha fin (opcional)</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={template?.end_date ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category_id">Categoría</Label>
        <Select
          name="category_id"
          defaultValue={template?.category_id ?? ""}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sin categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name_es || cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Notas</Label>
        <Input
          id="description"
          name="description"
          defaultValue={template?.description ?? ""}
          placeholder="Nota opcional"
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Guardando..."
          : template
            ? "Actualizar"
            : "Crear recurrente"}
      </Button>
    </form>
  );
}
