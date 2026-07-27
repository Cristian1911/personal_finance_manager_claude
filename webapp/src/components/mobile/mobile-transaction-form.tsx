"use client";

import { useState, useMemo, useEffect, useActionState } from "react";

import {
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronDown,
  Repeat,
} from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { createTransfer } from "@/actions/transfers";
import { Button } from "@/components/ui/button";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AmountInput } from "@/components/ui/amount-input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toColombiaDateString, toColombiaTimeString } from "@/lib/utils/date";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type {
  Account,
  CategoryWithChildren,
  TransactionDirection,
} from "@/types/domain";

interface MobileTransactionFormProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  defaultDirection?: TransactionDirection;
  isTransfer?: boolean;
  /** Preselects an account — used when arriving from a specific account's page. */
  defaultAccountId?: string;
  onSuccess?: () => void;
}

type TransactionType = "expense" | "income" | "transfer";

function directionFromType(type: TransactionType): TransactionDirection {
  return type === "income" ? "INFLOW" : "OUTFLOW";
}

const TRANSACTION_TYPES: {
  id: TransactionType;
  label: string;
  icon: typeof ArrowUpRight;
}[] = [
  { id: "expense", label: "Gasto", icon: ArrowUpRight },
  { id: "income", label: "Ingreso", icon: ArrowDownLeft },
  { id: "transfer", label: "Transferencia", icon: ArrowLeftRight },
];

const FREQUENCY_OPTIONS = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "ANNUAL", label: "Anual" },
] as const;

