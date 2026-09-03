"use client";

import { useState, useMemo, useEffect, useActionState } from "react";

import {
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronDown,
  Repeat,
  CalendarClock,
} from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { useDebtCoverPrompt } from "@/components/recurring/debt-cover-prompt";
import { createTransfer } from "@/actions/transfers";
import { Button } from "@/components/ui/button";
import { AccountPickerDrawer } from "@/components/accounts/account-picker-drawer";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import {
  ClassificationAccountValue,
  ClassificationCard,
  ClassificationCategoryValue,
  ClassificationDestinatarioValue,
  ClassificationPrompt,
  ClassificationRow,
  ClassificationTagsRow,
} from "@/components/transactions/classification-card";
import { useAllTags, useDestinatarios } from "@/components/providers/app-data-provider";
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
import { findLeafCategory } from "@/lib/utils/categories";
import { toColombiaDateString, toColombiaTimeString } from "@/lib/utils/date";
import {
  BRASS_BUTTON_CLASS,
  SEGMENTED_TAB_ACTIVE_CLASS,
  SEGMENTED_TAB_CLASS,
} from "@/lib/constants/styles";
import type {
  Account,
  CategoryWithChildren,
  TransactionDirection,
} from "@/types/domain";
import { isDebtAccountType } from "@zeta/shared";

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

