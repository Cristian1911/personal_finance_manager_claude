"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { autoCategorize, parseQuickCaptureText } from "@venti5/shared";
import { Sparkles, Wand2 } from "lucide-react";
import { createQuickCaptureTransaction } from "@/actions/transactions";
import { trackClientEvent } from "@/lib/utils/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import type { ActionResult } from "@/types/actions";
import type { Account, CategoryWithChildren, Transaction, TransactionDirection } from "@/types/domain";

const STORAGE_KEY = "venti5:quick-capture-default-account";

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

export function QuickCaptureBar({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: CategoryWithChildren[];
}) {
  const [input, setInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
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
        await trackClientEvent({
          event_name: "quick_capture_saved",
          flow: "categorize",
          step: "persist",
          entry_point: "cta",
          success: true,
          metadata: {
            capture_method: "TEXT_QUICK_CAPTURE",
          },
        });
        setDialogOpen(false);
        setInput("");
        setPreview(null);
      }
      return result;
    },
    { success: false, error: "" }
  );

  function handleOpenPreview() {
    const result = parseQuickCaptureText(input);
    if (!result.success) {
      setParseError(result.error);
      void trackClientEvent({
        event_name: "quick_capture_parse_failed",
        flow: "categorize",
        step: "parse",
        entry_point: "cta",
        success: false,
        error_code: "parse_failed",
        metadata: {
          parse_confidence: result.confidence,
        },
      });
      return;
    }

    const suggestedCategoryId =
      autoCategorize(result.data.merchant_name)?.category_id ?? null;

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
    setDialogOpen(true);
    window.localStorage.setItem(STORAGE_KEY, defaultAccountId);
    void trackClientEvent({
      event_name: "quick_capture_parsed",
      flow: "categorize",
      step: "parse",
      entry_point: "cta",
      success: true,
      metadata: {
        parse_confidence: result.data.confidence,
      },
    });
  }

  return (
    <>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Captura rápida
            </div>
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleOpenPreview();
                }
              }}
              placeholder='Ej: gasté 15k en café ayer'
            />
            {parseError && (
              <p className="mt-2 text-xs text-destructive">{parseError}</p>
            )}
          </div>
          <Button type="button" onClick={handleOpenPreview} disabled={!input.trim()}>
            <Wand2 className="mr-2 h-4 w-4" />
            Revisar
          </Button>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (open) {
            void trackClientEvent({
              event_name: "quick_capture_opened",
              flow: "categorize",
              step: "preview",
              entry_point: "cta",
              success: true,
            });
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar captura rápida</DialogTitle>
          </DialogHeader>
          {preview && (
            <form action={formAction} className="space-y-4">
              {!state.success && state.error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {state.error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="direction">Tipo</Label>
                  <Select
                    name="direction"
                    value={preview.direction}
                    onValueChange={(value) =>
                      setPreview((prev) =>
                        prev ? { ...prev, direction: value as TransactionDirection } : prev
                      )
                    }
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
                    value={preview.amount}
                    onChange={(event) =>
                      setPreview((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_id">Cuenta</Label>
                  <Select
                    name="account_id"
                    value={preview.account_id}
                    onValueChange={(value) => {
                      setPreview((prev) => (prev ? { ...prev, account_id: value } : prev));
                      window.localStorage.setItem(STORAGE_KEY, value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
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
                    value={preview.transaction_date}
                    onChange={(event) =>
                      setPreview((prev) =>
                        prev ? { ...prev, transaction_date: event.target.value } : prev
                      )
                    }
                    required
                  />
                </div>
              </div>

              <input
                type="hidden"
                name="currency_code"
                value={
                  accounts.find((account) => account.id === preview.account_id)?.currency_code ??
                  selectedAccount?.currency_code ??
                  "COP"
                }
              />

              <div className="space-y-2">
                <Label htmlFor="merchant_name">Descripción</Label>
                <Input
                  id="merchant_name"
                  name="merchant_name"
                  value={preview.merchant_name}
                  onChange={(event) =>
                    setPreview((prev) =>
                      prev ? { ...prev, merchant_name: event.target.value } : prev
                    )
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Categoría</Label>
                <CategoryCombobox
                  categories={categories}
                  value={preview.category_id}
                  onValueChange={(value) =>
                    setPreview((prev) => (prev ? { ...prev, category_id: value } : prev))
                  }
                  direction={preview.direction}
                  name="category_id"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Input
                  id="notes"
                  name="notes"
                  value={preview.notes}
                  onChange={(event) =>
                    setPreview((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                  }
                  placeholder="Nota opcional"
                />
              </div>

              <input type="hidden" name="raw_description" value={preview.raw_description} />
              <input
                type="hidden"
                name="capture_input_text"
                value={preview.capture_input_text}
              />

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Guardando..." : "Guardar captura rápida"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
