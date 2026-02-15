"use client";

import { useActionState } from "react";
import { createTransaction, updateTransaction } from "@/actions/transactions";
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
import type { Account, Category, Transaction } from "@/types/domain";

export function TransactionForm({
  transaction,
  accounts,
  categories,
  onSuccess,
}: {
  transaction?: Transaction;
  accounts: Account[];
  categories: Category[];
  onSuccess?: () => void;
}) {
  const action = transaction
    ? updateTransaction.bind(null, transaction.id)
    : createTransaction;

  const [state, formAction, pending] = useActionState<
    ActionResult<Transaction>,
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="direction">Tipo</Label>
          <Select
            name="direction"
            defaultValue={transaction?.direction ?? "OUTFLOW"}
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
            defaultValue={transaction?.amount}
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
            defaultValue={transaction?.account_id ?? defaultAccount?.id}
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
            defaultValue={
              transaction?.transaction_date ??
              new Date().toISOString().split("T")[0]
            }
            required
          />
        </div>
      </div>

      <input
        type="hidden"
        name="currency_code"
        value={
          transaction?.currency_code ?? defaultAccount?.currency_code ?? "COP"
        }
      />

      <div className="space-y-2">
        <Label htmlFor="merchant_name">Descripción / Comercio</Label>
        <Input
          id="merchant_name"
          name="merchant_name"
          defaultValue={transaction?.merchant_name ?? ""}
          placeholder="Ej: Supermercado Éxito"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category_id">Categoría</Label>
        <Select
          name="category_id"
          defaultValue={transaction?.category_id ?? ""}
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
        <Label htmlFor="notes">Notas</Label>
        <Input
          id="notes"
          name="notes"
          defaultValue={transaction?.notes ?? ""}
          placeholder="Nota opcional"
        />
      </div>

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