/**
 * Mobile create form (FAB → "Nueva transacción", /transactions/new).
 *
 * Mirrors the transaction detail page: amount + description up top, then a
 * "Clasificación" card with one tappable row per attribute (Cuenta ·
 * Categoría · Destinatario · Etiquetas) that opens the same pickers the
 * detail page uses. What you tap to *edit* a movement is what you tap to
 * *create* one.
 */
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
  //
  // A payment INTO a card/loan (income on the card, or a transfer whose
  // destination is the card) may carry the next cuota: the prompt asks before
  // closing and runs onSuccess once the user answers.
  const debtCover = useDebtCoverPrompt();
  const [txState, txFormAction, txPending] = useActionState(
    async (prev: Awaited<ReturnType<typeof createTransaction>>, formData: FormData) => {
      const result = await createTransaction(prev, formData);
      if (result.success) {
        const finish = () => onSuccess?.();
        const asked =
          result.data.direction === "INFLOW"
            ? await debtCover.maybeAsk({
                transactionId: result.data.id,
                accountType: accounts.find((a) => a.id === result.data.account_id)
                  ?.account_type,
                onDone: finish,
              })
            : false;
        if (!asked) finish();
      }
      return result;
    },
    { success: false, error: "" },
  );
  const [transferState, transferFormAction, transferPending] = useActionState(
    async (prev: Awaited<ReturnType<typeof createTransfer>>, formData: FormData) => {
      const result = await createTransfer(prev, formData);
      if (result.success) {
        const finish = () => onSuccess?.();
        const toAccountId = String(formData.get("toAccountId") ?? "");
        const asked = await debtCover.maybeAsk({
          transactionId: result.data.inflowId,
          accountType: accounts.find((a) => a.id === toAccountId)?.account_type,
          onDone: finish,
        });
        if (!asked) finish();
      }
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
  const destinationAccount =
    accounts.find((a) => a.id === destinationAccountId) ?? null;

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const destinatarios = useDestinatarios();

  const currencyCode = useMemo(() => {
    const account = accounts.find((a) => a.id === selectedAccountId);
    return account?.currency_code ?? "COP";
  }, [accounts, selectedAccountId]);
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );
  const isDebtAccount =
    isDebtAccountType(selectedAccount?.account_type ?? "");

  // Colombian calendar day / time-of-day — never the device tz or UTC, which
  // drift the default a day off (toISOString is UTC; toTimeString is device-local).
  //
  // The clock is read on the CLIENT ONLY. A lazy useState initializer runs both
  // during SSR and again while hydrating, so the two sample different instants:
  // the minute ticks over between them and React throws a hydration mismatch,
  // discarding and re-rendering the tree. Empty on the server, filled on mount.
  const [today, setToday] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [transactionDate, setTransactionDate] = useState<string>("");
  // Default to the current time-of-day so FAB-created transactions carry an hour.
  const [transactionTime, setTransactionTime] = useState<string>("");

  useEffect(() => {
    const now = new Date();
    // The wall clock is exactly the "external system" this rule exists to
    // synchronize with, and it cannot be read during render without breaking
    // hydration. Mount-only, so there is no cascading-render risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(toColombiaDateString(now));
    setTransactionDate(toColombiaDateString(now));
    setTransactionTime(toColombiaTimeString(now));
  }, []);
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

  // ── Clasificación pickers (same controlled pickers as the detail page) ──
  const [accountOpen, setAccountOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  // Tags are picked before the row exists; they travel as `tag_ids` hidden
  // inputs and the server attaches them right after the insert.
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const allTags = useAllTags();
  const selectedTags = useMemo(() => {
    const selected = new Set(selectedTagIds);
    return allTags.filter((t) => selected.has(t.id));
  }, [allTags, selectedTagIds]);

  const selectedCategory = findLeafCategory(categories, categoryId);

  // The type only changes from the segmented control, so the dependent
  // resets live in its handler rather than in an effect watching the value.
  function handleTypeChange(next: TransactionType) {
    if (next === transactionType) return;
    setTransactionType(next);
    // Categories are direction-filtered — a Gasto category is meaningless on
    // an Ingreso.
    setCategoryId(null);
    if (next === "transfer") {
      setCreateRecurringSetup(false);
      setAdvancedOpen(false);
      setRecurringTransferSourceAccountId("");
      // Destinatario + suscripción don't apply to transfers — clear any
      // stale values so hidden inputs don't submit them.
      setIsSubscription(false);
      setDestinatarioId(null);
      setDestinatarioSelectedName(null);
    }
  }

  function handleAccountSelect(value: string) {
    setSelectedAccountId(value);
    setAccountOpen(false);
    if (recurringTransferSourceAccountId === value) {
      setRecurringTransferSourceAccountId("");
    }
    // Clear a destination that's no longer valid for the new source
    // (same account, or a now-mismatched currency).
    const dest = accounts.find((a) => a.id === destinationAccountId);
    const newSource = accounts.find((a) => a.id === value);
    if (
      dest &&
      (dest.id === value || dest.currency_code !== newSource?.currency_code)
    ) {
      setDestinationAccountId("");
    }
  }

  function handleCategorySelect(id: string | null) {
    setCategoryId(id);
    setCatOpen(false);
  }

  function handleDestinatarioSelect(id: string | null, name: string | null) {
    setDestinatarioId(id);
    setDestinatarioSelectedName(name);
    setDestOpen(false);
    // Pre-fill the category the destinatario already implies, but
    // never overwrite a choice the user already made.
    if (id && !categoryId) {
      const preset = destinatarios.find((d) => d.id === id)?.default_category_id;
      if (preset) setCategoryId(preset);
    }
  }

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

  // A transfer needs its destination before it can be submitted; the row
  // above the button says "Elegir cuenta" in brass until one is picked.
  const missingDestination = isTransferMode && !destinationAccountId;

  return (
    <>
      {debtCover.dialog}
      <form
        action={formAction}
        className="space-y-4 pb-4"
        onKeyDown={(event) => {
          // The soft keyboard's Enter/"Ir" would implicitly submit this
          // single-submit-button form while the user is still typing the
          // description or the amount. Only the explicit button submits.
          if (event.key !== "Enter") return;
          const target = event.target;
          if (target instanceof HTMLInputElement) event.preventDefault();
        }}
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
          name={isTransferMode ? "fromAccountId" : "account_id"}
          value={selectedAccountId}
        />
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
        {selectedTagIds.map((id) => (
          <input key={id} type="hidden" name="tag_ids" value={id} />
        ))}

        {/* Transfer-only fields consumed by createTransfer */}
        {isTransferMode && (
          <>
            <input type="hidden" name="currencyCode" value={currencyCode} />
            <input type="hidden" name="date" value={transactionDate} />
            <input type="hidden" name="toAccountId" value={destinationAccountId} />
          </>
        )}
        {!isTransferMode && (
          <input type="hidden" name="destinatario_id" value={destinatarioId ?? ""} />
        )}

        {/* Direction selector — only shown when no preset */}
        {showTypeSelector && (
          <div className="flex gap-1 rounded-full border border-white/6 bg-white/[0.03] p-1">
            {TRANSACTION_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTypeChange(t.id)}
                aria-pressed={transactionType === t.id}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5",
                  transactionType === t.id
                    ? SEGMENTED_TAB_ACTIVE_CLASS
                    : SEGMENTED_TAB_CLASS,
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Amount */}
        <AmountInput
          name="amount"
          currency={currencyCode}
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

        {/* ── CLASIFICACIÓN — same rows as the detail page ─────── */}
        <SectionEyebrow>Clasificación</SectionEyebrow>

        <ClassificationCard>
          {/* Cuenta (origen for transfers) */}
          <ClassificationRow
            label={isTransferMode ? "Cuenta origen" : "Cuenta"}
            onClick={() => setAccountOpen(true)}
          >
            {selectedAccount ? (
              <ClassificationAccountValue
                name={selectedAccount.name}
                color={selectedAccount.color}
              />
            ) : (
              <ClassificationPrompt>Elegir cuenta</ClassificationPrompt>
            )}
          </ClassificationRow>

          {/* Cuenta destino — transfers only */}
          {isTransferMode && (
            <ClassificationRow
              label="Cuenta destino"
              onClick={() => setDestinationOpen(true)}
            >
              {destinationAccount ? (
                <ClassificationAccountValue
                  name={destinationAccount.name}
                  color={destinationAccount.color}
                />
              ) : (
                <ClassificationPrompt>Elegir cuenta</ClassificationPrompt>
              )}
            </ClassificationRow>
          )}

          {/* Categoría — not used for transfers */}
          {!isTransferMode && (
            <ClassificationRow label="Categoría" onClick={() => setCatOpen(true)}>
              {selectedCategory ? (
                <ClassificationCategoryValue category={selectedCategory} />
              ) : (
                <ClassificationPrompt>Categorizar</ClassificationPrompt>
              )}
            </ClassificationRow>
          )}

          {/* Destinatario — not used for transfers */}
          {!isTransferMode && (
            <ClassificationRow label="Destinatario" onClick={() => setDestOpen(true)}>
              {destinatarioSelectedName ? (
                <ClassificationDestinatarioValue name={destinatarioSelectedName} />
              ) : (
                <ClassificationPrompt muted>Asignar</ClassificationPrompt>
              )}
            </ClassificationRow>
          )}

          {/* Etiquetas */}
          <ClassificationTagsRow
            tags={selectedTags}
            onAdd={() => setTagOpen(true)}
            onRemove={(tagId) =>
              setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))
            }
          />
        </ClassificationCard>

        {isTransferMode && (
          <p className="text-xs text-muted-foreground">
            Se registrará una salida en la cuenta origen y una entrada en la
            cuenta destino.
          </p>
        )}

        {/* Controlled pickers driven by the rows above */}
        <AccountPickerDrawer
          open={accountOpen}
          onOpenChange={setAccountOpen}
          accounts={accounts}
          value={selectedAccountId}
          onSelect={handleAccountSelect}
          title={isTransferMode ? "Cuenta origen" : "Cuenta"}
        />
        {isTransferMode && (
          <AccountPickerDrawer
            open={destinationOpen}
            onOpenChange={setDestinationOpen}
            accounts={destinationAccounts}
            value={destinationAccountId || null}
            onSelect={(id) => {
              setDestinationAccountId(id);
              setDestinationOpen(false);
            }}
            title="Cuenta destino"
            emptyMessage="No hay otra cuenta en la misma moneda."
          />
        )}
        {!isTransferMode && (
          <>
            <CategoryZonePicker
              categories={categories}
              value={categoryId}
              onValueChange={handleCategorySelect}
              direction={direction}
              name="category_id"
              hideTrigger
              controlledOpen={catOpen}
              onControlledOpenChange={setCatOpen}
            />
            <DestinatarioZonePicker
              value={destinatarioId}
              selectedName={destinatarioSelectedName}
              onValueChange={handleDestinatarioSelect}
              hideTrigger
              controlledOpen={destOpen}
              onControlledOpenChange={setDestOpen}
              categories={categories}
              merchantName={merchantName}
            />
          </>
        )}
        <TagZonePicker
          selectedTagIds={selectedTagIds}
          onSelectedTagIdsChange={setSelectedTagIds}
          hideTrigger
          controlledOpen={tagOpen}
          onControlledOpenChange={setTagOpen}
        />

        {allowRelatedSetup && (
          <>
            <Collapsible
              open={advancedOpen}
              onOpenChange={setAdvancedOpen}
              className="rounded-2xl border border-white/6 bg-z-surface-2/60"
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

              <CollapsibleContent className="space-y-4 border-t border-white/6 px-4 py-4">
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

                {/* Same row shape as "Es una suscripción" above — the old
                    flex-col dropped the switch below-left on mobile, so the two
                    toggles in one panel used two different layouts. */}
                <div className="flex items-center gap-3">
                  <CalendarClock className="size-[18px] shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="mobile-create_recurring_template"
                      className="cursor-pointer text-sm font-medium"
                    >
                      Crear pago recurrente
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
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
          disabled={pending || missingDestination}
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
    </>
  );
}
