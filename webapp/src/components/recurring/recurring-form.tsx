"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
} from "@/actions/recurring-templates";
import { Button } from "@/components/ui/button";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, BRASS_GHOST_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { parseSubPayments } from "@/lib/utils/sub-payments";
import { SUBCATEGORY_PAGO_TARJETA, SUBCATEGORY_CUOTA_CREDITO } from "@zeta/shared";
import type { ActionResult } from "@/types/actions";
import type { Account, CategoryWithChildren, RecurringTemplate, SubPayment, TransactionDirection } from "@/types/domain";

const FREQUENCY_OPTIONS = [
  { value: "ONCE", label: "Una vez" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "ANNUAL", label: "Anual" },
] as const;

type RecurringFormAction = (
  prevState: ActionResult<RecurringTemplate>,
  formData: FormData,
) => Promise<ActionResult<RecurringTemplate>>;

export function RecurringForm({
  template,
  initialValues,
  actionOverride,
  accounts,
  categories,
  onSuccess,
}: {
  template?: RecurringTemplate;
  /** Seed state when creating a new template with known data (e.g. promoting a transaction). Ignored when `template` is present. */
  initialValues?: Partial<RecurringTemplate>;
  /** Replace the default createRecurringTemplate action. Used to call a specialized action (e.g. createRecurringTemplateFromTransaction) while keeping UI behavior identical. */
  actionOverride?: RecurringFormAction;
  accounts: Account[];
  categories: CategoryWithChildren[];
  onSuccess?: () => void;
}) {
  const action = template
    ? updateRecurringTemplate.bind(null, template.id)
    : (actionOverride ?? createRecurringTemplate);

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

  const defaultStartDate = new Date().toISOString().split("T")[0];
  const seed = template ?? initialValues ?? null;

  const [direction, setDirection] = useState<TransactionDirection>(
    (seed?.direction as TransactionDirection | undefined) ?? "OUTFLOW"
  );
  const [accountId, setAccountId] = useState<string>(
    seed?.account_id ?? ""
  );
  const [startDate, setStartDate] = useState<string>(
    seed?.start_date ?? defaultStartDate
  );
  const [endDate, setEndDate] = useState<string | null>(
    seed?.end_date ?? null
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    seed?.category_id ?? null
  );
  const [frequency, setFrequency] = useState<string>(
    seed?.frequency ?? "MONTHLY"
  );
  const [transferSourceAccountId, setTransferSourceAccountId] = useState<string>(
    seed?.transfer_source_account_id ?? ""
  );
  // Multi-currency sub_payments for debt accounts
  const initialSubPayments: SubPayment[] = parseSubPayments(seed?.sub_payments) ?? [];
  const [subPayments, setSubPayments] = useState<SubPayment[]>(initialSubPayments);
  const [useSubPayments, setUseSubPayments] = useState(initialSubPayments.length > 0);

  const selectedAccount = accounts.find((acc) => acc.id === accountId) ?? null;

  // Primary-currency amount from sub_payments (not a cross-currency sum).
  // Falls back to 0 if the primary currency entry isn't set yet.
  const primaryCurrency = selectedAccount?.currency_code ?? seed?.currency_code ?? "COP";
  const subPaymentsPrimaryAmount =
    subPayments.find((sp) => sp.currency_code === primaryCurrency)?.amount ?? 0;
  const cutoffDay = selectedAccount?.cutoff_day ?? null;
  const paymentDay = selectedAccount?.payment_day ?? null;
  const isDebtAccount =
    selectedAccount?.account_type === "CREDIT_CARD" ||
    selectedAccount?.account_type === "LOAN";

  // Available currencies for the account (from currency_balances)
  const accountCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    if (selectedAccount?.currency_code) currencies.add(selectedAccount.currency_code);
    const balances = selectedAccount?.currency_balances;
    if (balances && typeof balances === "object" && !Array.isArray(balances)) {
      for (const key of Object.keys(balances as Record<string, unknown>)) {
        currencies.add(key);
      }
    }
    return Array.from(currencies).sort();
  }, [selectedAccount]);

  useEffect(() => {
    if (isDebtAccount && direction !== "INFLOW") {
      setDirection("INFLOW");
    }
  }, [isDebtAccount, direction]);

  useEffect(() => {
    if (!isDebtAccount) return;

    const isDefault = !categoryId ||
      categoryId === SUBCATEGORY_PAGO_TARJETA ||
      categoryId === SUBCATEGORY_CUOTA_CREDITO;

    if (isDefault) {
      const targetCat = selectedAccount?.account_type === "CREDIT_CARD"
        ? SUBCATEGORY_PAGO_TARJETA
        : SUBCATEGORY_CUOTA_CREDITO;

      if (categoryId !== targetCat) {
        setCategoryId(targetCat);
      }
    }
  }, [isDebtAccount, selectedAccount?.account_type, categoryId]);

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
          defaultValue={seed?.merchant_name ?? ""}
          placeholder="Ej: Netflix, Arriendo, Salario"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <SelectItem value="INFLOW">{isDebtAccount ? "Abono a deuda" : "Ingreso"}</SelectItem>
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
          <Label htmlFor="amount">
            {useSubPayments ? "Monto total" : "Monto"}
          </Label>
          <CurrencyInput
            id="amount"
            name="amount"
            defaultValue={seed?.amount}
            value={useSubPayments ? String(Math.round(subPaymentsPrimaryAmount * 100) / 100) : undefined}
            placeholder="0"
            required
            readOnly={useSubPayments}
            className={useSubPayments ? "opacity-60" : ""}
          />
          <p className="text-xs text-muted-foreground">
            {useSubPayments
              ? `Pago mínimo en ${primaryCurrency} del desglose por moneda.`
              : isDebtAccount
                ? "Si importas un extracto con fecha y total a pagar, actualizamos este monto automaticamente. Al confirmar el pago puedes ajustar el monto pagado."
                : "Este valor es referencia. En el checklist podras registrar el monto pagado."}
          </p>
        </div>
      </div>

      {/* Multi-currency breakdown for debt accounts */}
      {isDebtAccount && accountCurrencies.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Desglose por moneda</Label>
            {!useSubPayments && (
              <Button
                type="button"
                size="sm"
                className={cn(BRASS_GHOST_BUTTON_CLASS, "h-6 text-[10px]")}
                onClick={() => {
                  setUseSubPayments(true);
                  if (subPayments.length === 0) {
                    setSubPayments(
                      accountCurrencies.map((c) => ({ currency_code: c, amount: 0 }))
                    );
                  }
                }}
              >
                <Plus className="mr-1 size-3" />
                Agregar
              </Button>
            )}
          </div>

          {useSubPayments && (
            <div className="space-y-2 rounded-md border border-white/6 bg-muted/30 p-3">
              {subPayments.map((sp, idx) => (
                <div key={sp.currency_code} className="flex items-center gap-2">
                  <span className="w-10 text-xs font-semibold text-muted-foreground">
                    {sp.currency_code}
                  </span>
                  <CurrencyInput
                    value={String(sp.amount || "")}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSubPayments((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, amount: val } : s))
                      );
                    }}
                    placeholder="0"
                    className="h-8 flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = subPayments.filter((_, i) => i !== idx);
                      setSubPayments(updated);
                      if (updated.length === 0) setUseSubPayments(false);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {/* Add another currency */}
              {subPayments.length < accountCurrencies.length && (
                <Button
                  type="button"
                  size="sm"
                  className={cn(GHOST_BUTTON_CLASS, "h-7 text-xs")}
                  onClick={() => {
                    const used = new Set(subPayments.map((s) => s.currency_code));
                    const next = accountCurrencies.find((c) => !used.has(c));
                    if (next) {
                      setSubPayments((prev) => [...prev, { currency_code: next, amount: 0 }]);
                    }
                  }}
                >
                  <Plus className="mr-1 size-3" />
                  Otra moneda
                </Button>
              )}

              <p className="text-[10px] text-muted-foreground">
                El monto total se calcula como la suma de los pagos mínimos de cada moneda.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hidden field to send sub_payments JSON */}
      {useSubPayments && subPayments.length > 0 && (
        <input type="hidden" name="sub_payments" value={JSON.stringify(subPayments)} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            value={frequency}
            onValueChange={setFrequency}
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
          <div className="rounded-md border border-z-alert/20 bg-z-alert/8 p-3 space-y-2">
            <p className="text-sm font-medium text-z-alert">
              Sugerencias para obligaciones
            </p>
            <p className="text-xs text-muted-foreground">
              Corte: dia {cutoffDay ?? "--"} · Pago: dia{" "}
              {paymentDay ?? "--"}
            </p>
            <div className="flex flex-wrap gap-2">
              {cutoffDay != null && (
                <Button
                  type="button"
                  size="sm"
                  className={GHOST_BUTTON_CLASS}
                  onClick={() => setStartDate(nextOccurrenceForDay(cutoffDay))}
                >
                  Usar dia de corte
                </Button>
              )}
              {paymentDay != null && (
                <Button
                  type="button"
                  size="sm"
                  className={GHOST_BUTTON_CLASS}
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
        value={selectedAccount?.currency_code ?? seed?.currency_code ?? "COP"}
      />

      <div className={`grid gap-4 ${frequency === "ONCE" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        <div className="space-y-2">
          <Label htmlFor="start_date">{frequency === "ONCE" ? "Fecha de pago" : "Fecha de inicio"}</Label>
          <DatePicker
            value={startDate}
            onChange={(v) => setStartDate(v ?? defaultStartDate)}
            name="start_date"
            placeholder={frequency === "ONCE" ? "Fecha de pago" : "Fecha de inicio"}
          />
        </div>

        {frequency !== "ONCE" && (
          <div className="space-y-2">
            <Label htmlFor="end_date">Fecha fin (opcional)</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              name="end_date"
              placeholder="Sin fecha fin"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Categoría</Label>
        <CategoryZonePicker
          variant="popover"
          categories={categories}
          value={categoryId}
          onValueChange={setCategoryId}
          direction={direction}
          name="category_id"
        />
        {isDebtAccount && (
          <p className="text-xs text-muted-foreground">
            Pre-seleccionada según tipo de cuenta. Puedes cambiarla si lo necesitas.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Notas</Label>
        <Input
          id="description"
          name="description"
          defaultValue={seed?.description ?? ""}
          placeholder="Nota opcional"
        />
      </div>

      <Button type="submit" className={cn(BRASS_BUTTON_CLASS, "w-full")} disabled={pending}>
        {pending
          ? "Guardando..."
          : template
            ? "Actualizar"
            : "Crear recurrente"}
      </Button>
    </form>
  );
}
