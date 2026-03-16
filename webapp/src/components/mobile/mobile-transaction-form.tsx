"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import {
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
} from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { CategoryCombobox } from "@/components/ui/category-combobox";
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

export function MobileTransactionForm({
  accounts,
  categories,
  defaultDirection,
  isTransfer,
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

  const [state, formAction, pending] = useActionState<
    ActionResult<Transaction>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await createTransaction(prevState, formData);
      if (result.success) onSuccess?.();
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

  const today = new Date().toISOString().split("T")[0];

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
          placeholder="Ej: Almuerzo, Uber, Arriendo..."
        />
      </div>

      {/* Account */}
      <div className="space-y-2">
        <Label htmlFor="mobile-account">Cuenta</Label>
        <Select
          name="account_id"
          value={selectedAccountId}
          onValueChange={setSelectedAccountId}
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
