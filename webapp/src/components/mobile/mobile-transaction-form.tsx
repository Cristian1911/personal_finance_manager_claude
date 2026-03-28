"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AmountInput } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types/actions";
import type {
  Account,
  CategoryWithChildren,
  Transaction,
  TransactionDirection,
} from "@/types/domain";

interface MobileTransactionFormProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  defaultDirection?: TransactionDirection;
  isTransfer?: boolean;
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
  onSuccess,
}: MobileTransactionFormProps) {
  const router = useRouter();
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

  const [state, formAction, pending] = useActionState<
    ActionResult<Transaction>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await createTransaction(prevState, formData);
      if (result.success) {
        router.refresh();
        onSuccess?.();
      }
      return result;
    },
    { success: false, error: "" },
  );

  const STORAGE_KEY = "zeta:quick-capture-account";
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
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

  const today = new Date().toISOString().split("T")[0];
  const [merchantName, setMerchantName] = useState("");
  const [isSubscription, setIsSubscription] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createDestinatarioSetup, setCreateDestinatarioSetup] = useState(false);
  const [destinatarioName, setDestinatarioName] = useState("");
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
      setIsSubscription(false);
      setCreateDestinatarioSetup(false);
      setCreateRecurringSetup(false);
      setAdvancedOpen(false);
      setRecurringTransferSourceAccountId("");
    }
  }, [transactionType]);

  function handleCreateDestinatarioSetup(checked: boolean) {
    setCreateDestinatarioSetup(checked);

    if (checked) {
      setAdvancedOpen(true);
      if (!destinatarioName.trim()) {
        setDestinatarioName(merchantName.trim());
      }
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

  return (
    <form action={formAction} className="space-y-4">
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
      <input type="hidden" name="transaction_date" value={today} />
      <input type="hidden" name="currency_code" value={currencyCode} />
      <input
        type="hidden"
        name="is_subscription"
        value={isSubscription ? "true" : "false"}
      />
      <input
        type="hidden"
        name="create_destinatario"
        value={createDestinatarioSetup ? "true" : "false"}
      />
      <input
        type="hidden"
        name="create_recurring_template"
        value={createRecurringSetup ? "true" : "false"}
      />
      <input type="hidden" name="destinatario_name" value={destinatarioName} />
      <input type="hidden" name="recurring_frequency" value={recurringFrequency} />
      <input type="hidden" name="recurring_start_date" value={recurringStartDate} />
      <input
        type="hidden"
        name="recurring_transfer_source_account_id"
        value={recurringTransferSourceAccountId}
      />

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

      {/* Description */}
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

      {/* Account */}
      <div className="space-y-2">
        <Label htmlFor="mobile-account">Cuenta</Label>
        <Select
          name="account_id"
          value={selectedAccountId}
          onValueChange={(value) => {
            setSelectedAccountId(value);

            if (recurringTransferSourceAccountId === value) {
              setRecurringTransferSourceAccountId("");
            }
          }}
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

      {/* Category */}
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

      {allowRelatedSetup && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="mobile-is_subscription" className="cursor-pointer">
                Marcar como suscripción
              </Label>
              <p className="text-xs text-muted-foreground">
                Para cobros periódicos como streaming o software.
              </p>
            </div>
            <Switch
              id="mobile-is_subscription"
              checked={isSubscription}
              onCheckedChange={setIsSubscription}
            />
          </div>

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
                  <p className="text-sm font-medium">Opciones relacionadas</p>
                  <p className="text-xs text-muted-foreground">
                    Expande para crear un destinatario o sembrar este gasto como recurrente.
                  </p>
                </div>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    advancedOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent forceMount className="space-y-4 border-t px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="mobile-create_destinatario" className="cursor-pointer">
                    Crear destinatario
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Guarda este comercio para reconocerlo más rápido la próxima vez.
                  </p>
                </div>
                <Switch
                  id="mobile-create_destinatario"
                  checked={createDestinatarioSetup}
                  onCheckedChange={handleCreateDestinatarioSetup}
                />
              </div>

              {createDestinatarioSetup && (
                <div className="space-y-2">
                  <Label htmlFor="mobile-destinatario_name">Nombre del destinatario</Label>
                  <Input
                    id="mobile-destinatario_name"
                    value={destinatarioName}
                    onChange={(event) => setDestinatarioName(event.target.value)}
                    placeholder="Ej: Netflix"
                  />
                </div>
              )}

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
                      <Label htmlFor="mobile-recurring_start_date">Fecha de inicio</Label>
                      <Input
                        id="mobile-recurring_start_date"
                        type="date"
                        value={recurringStartDate}
                        onChange={(event) => setRecurringStartDate(event.target.value)}
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
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

      {/* Submit */}
      <Button type="submit" className="h-12 w-full" disabled={pending}>
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
