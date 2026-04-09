"use client";

import { useState, useEffect } from "react";
import { Check, User } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CategoryPickerBody } from "@/components/categories/category-zone-picker";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { TransactionWithRelations, CategoryWithChildren } from "@/types/domain";
import type { CategorizationResult } from "@zeta/shared";

interface MobileCategoryDrawerProps {
  transaction: TransactionWithRelations | null;
  suggestion: CategorizationResult | null;
  categories: CategoryWithChildren[];
  similarCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (categoryId: string, applySimilar: boolean) => void;
  isPending: boolean;
  destinatarioSuggestion?: {
    destinatario_id: string;
    destinatario_name: string;
    category_id: string | null;
  } | null;
}

export function MobileCategoryDrawer({
  transaction,
  suggestion,
  categories,
  similarCount,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  destinatarioSuggestion,
}: MobileCategoryDrawerProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [applySimilar, setApplySimilar] = useState(false);

  // Reset state when transaction changes — pre-select suggestion if available
  useEffect(() => {
    setSelectedCategoryId(suggestion?.category_id ?? null);
    setApplySimilar(false);
  }, [transaction?.id, suggestion?.category_id]);

  const handleConfirm = () => {
    if (!selectedCategoryId) return;
    onConfirm(selectedCategoryId, applySimilar);
  };

  if (!transaction) return null;

  const isOutflow = transaction.direction === "OUTFLOW";
  const amountColor = isOutflow ? "text-z-debt" : "text-z-sage-light";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh] overflow-hidden flex flex-col">
        {/* Transaction summary */}
        <DrawerHeader className="pb-3 border-b border-white/6">
          <DrawerTitle className="sr-only">Categorizar movimiento</DrawerTitle>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-base leading-tight">
                {transaction.merchant_name ?? transaction.clean_description ?? transaction.raw_description ?? "Sin descripción"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {transaction.account.name} · {formatDate(transaction.transaction_date)}
              </p>
            </div>
            <p className={cn("text-base font-semibold shrink-0 tabular-nums", amountColor)}>
              {isOutflow ? "−" : "+"}{formatCurrency(transaction.amount, transaction.currency_code ?? "COP")}
            </p>
          </div>
        </DrawerHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Destinatario suggestion banner */}
          {destinatarioSuggestion && (
            <div className="mx-4 mt-3 rounded-xl border border-z-brass/20 bg-z-brass/8 px-3 py-2 flex items-center gap-2">
              <User className="size-4 text-z-brass shrink-0" />
              <p className="text-xs text-z-brass leading-snug">
                Posible destinatario: <span className="font-semibold">{destinatarioSuggestion.destinatario_name}</span>
              </p>
            </div>
          )}

          {/* Zone-based category picker */}
          <CategoryPickerBody
            categories={categories}
            value={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            onCategoryCreated={() => {}}
            suggestion={null}
            direction={transaction.direction}
          />

          {/* Apply to similar toggle */}
          {similarCount > 0 && (
            <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">
                  Aplicar a {similarCount} similares
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Misma categoría para transacciones del mismo comercio
                </p>
              </div>
              <Switch
                checked={applySimilar}
                onCheckedChange={setApplySimilar}
                size="sm"
                aria-label="Aplicar a transacciones similares"
              />
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 border-t border-white/6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            className={cn("w-full", BRASS_BUTTON_CLASS)}
            disabled={!selectedCategoryId || isPending}
            onClick={handleConfirm}
          >
            {selectedCategoryId ? (
              <>
                <Check className="size-4 mr-1.5" />
                Confirmar
              </>
            ) : (
              "Selecciona una categoría"
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