export function MobileTransactionForm({
  accounts,
  categories,
  defaultDirection,
  isTransfer,
  defaultAccountId,
  onSuccess,
}: MobileTransactionFormProps) {
  // Determine initial transaction type from props (backward compat)
  const initialType: TransactionType = isTransfer
    ? "transfer"
    : defaultDirection === "INFLOW"
      ? "income"
      : "expense";

  const [transactionType, setTransactionType] =
    useState<TransactionType>(initialType);

  // Whether to show the type selector (only when no preset direction)
  const showTypeSelector = !defaultDirection;

  const direction = defaultDirection ?? directionFromType(transactionType);

  const isTransferMode = transactionType === "transfer";

  // Two action states: regular transactions vs. paired account transfers.
  // Transfers go through createTransfer (outflow + inflow + balance updates);
  // everything else through createTransaction.
  //
  // onSuccess is called INSIDE the wrapped action — never from an effect on
  // `state.success`. /transactions/new sits in the client Router Cache, and a
  // re-entry within the cache window restores the last action state
  // (success: true); an effect would replay onSuccess on mount (stale
  // "Guardado" toast + instant router.back() before the form ever shows).
  // Same pattern as TransactionForm / RecurringForm / MobileQuickCaptureSheet.
  const [txState, txFormAction, txPending] = useActionState(
    async (prev: Awaited<ReturnType<typeof createTransaction>>, formData: FormData) => {
      const result = await createTransaction(prev, formData);
      if (result.success) onSuccess?.();
      return result;
    },
    { success: false, error: "" },
  );
  const [transferState, transferFormAction, transferPending] = useActionState(
    async (prev: Awaited<ReturnType<typeof createTransfer>>, formData: FormData) => {
      const result = await createTransfer(prev, formData);
      if (result.success) onSuccess?.();
      return result;
    },
    { success: false, error: "" },
  );

  const state = isTransferMode ? transferState : txState;
  const formAction = isTransferMode ? transferFormAction : txFormAction;
  const pending = isTransferMode ? transferPending : txPending;

  const STORAGE_KEY = "zeta:quick-capture-account";
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    // An explicit account from the deep link wins over the remembered one:
    // the user came here from that account's page.
    if (defaultAccountId && accounts.some((a) => a.id === defaultAccountId)) {
      return defaultAccountId;
    }
    if (typeof window === "undefined") return accounts[0]?.id ?? "";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && accounts.some((a) => a.id === saved)) return saved;
    return accounts[0]?.id ?? "";
  });

  useEffect(() => {
    if (selectedAccountId) {
      localStorage.setItem(STORAGE_KEY, selectedAccountId);
    }
  }, [selectedAccountId]);

  // Transfer destination account (only used in transfer mode). Only same-currency
  // accounts are valid destinations — createTransfer rejects cross-currency.
  const [destinationAccountId, setDestinationAccountId] = useState<string>("");
  const transferSourceCurrency = accounts.find(
    (a) => a.id === selectedAccountId
  )?.currency_code;
  const destinationAccounts = accounts.filter(
    (a) =>
      a.id !== selectedAccountId &&
      a.currency_code === transferSourceCurrency
  );

  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Reset category when direction changes (categories are direction-filtered)
  useEffect(() => {
    setCategoryId(null);
  }, [transactionType]);

  const currencyCode = useMemo(() => {
    const account = accounts.find((a) => a.id === selectedAccountId);
    return account?.currency_code ?? "COP";
  }, [accounts, selectedAccountId]);
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );
  const isDebtAccount =
    selectedAccount?.account_type === "CREDIT_CARD" ||
    selectedAccount?.account_type === "LOAN";

  // Colombian calendar day / time-of-day — never the device tz or UTC, which
  // drift the default a day off (toISOString is UTC; toTimeString is device-local).
  // Lazy state (not a plain const): controlled inputs re-render the whole form
  // per keystroke, and the Intl-backed formatter shouldn't re-run on each one.
  const [today] = useState(() => toColombiaDateString(new Date()));
  const [merchantName, setMerchantName] = useState("");
  const [transactionDate, setTransactionDate] = useState<string>(today);
  // Default to the current time-of-day so FAB-created transactions carry an hour.
  const [transactionTime, setTransactionTime] = useState<string>(() =>
    toColombiaTimeString(new Date()),
  );
  const [isSubscription, setIsSubscription] = useState(false);
  const [notes, setNotes] = useState("");
  const [destinatarioId, setDestinatarioId] = useState<string | null>(null);
  const [destinatarioSelectedName, setDestinatarioSelectedName] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createRecurringSetup, setCreateRecurringSetup] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<
    (typeof FREQUENCY_OPTIONS)[number]["value"]
  >("MONTHLY");
  const [recurringStartDate, setRecurringStartDate] = useState(today);
  const [recurringTransferSourceAccountId, setRecurringTransferSourceAccountId] =
    useState("");
  const allowRelatedSetup = transactionType !== "transfer";

  useEffect(() => {
    if (transactionType === "transfer") {
      setCreateRecurringSetup(false);
      setAdvancedOpen(false);
      setRecurringTransferSourceAccountId("");
      // Destinatario + suscripción don't apply to transfers — clear any
      // stale values so hidden inputs don't submit them.
      setIsSubscription(false);
      setDestinatarioId(null);
      setDestinatarioSelectedName(null);
    }
  }, [transactionType]);

  function handleCreateRecurringSetup(checked: boolean) {
    setCreateRecurringSetup(checked);

    if (checked) {
      setAdvancedOpen(true);
      if (!recurringStartDate) {
        setRecurringStartDate(today);
      }
    } else {
      setRecurringTransferSourceAccountId("");
    }
  }

  const submitLabel =
    transactionType === "transfer"
      ? "Registrar transferencia"
      : transactionType === "income"
        ? "Registrar ingreso"
        : "Registrar gasto";

  return (
    <form
      action={formAction}
      className="space-y-4 pb-4"
      onFocusCapture={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        window.setTimeout(() => {
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
        }, 120);
      }}
    >
      {!state.success && state.error && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {/* Hidden fields */}
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="transaction_date" value={transactionDate} />
      <input type="hidden" name="currency_code" value={currencyCode} />
      <input
        type="hidden"
        name="is_subscription"
        value={isSubscription ? "true" : "false"}
      />
      <input
        type="hidden"
        name="create_recurring_template"
        value={createRecurringSetup ? "true" : "false"}
      />
      <input type="hidden" name="recurring_frequency" value={recurringFrequency} />
      <input type="hidden" name="recurring_start_date" value={recurringStartDate} />
      <input
        type="hidden"
        name="recurring_transfer_source_account_id"
        value={recurringTransferSourceAccountId}
      />

      {/* Transfer-only fields consumed by createTransfer */}
      {isTransferMode && (
        <>
          <input type="hidden" name="currencyCode" value={currencyCode} />
          <input type="hidden" name="date" value={transactionDate} />
        </>
      )}

      {/* Direction selector — only shown when no preset */}
      {showTypeSelector && (
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTransactionType(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                transactionType === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Amount */}
      <AmountInput
        name="amount"
        autoFocus={!showTypeSelector}
      />

      {/* ── DETALLES ────────────────────────────────────────── */}
      <SectionEyebrow>Detalles</SectionEyebrow>

      {/* Description — full width (not used for transfers) */}
      {!isTransferMode && (
        <div className="space-y-2">
          <Label htmlFor="mobile-merchant">Descripción</Label>
          <Input
            id="mobile-merchant"
            name="merchant_name"
            value={merchantName}
            onChange={(event) => setMerchantName(event.target.value)}
            placeholder="Ej: Almuerzo, Uber, Arriendo..."
          />
        </div>
      )}

      {/* Cuenta (origen for transfers) */}
      <div className="space-y-2">
        <Label htmlFor="mobile-account">
          {isTransferMode ? "Cuenta origen" : "Cuenta"}
        </Label>
        <Select
          name={isTransferMode ? "fromAccountId" : "account_id"}
          value={selectedAccountId}
          onValueChange={(value) => {
            setSelectedAccountId(value);
            if (recurringTransferSourceAccountId === value) {
              setRecurringTransferSourceAccountId("");
            }
            // Clear a destination that's no longer valid for the new source
            // (same account, or a now-mismatched currency).
            const dest = accounts.find((a) => a.id === destinationAccountId);
            const newSource = accounts.find((a) => a.id === value);
            if (
              dest &&
              (dest.id === value ||
                dest.currency_code !== newSource?.currency_code)
            ) {
              setDestinationAccountId("");
            }
          }}
        >
          <SelectTrigger id="mobile-account">
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

      {/* Cuenta destino — transfers only */}
      {isTransferMode && (
        <div className="space-y-2">
          <Label htmlFor="mobile-destination-account">Cuenta destino</Label>
          <Select
            name="toAccountId"
            required
            value={destinationAccountId}
            onValueChange={setDestinationAccountId}
          >
            <SelectTrigger id="mobile-destination-account">
              <SelectValue placeholder="Seleccionar cuenta" />
            </SelectTrigger>
            <SelectContent>
              {destinationAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Se registrará una salida en la cuenta origen y una entrada en la
            cuenta destino.
          </p>
        </div>
      )}

      {/* Fecha + hora */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Fecha</Label>
          <DatePicker
            value={transactionDate}
            onChange={(v) => setTransactionDate(v ?? today)}
            placeholder="Seleccionar fecha"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transaction_time">Hora</Label>
          <TimePicker
            name="transaction_time"
            value={transactionTime}
            onChange={(v) => setTransactionTime(v ?? "")}
          />
        </div>
      </div>

      {/* Category — full width (not used for transfers) */}
      {!isTransferMode && (
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
        </div>
      )}

      {/* Notas — transfers only (other modes have it under "Más opciones") */}
      {isTransferMode && (
        <div className="space-y-2">
          <Label htmlFor="mobile-transfer-notes">Notas (opcional)</Label>
          <Input
            id="mobile-transfer-notes"
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ej: Pago cuota préstamo"
          />
        </div>
      )}

      {/* ── ASIGNAR ─────────────────────────────────────────── */}
      {allowRelatedSetup && (
        <>
          <SectionEyebrow>Asignar</SectionEyebrow>

          <div className="space-y-2">
            <Label>Destinatario</Label>
            <DestinatarioZonePicker
              value={destinatarioId}
              onValueChange={(id, name) => {
                setDestinatarioId(id);
                setDestinatarioSelectedName(name);
              }}
              selectedName={destinatarioSelectedName}
              placeholder="Elegir o crear destinatario"
              triggerClassName="w-full"
              categories={categories}
              merchantName={merchantName}
            />
            <input type="hidden" name="destinatario_id" value={destinatarioId ?? ""} />
          </div>
        </>
      )}

      {allowRelatedSetup && (
        <>
          <Collapsible
            open={advancedOpen}
            onOpenChange={setAdvancedOpen}
            className="rounded-lg border border-border/60 bg-muted/10"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left sm:items-center"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">Más opciones</p>
                  <p className="text-xs text-muted-foreground">
                    Suscripción, pago recurrente y notas.
                  </p>
                </div>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    advancedOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 border-t px-4 py-4">
              {/* Es una suscripción */}
              <div className="flex items-center gap-3">
                <Repeat className="size-[18px] shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <Label
                    htmlFor="mobile-is_subscription"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Es una suscripción
                  </Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Marca este movimiento como parte de una suscripción
                  </p>
                </div>
                <Switch
                  id="mobile-is_subscription"
                  checked={isSubscription}
                  onCheckedChange={setIsSubscription}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="mobile-create_recurring_template" className="cursor-pointer">
                    Crear pago recurrente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Útil si este movimiento se repite cada semana, mes o trimestre.
                  </p>
                </div>
                <Switch
                  id="mobile-create_recurring_template"
                  checked={createRecurringSetup}
                  onCheckedChange={handleCreateRecurringSetup}
                />
              </div>

              {createRecurringSetup && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="mobile-recurring_frequency">Frecuencia</Label>
                      <Select
                        value={recurringFrequency}
                        onValueChange={(value) =>
                          setRecurringFrequency(
                            value as (typeof FREQUENCY_OPTIONS)[number]["value"]
                          )
                        }
                      >
                        <SelectTrigger id="mobile-recurring_frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Fecha de inicio</Label>
                      <DatePicker
                        value={recurringStartDate}
                        onChange={(v) => setRecurringStartDate(v ?? "")}
                        placeholder="Fecha de inicio"
                      />
                    </div>
                  </div>

                  {isDebtAccount && (
                    <div className="space-y-2">
                      <Label htmlFor="mobile-recurring_transfer_source_account_id">
                        Cuenta origen del pago
                      </Label>
                      <Select
                        value={recurringTransferSourceAccountId}
                        onValueChange={setRecurringTransferSourceAccountId}
                      >
                        <SelectTrigger id="mobile-recurring_transfer_source_account_id">
                          <SelectValue placeholder="Seleccionar cuenta origen" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            .filter((account) => account.id !== selectedAccountId)
                            .map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Para deudas, el recurrente se guarda como abono y necesita una cuenta
                        origen.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Notas (opcional) */}
              <div className="space-y-2">
                <Label htmlFor="mobile-notes">Notas (opcional)</Label>
                <Input
                  id="mobile-notes"
                  name="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Detalle extra"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className={cn(BRASS_BUTTON_CLASS, "h-12 w-full")}
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Guardando...
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
