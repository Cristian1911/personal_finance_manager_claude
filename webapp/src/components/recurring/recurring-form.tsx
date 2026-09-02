"use client";

import { useMemo, useState } from "react";
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
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, BRASS_GHOST_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { parseSubPayments } from "@/lib/utils/sub-payments";
import { SUBCATEGORY_PAGO_TARJETA, SUBCATEGORY_CUOTA_CREDITO,
  isDebtAccountType,
} from "@zeta/shared";
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
  initialIsSubscription,
}: {
  template?: RecurringTemplate;
  /** Seed state when creating a new template with known data (e.g. promoting a transaction). Ignored when `template` is present. */
  initialValues?: Partial<RecurringTemplate>;
  /** Replace the default createRecurringTemplate action. Used to call a specialized action (e.g. createRecurringTemplateFromTransaction) while keeping UI behavior identical. */
  actionOverride?: RecurringFormAction;
  accounts: Account[];
  categories: CategoryWithChildren[];
  /** Called with the saved template on success. Receives undefined when the
   * action succeeded but didn't return the row (legacy actions). */
  onSuccess?: (template: RecurringTemplate | undefined) => void;
  /** Whether this template is currently tracked as a subscription. Seeded by the edit page. */
  initialIsSubscription?: boolean;
}) {
  const action = template
    ? updateRecurringTemplate.bind(null, template.id)
    : (actionOverride ?? createRecurringTemplate);

  const [state, formAction, pending] = useActionState<
    ActionResult<RecurringTemplate>,
    FormData
  >(
    async (prevState, formData) => {
      // The inline banner renders at the top of a long form — off-screen on
      // mobile. Toast so the failure is visible wherever the user is scrolled.
      if (formData.get("is_subscription") === "true" && !destinatarioId) {
        const error = "Una suscripción necesita un destinatario.";
        toast.error(error);
        return { success: false, error };
      }
      const result = await action(prevState, formData);
      if (result.success) onSuccess?.(result.data);
      else if (result.error) toast.error(result.error);
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
  const [destinatarioId, setDestinatarioId] = useState<string | null>(
    seed?.destinatario_id ?? null
  );
  const [isSubscription, setIsSubscription] = useState(initialIsSubscription ?? false);
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
    isDebtAccountType(selectedAccount?.account_type ?? "");

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

  // Keep the debt-payment category in sync with the chosen direction. Driven by
  // the account/direction change handlers (not an effect) to avoid cascading
  // re-renders — `categoryId` is read from the current render at call time.
  function syncDebtDefaultCategory(
    dir: TransactionDirection,
    accountType: string | undefined,
  ) {
    const isDebtDefaultCategory =
      categoryId === SUBCATEGORY_PAGO_TARJETA ||
      categoryId === SUBCATEGORY_CUOTA_CREDITO;

    if (dir === "INFLOW") {
      // Abono a deuda — pre-seleccionar la categoría de pago de deuda.
      if (!categoryId || isDebtDefaultCategory) {
        setCategoryId(
          accountType === "CREDIT_CARD"
            ? SUBCATEGORY_PAGO_TARJETA
            : SUBCATEGORY_CUOTA_CREDITO,
        );
      }
    } else if (isDebtDefaultCategory) {
      // Cambió a "Gasto" (cargo a la tarjeta): la categoría de abono ya no aplica.
      setCategoryId(null);
    }
  }

  function handleAccountChange(newAccountId: string) {
    const acct = accounts.find((a) => a.id === newAccountId);
    const acctType = acct?.account_type;
    const newIsDebt = isDebtAccountType(acctType ?? "");
    setAccountId(newAccountId);
    if (newIsDebt) {
      // Switching INTO debt from non-debt defaults to "Abono a deuda" (the
      // dominant use case); a debt→debt switch keeps the chosen type so a
      // "Gasto con la tarjeta" survives. Either way, re-sync the debt category
      // so it matches the NEW account type (CREDIT_CARD ↔ LOAN).
      const nextDirection = isDebtAccount ? direction : "INFLOW";
      if (!isDebtAccount) setDirection("INFLOW");
      syncDebtDefaultCategory(nextDirection, acctType);
    }
  }

  function handleDirectionChange(newDirection: TransactionDirection) {
    setDirection(newDirection);
    if (isDebtAccount) {
      syncDebtDefaultCategory(newDirection, selectedAccount?.account_type);
    }
    // The multi-currency breakdown only applies to an abono (INFLOW); its editor
    // is hidden for OUTFLOW. Disable it when leaving INFLOW so the amount field
    // unlocks and the hidden sub_payments input stops serializing abono data
    // onto an OUTFLOW "Gasto con la tarjeta".
    if (newDirection !== "INFLOW") {
      setUseSubPayments(false);
    }
  }

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
            name="direction"
            value={direction}
            onValueChange={(v) => handleDirectionChange(v as TransactionDirection)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OUTFLOW">{isDebtAccount ? "Gasto con la tarjeta" : "Gasto"}</SelectItem>
              <SelectItem value="INFLOW">{isDebtAccount ? "Abono a deuda" : "Ingreso"}</SelectItem>
            </SelectContent>
          </Select>
          {isDebtAccount && (
            <p className="text-xs text-muted-foreground">
              {direction === "INFLOW"
                ? "Abono que reduce la deuda. Se registra como transferencia desde la cuenta origen."
                : "Cargo recurrente a la tarjeta (aumenta la deuda). No requiere cuenta origen."}
            </p>
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
              : isDebtAccount && direction === "INFLOW"
                ? "Si importas un extracto con fecha y total a pagar, actualizamos este monto automáticamente. Al confirmar el pago puedes ajustar el monto pagado."
                : "Este valor es referencia. En el checklist podrás registrar el monto pagado."}
          </p>
        </div>
      </div>

      {/* Multi-currency breakdown for debt-payment (abono) templates */}
      {isDebtAccount && direction === "INFLOW" && accountCurrencies.length > 1 && (
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
            <div className="space-y-2 rounded-xl border border-white/6 bg-muted/30 p-3">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-z-debt"
                    onClick={() => {
                      const updated = subPayments.filter((_, i) => i !== idx);
                      setSubPayments(updated);
                      if (updated.length === 0) setUseSubPayments(false);
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
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
            onValueChange={handleAccountChange}
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

      {isDebtAccount && direction === "INFLOW" &&
        (cutoffDay != null || paymentDay != null) && (
          <div className="rounded-xl border border-z-alert/20 bg-z-alert/8 p-3 space-y-2">
            <p className="text-sm font-medium text-z-alert">
              Sugerencias para obligaciones
            </p>
            <p className="text-xs text-muted-foreground">
              Corte: día {cutoffDay ?? "--"} · Pago: día{" "}
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
                  Usar día de corte
                </Button>
              )}
              {paymentDay != null && (
                <Button
                  type="button"
                  size="sm"
                  className={GHOST_BUTTON_CLASS}
                  onClick={() => setStartDate(nextOccurrenceForDay(paymentDay))}
                >
                  Usar día de pago
                </Button>
              )}
            </div>
          </div>
        )}

      {isDebtAccount && direction === "INFLOW" && (
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
        {isDebtAccount && direction === "INFLOW" && (
          <p className="text-xs text-muted-foreground">
            Pre-seleccionada según tipo de cuenta. Puedes cambiarla si lo necesitas.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Destinatario</Label>
        <DestinatarioZonePicker
          variant="popover"
          value={destinatarioId}
          onValueChange={(id) => setDestinatarioId(id)}
          placeholder="Vincular a un destinatario"
          categories={categories}
        />
        <input type="hidden" name="destinatario_id" value={destinatarioId ?? ""} />
        <p className="text-xs text-muted-foreground">
          Sirve para reconocer el pago automáticamente: los patrones del
          destinatario (p. ej. «Anthropic») identifican el movimiento aunque
          el banco lo describa distinto, y si otro movimiento del mismo valor
          cae en la misma fecha, evita que se vincule al recurrente equivocado.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/6 bg-z-surface-2 px-3 py-2.5">
        <div className="space-y-0.5">
          <Label htmlFor="is_subscription_toggle" className="text-z-sage-light">Es una suscripción</Label>
          <p className="text-xs text-z-sage-light/60">Spotify, streaming, apps — opcional y cancelable.</p>
        </div>
        <Switch id="is_subscription_toggle" checked={isSubscription} onCheckedChange={setIsSubscription} />
      </div>
      <input type="hidden" name="is_subscription" value={isSubscription ? "true" : "false"} />

      <div className="space-y-2">
        <Label htmlFor="description">Notas</Label>
        <Input
          id="description"
          name="description"
          defaultValue={seed?.description ?? ""}
          placeholder="Nota opcional"
        />
      </div>

      {template ? (
        <div className="space-y-2">
          <Label>Etiquetas</Label>
          <TagZonePicker
            entityType="recurring_template"
            entityId={template.id}
            placeholder="Asignar etiquetas"
            variant="popover"
          />
          <p className="text-xs text-muted-foreground">
            Las etiquetas se aplicarán a cada transacción creada al registrar un pago.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Podrás asignar etiquetas a esta recurrente después de guardarla.
        </p>
      )}

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
