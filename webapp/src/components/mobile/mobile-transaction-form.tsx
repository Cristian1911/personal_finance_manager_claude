"use client";

import { useState, useMemo, useEffect, useActionState } from "react";
import { Loader2 } from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { CategoryCombobox } from "@/components/ui/category-combobox";
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
  defaultDirection: TransactionDirection;
  isTransfer?: boolean;
  onSuccess?: () => void;
}

export function MobileTransactionForm({
  accounts,
  categories,
  defaultDirection,
  isTransfer,
  onSuccess,
}: MobileTransactionFormProps) {
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
    // Only use saved value if it matches a current account
    if (saved && accounts.some((a) => a.id === saved)) return saved;
    return accounts[0]?.id ?? "";
  });

  useEffect(() => {
    if (selectedAccountId) {
      localStorage.setItem(STORAGE_KEY, selectedAccountId);
    }
  }, [selectedAccountId]);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const currencyCode = useMemo(() => {
    const account = accounts.find((a) => a.id === selectedAccountId);
    return account?.currency_code ?? "COP";
  }, [accounts, selectedAccountId]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={formAction} className="space-y-4">
      {!state.success && state.error && (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {state.error}
        </div>
      )}

      {/* Hidden fields */}
      <input type="hidden" name="direction" value={defaultDirection} />
      <input type="hidden" name="transaction_date" value={today} />
      <input type="hidden" name="currency_code" value={currencyCode} />

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="mobile-amount">Monto</Label>
        <CurrencyInput
          id="mobile-amount"
          name="amount"
          placeholder="0"
          required
          autoFocus
          className="h-12 text-lg"
        />
      </div>

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
          direction={defaultDirection}
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
        ) : isTransfer ? (
          "Registrar transferencia"
        ) : defaultDirection === "OUTFLOW" ? (
          "Registrar gasto"
        ) : (
          "Registrar ingreso"
        )}
      </Button>
    </form>
  );
}
