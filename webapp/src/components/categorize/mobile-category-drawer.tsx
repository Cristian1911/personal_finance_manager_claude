"use client";

import { useState, useEffect } from "react";
import { Check, ChevronRight, User } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  // Reset state when transaction changes — pre-select suggestion if available
  useEffect(() => {
    setSelectedCategoryId(suggestion?.category_id ?? null);
    setApplySimilar(false);
    setExpandedParent(null);
  }, [transaction?.id, suggestion?.category_id]);

  if (!transaction) return null;

  const isOutflow = transaction.direction === "OUTFLOW";
  const amountColor = isOutflow ? "text-z-debt" : "text-z-sage-light";

  // Flat list of parent categories (no parent_id or top-level)
  const parentCategories = categories.filter((c) => !c.parent_id);

  const handleCategoryTap = (cat: CategoryWithChildren) => {
    if (cat.children && cat.children.length > 0) {
      // Toggle expand
      setExpandedParent(expandedParent === cat.id ? null : cat.id);
    } else {
      // Leaf — select it
      setSelectedCategoryId(cat.id);
      setExpandedParent(null);
    }
  };

  const handleSubcategoryTap = (catId: string) => {
    setSelectedCategoryId(catId);
    setExpandedParent(null);
  };

  const handleConfirm = () => {
    if (!selectedCategoryId) return;
    onConfirm(selectedCategoryId, applySimilar);
  };

  // Find expanded parent's children
  const expandedChildren = expandedParent
    ? parentCategories.find((c) => c.id === expandedParent)?.children ?? []
    : [];

  // Resolve selected name for display
  const findCategoryName = (id: string): string => {
    for (const parent of parentCategories) {
      if (parent.id === id) return parent.name_es ?? parent.name;
      for (const child of parent.children) {
        if (child.id === id) return child.name_es ?? child.name;
      }
    }
    return id;
  };

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
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Destinatario suggestion banner */}
          {destinatarioSuggestion && (
            <div className="rounded-xl border border-z-brass/20 bg-z-brass/8 px-3 py-2 flex items-center gap-2">
              <User className="size-4 text-z-brass shrink-0" />
              <p className="text-xs text-z-brass leading-snug">
                Posible destinatario: <span className="font-semibold">{destinatarioSuggestion.destinatario_name}</span>
              </p>
            </div>
          )}

          {/* Category grid */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Categoría
            </p>
            <div className="grid grid-cols-3 gap-2">
              {parentCategories.map((cat) => {
                const isSuggested = suggestion?.category_id === cat.id ||
                  cat.children.some((c) => c.id === suggestion?.category_id);
                const isSelected = selectedCategoryId === cat.id ||
                  cat.children.some((c) => c.id === selectedCategoryId);
                const isExpanded = expandedParent === cat.id;
                const hasChildren = cat.children.length > 0;

                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryTap(cat)}
                    className={cn(
                      "relative rounded-xl border px-2 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-z-brass/50 bg-z-brass/12 text-z-brass"
                        : isSuggested
                          ? "border-z-brass/30 bg-z-brass/6 text-foreground"
                          : "border-white/6 bg-black/10 text-foreground",
                      isExpanded && "border-z-sage-dark/30 bg-z-sage-dark/8"
                    )}
                  >
                    <span className="text-base leading-none mb-1 block">{cat.icon}</span>
                    <span className="text-[11px] font-medium leading-tight line-clamp-2">
                      {cat.name_es ?? cat.name}
                    </span>
                    {hasChildren && (
                      <ChevronRight
                        className={cn(
                          "absolute top-2 right-1.5 size-3 text-muted-foreground/50 transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                    )}
                    {isSuggested && !isSelected && (
                      <span className="absolute -top-1 -right-1 size-2 rounded-full bg-z-brass" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Subcategory expansion */}
            {expandedParent && expandedChildren.length > 0 && (
              <div className="mt-2 rounded-xl border border-white/6 bg-black/5 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 px-1">
                  {findCategoryName(expandedParent)} — subcategorías
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {expandedChildren.map((sub) => {
                    const isSubSuggested = suggestion?.category_id === sub.id;
                    const isSubSelected = selectedCategoryId === sub.id;

                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSubcategoryTap(sub.id)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          isSubSelected
                            ? "border-z-brass/50 bg-z-brass/12 text-z-brass font-medium"
                            : isSubSuggested
                              ? "border-z-brass/30 bg-z-brass/6 text-foreground"
                              : "border-white/6 bg-black/10 text-foreground"
                        )}
                      >
                        <span className="text-sm mr-1">{sub.icon}</span>
                        <span className="text-[11px]">{sub.name_es ?? sub.name}</span>
                        {isSubSuggested && (
                          <span className="ml-1 text-[9px] font-semibold text-z-brass uppercase tracking-wide">
                            Sugerida
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Suggestion chip if category not yet visible in grid */}
          {suggestion && !selectedCategoryId && (
            <div className="rounded-xl border border-z-brass/20 bg-z-brass/8 px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-z-brass">
                Sugerencia: <span className="font-semibold">{findCategoryName(suggestion.category_id)}</span>
              </span>
              <button
                onClick={() => setSelectedCategoryId(suggestion.category_id)}
                className="ml-auto text-[11px] font-semibold text-z-brass underline-offset-2 hover:underline"
              >
                Usar
              </button>
            </div>
          )}

          {/* Apply to similar toggle */}
          {similarCount > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5">
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
                Confirmar — {findCategoryName(selectedCategoryId)}
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
