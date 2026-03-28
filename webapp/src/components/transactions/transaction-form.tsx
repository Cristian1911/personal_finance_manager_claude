"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { createTransaction, updateTransaction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import type { ActionResult } from "@/types/actions";
import type { Account, CategoryWithChildren, Transaction, TransactionDirection } from "@/types/domain";

const FREQUENCY_OPTIONS = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "ANNUAL", label: "Anual" },
] as const;

export function TransactionForm({
  transaction,
  accounts,
  categories,
  onSuccess,
}: {
  transaction?: Transaction;
  accounts: Account[];
  categories: CategoryWithChildren[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const action = transaction
    ? updateTransaction.bind(null, transaction.id)
    : createTransaction;

  const [state, formAction, pending] = useActionState<
    ActionResult<Transaction>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await action(prevState, formData);
      if (result.success) {
        router.refresh();
        onSuccess?.();
      }
      return result;
    },
    { success: false, error: "" }
  );

  const defaultAccount = accounts[0];
  const defaultDate =
    transaction?.transaction_date ?? new Date().toISOString().split("T")[0];
  const [direction, setDirection] = useState<TransactionDirection>(
    transaction?.direction ?? "OUTFLOW"
  );
  const [selectedAccountId, setSelectedAccountId] = useState(
    transaction?.account_id ?? defaultAccount?.id ?? ""
  );
  const [transactionDate, setTransactionDate] = useState(defaultDate);
  const [merchantName, setMerchantName] = useState(transaction?.merchant_name ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    transaction?.category_id ?? null
  );
  const [isSubscription, setIsSubscription] = useState(
    transaction?.is_subscription ?? false
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createDestinatarioSetup, setCreateDestinatarioSetup] = useState(false);
  const [destinatarioName, setDestinatarioName] = useState(
    transaction?.merchant_name ?? ""
  );
  const [createRecurringSetup, setCreateRecurringSetup] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<
    (typeof FREQUENCY_OPTIONS)[number]["value"]
  >("MONTHLY");
  const [recurringStartDate, setRecurringStartDate] = useState(defaultDate);
  const [recurringTransferSourceAccountId, setRecurringTransferSourceAccountId] =
    useState("");
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? defaultAccount;
  const isDebtAccount =
    selectedAccount?.account_type === "CREDIT_CARD" ||
    selectedAccount?.account_type === "LOAN";
  const allowRelatedSetup = !transaction;

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
        setRecurringStartDate(transactionDate);
      }
    } else {
      setRecurringTransferSourceAccountId("");
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {!state.success && state.error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="direction">Tipo</Label>
          <Select
            name="direction"
            value={direction}
            onValueChange={(v) => setDirection(v as TransactionDirection)}
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
          <CurrencyInput
            id="amount"
            name="amount"
            defaultValue={transaction?.amount}
            placeholder="0"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="account_id">Cuenta</Label>
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

        <div className="space-y-2">
          <Label htmlFor="transaction_date">Fecha</Label>
          <Input
            id="transaction_date"
            name="transaction_date"
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value)}
            required
          />
        </div>
      </div>

      <input
        type="hidden"
        name="currency_code"
        value={selectedAccount?.currency_code ?? transaction?.currency_code ?? "COP"}
      />
      <input
        type="hidden"
        name="is_subscription"
        value={isSubscription ? "true" : "false"}
      />

      <div className="space-y-2">
        <Label htmlFor="merchant_name">Descripción / Comercio</Label>
        <Input
          id="merchant_name"
          name="merchant_name"
          value={merchantName}
          onChange={(event) => setMerchantName(event.target.value)}
          placeholder="Ej: Supermercado Éxito"
        />
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Input
          id="notes"
          name="notes"
          defaultValue={transaction?.notes ?? ""}
          placeholder="Nota opcional"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor="is_subscription" className="cursor-pointer">
            Marcar como suscripción
          </Label>
          <p className="text-xs text-muted-foreground">
            Úsalo para pagos periódicos como streaming, software o membresías.
          </p>
        </div>
        <Switch
          id="is_subscription"
          checked={isSubscription}
          onCheckedChange={setIsSubscription}
        />
      </div>

      {allowRelatedSetup && (
        <>
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
                    Guarda esta transacción y deja listo el destinatario o el pago recurrente.
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    advancedOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent forceMount className="space-y-4 border-t px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="create_destinatario" className="cursor-pointer">
                    Crear destinatario
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Te ayuda a reutilizar este comercio en futuras categorizaciones.
                  </p>
                </div>
                <Switch
                  id="create_destinatario"
                  checked={createDestinatarioSetup}
                  onCheckedChange={handleCreateDestinatarioSetup}
                />
              </div>

              {createDestinatarioSetup && (
                <div className="space-y-2">
                  <Label htmlFor="destinatario_name">Nombre del destinatario</Label>
                  <Input
                    id="destinatario_name"
                    value={destinatarioName}
                    onChange={(event) => setDestinatarioName(event.target.value)}
                    placeholder="Ej: Netflix"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usaremos la descripción actual como patrón inicial para reconocerlo después.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="create_recurring_template" className="cursor-pointer">
                    Crear pago recurrente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Si esto se repite, deja lista una plantilla desde esta misma captura.
                  </p>
                </div>
                <Switch
                  id="create_recurring_template"
                  checked={createRecurringSetup}
                  onCheckedChange={handleCreateRecurringSetup}
                />
              </div>

              {createRecurringSetup && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="recurring_frequency">Frecuencia</Label>
                      <Select
                        value={recurringFrequency}
                        onValueChange={(value) =>
                          setRecurringFrequency(
                            value as (typeof FREQUENCY_OPTIONS)[number]["value"]
                          )
                        }
                      >
                        <SelectTrigger id="recurring_frequency">
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
                      <Label htmlFor="recurring_start_date">Fecha de inicio</Label>
                      <Input
                        id="recurring_start_date"
                        type="date"
                        value={recurringStartDate}
                        onChange={(event) => setRecurringStartDate(event.target.value)}
                      />
                    </div>
                  </div>

                  {isDebtAccount && (
                    <div className="space-y-2">
                      <Label htmlFor="recurring_transfer_source_account_id">
                        Cuenta origen del pago
                      </Label>
                      <Select
                        value={recurringTransferSourceAccountId}
                        onValueChange={setRecurringTransferSourceAccountId}
                      >
                        <SelectTrigger id="recurring_transfer_source_account_id">
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

      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Guardando..."
          : transaction
            ? "Actualizar transacción"
            : "Crear transacción"}
      </Button>
    </form>
  );
}
