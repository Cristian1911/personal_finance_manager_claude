"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
} from "@/actions/recurring-templates";
import { Button } from "@/components/ui/button";
import { CategoryCombobox } from "@/components/ui/category-combobox";
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
import type { Account, CategoryWithChildren, RecurringTemplate, TransactionDirection } from "@/types/domain";

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
  categories: CategoryWithChildren[];
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
  const defaultStartDate = new Date().toISOString().split("T")[0];
  const [direction, setDirection] = useState<TransactionDirection>(
    template?.direction ?? "OUTFLOW"
  );
  const [accountId, setAccountId] = useState<string>(
    template?.account_id ?? defaultAccount?.id ?? ""
  );
  const [startDate, setStartDate] = useState<string>(
    template?.start_date ?? defaultStartDate
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    template?.category_id ?? null
  );
  const [transferSourceAccountId, setTransferSourceAccountId] = useState<string>(
    template?.transfer_source_account_id ?? ""
  );
  const selectedAccount = accounts.find((acc) => acc.id === accountId) ?? null;
  const cutoffDay = selectedAccount?.cutoff_day ?? null;
  const paymentDay = selectedAccount?.payment_day ?? null;
  const isDebtAccount =
    selectedAccount?.account_type === "CREDIT_CARD" ||
    selectedAccount?.account_type === "LOAN";

  useEffect(() => {
    if (isDebtAccount && direction !== "INFLOW") {
      setDirection("INFLOW");
    }
  }, [isDebtAccount, direction]);

  function nextOccurrenceForDay(dayOfMonth: number): string {
    const now = new Date();
    const currentDay = now.getDate();
    const year = now.getFullYear();
    const month = now.getMonth();

    const targetThisMonth = new Date(year, month, Math.min(dayOfMonth, 28));
    if (dayOfMonth >= currentDay) {
      return targetThisMonth.toISOString().split("T")[0];
    }

    const targetNextMonth = new Date(year, month + 1, Math.min(dayOfMonth, 28));
    return targetNextMonth.toISOString().split("T")[0];
  }

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
            name={isDebtAccount ? undefined : "direction"}
            value={direction}
            onValueChange={(v) => setDirection(v as TransactionDirection)}
            disabled={isDebtAccount}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OUTFLOW">Gasto</SelectItem>
              <SelectItem value="INFLOW">Ingreso</SelectItem>
            </SelectContent>
          </Select>
          {isDebtAccount && (
            <p className="text-xs text-muted-foreground">
              Para cuentas de deuda este recurrente se maneja como abono (INFLOW).
            </p>
          )}
          {isDebtAccount && (
            <input type="hidden" name="direction" value="INFLOW" />
          )}
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
          <p className="text-xs text-muted-foreground">
            Este valor es referencia. En el checklist podras registrar el monto real del pago.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="account_id">Cuenta</Label>
          <Select
            name="account_id"
            value={accountId}
            onValueChange={setAccountId}
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

      {isDebtAccount &&
        (cutoffDay != null || paymentDay != null) && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-sm font-medium text-blue-900">
              Sugerencias para obligaciones
            </p>
            <p className="text-xs text-blue-800">
              Corte: dia {cutoffDay ?? "--"} · Pago: dia{" "}
              {paymentDay ?? "--"}
            </p>
            <div className="flex flex-wrap gap-2">
              {cutoffDay != null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStartDate(nextOccurrenceForDay(cutoffDay))}
                >
                  Usar dia de corte
                </Button>
              )}
              {paymentDay != null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStartDate(nextOccurrenceForDay(paymentDay))}
                >
                  Usar dia de pago
                </Button>
              )}
            </div>
          </div>
        )}

      {isDebtAccount && (
        <div className="space-y-2">
          <Label htmlFor="transfer_source_account_id">
            Cuenta origen del pago
          </Label>
          <Select
            name="transfer_source_account_id"
            value={transferSourceAccountId}
            onValueChange={setTransferSourceAccountId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cuenta origen" />
            </SelectTrigger>
            <SelectContent>
              {accounts
                .filter((acc) => acc.id !== accountId)
                .map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Al marcar este recurrente como pagado se crea una transferencia:
            salida desde esta cuenta y abono en la deuda.
          </p>
        </div>
      )}

      <input
        type="hidden"
        name="currency_code"
        value={selectedAccount?.currency_code ?? template?.currency_code ?? "COP"}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha de inicio</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
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

      {isDebtAccount ? (
        <div className="space-y-2">
          <Label>Categoría</Label>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Se asignará automáticamente como abono de deuda al registrar cada pago.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Categoría</Label>
          <CategoryCombobox
            categories={categories}
            value={categoryId}
            onValueChange={setCategoryId}
            direction={direction}
            name="category_id"
          />
        </div>
      )}

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
