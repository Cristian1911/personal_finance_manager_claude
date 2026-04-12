"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { autoCategorize, parseQuickCaptureText } from "@zeta/shared";
import { Wand2 } from "lucide-react";
import { createQuickCaptureTransaction } from "@/actions/transactions";
import { trackClientEvent } from "@/lib/utils/analytics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
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
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import type { ActionResult } from "@/types/actions";
import type { Account, CategoryWithChildren, Transaction, TransactionDirection } from "@/types/domain";

const STORAGE_KEY = "zeta:quick-capture-default-account";

type PreviewState = {
  amount: string;
  direction: TransactionDirection;
  transaction_date: string;
  merchant_name: string;
  raw_description: string;
  category_id: string | null;
  notes: string;
  account_id: string;
  capture_input_text: string;
};

export function MobileQuickCaptureSheet({
  accounts,
  categories,
  onSuccess,
}: {
  accounts: Account[];
  categories: CategoryWithChildren[];
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && accounts.some((account) => account.id === stored)) {
      setSelectedAccountId(stored);
    }
  }, [accounts]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? accounts[0],
    [accounts, selectedAccountId]
  );

  const [state, formAction, pending] = useActionState<ActionResult<Transaction>, FormData>(
    async (prevState, formData) => {
      const result = await createQuickCaptureTransaction(prevState, formData);
      if (result.success) {
        router.refresh();
        await trackClientEvent({
          event_name: "quick_capture_saved",
          flow: "categorize",
          step: "persist",
          entry_point: "fab",
          success: true,
          metadata: { capture_method: "TEXT_QUICK_CAPTURE" },
        });
        onSuccess();
      }
      return result;
    },
    { success: false, error: "" }
  );

  function handleParse() {
    const result = parseQuickCaptureText(input);
    if (!result.success) {
      setParseError(result.error);
      return;
    }

    const suggestedCategoryId = autoCategorize(result.data.merchant_name)?.category_id ?? null;
    const defaultAccountId = selectedAccount?.id ?? accounts[0]?.id ?? "";
    if (!defaultAccountId) {
      setParseError("Crea una cuenta primero para usar la captura rápida.");
      return;
    }

    setParseError(null);
    setPreview({
      amount: String(result.data.amount),
      direction: result.data.direction,
      transaction_date: result.data.transaction_date,
      merchant_name: result.data.merchant_name,
      raw_description: result.data.raw_description,
      category_id: suggestedCategoryId,
      notes: "",
      account_id: defaultAccountId,
      capture_input_text: result.data.capture_input_text,
    });
    window.localStorage.setItem(STORAGE_KEY, defaultAccountId);
  }

  if (!preview) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escribe tu gasto en lenguaje natural y Zeta lo interpreta.
        </p>
        <Input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleParse();
            }
          }}
          placeholder='Ej: gasté 15k en café ayer'
        />
        {parseError && (
          <p className="text-xs text-destructive">{parseError}</p>
        )}
        <Button type="button" onClick={handleParse} disabled={!input.trim()} className={cn("w-full", BRASS_BUTTON_CLASS)}>
          <Wand2 className="mr-2 size-4" />
          Interpretar
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {!state.success && state.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="direction" className="text-xs">Tipo</Label>
          <Select
            name="direction"
            value={preview.direction}
            onValueChange={(value) =>
              setPreview((prev) => prev ? { ...prev, direction: value as TransactionDirection } : prev)
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OUTFLOW">Gasto</SelectItem>
              <SelectItem value="INFLOW">Ingreso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs">Monto</Label>
          <CurrencyInput
            id="amount"
            name="amount"
            value={preview.amount}
            onChange={(e) => setPreview((prev) => prev ? { ...prev, amount: e.target.value } : prev)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="account_id" className="text-xs">Cuenta</Label>
          <Select
            name="account_id"
            value={preview.account_id}
            onValueChange={(value) => {
              setPreview((prev) => prev ? { ...prev, account_id: value } : prev);
              window.localStorage.setItem(STORAGE_KEY, value);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Cuenta" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha</Label>
          <DatePicker
            value={preview.transaction_date}
            onChange={(v) => setPreview((prev) => prev ? { ...prev, transaction_date: v ?? "" } : prev)}
            name="transaction_date"
            placeholder="Fecha"
          />
        </div>
      </div>

      <input
        type="hidden"
        name="currency_code"
        value={
          accounts.find((a) => a.id === preview.account_id)?.currency_code ??
          selectedAccount?.currency_code ??
          "COP"
        }
      />

      <div className="space-y-1.5">
        <Label htmlFor="merchant_name" className="text-xs">Descripción</Label>
        <Input
          id="merchant_name"
          name="merchant_name"
          value={preview.merchant_name}
          onChange={(e) => setPreview((prev) => prev ? { ...prev, merchant_name: e.target.value } : prev)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Categoría</Label>
        <CategoryZonePicker
          variant="popover"
          categories={categories}
          value={preview.category_id}
          onValueChange={(value) => setPreview((prev) => prev ? { ...prev, category_id: value } : prev)}
          direction={preview.direction}
          name="category_id"
        />
      </div>

      <input type="hidden" name="raw_description" value={preview.raw_description} />
      <input type="hidden" name="capture_input_text" value={preview.capture_input_text} />
      <input type="hidden" name="notes" value="" />

      <Button type="submit" className={cn("w-full", BRASS_BUTTON_CLASS)} disabled={pending}>
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
