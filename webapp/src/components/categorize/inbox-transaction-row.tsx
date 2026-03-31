"use client";

import { useState } from "react";
import {
  Check,
  Lightbulb,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { TagPicker } from "@/components/tags/tag-picker";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { getCategoryName } from "@zeta/shared";

function findCategoryName(
  categories: CategoryWithChildren[],
  id: string
): string {
  for (const cat of categories) {
    if (cat.id === id) return cat.name_es ?? cat.name;
    for (const child of cat.children) {
      if (child.id === id) return child.name_es ?? child.name;
    }
  }
  return getCategoryName(id);
}
import type {
  TransactionWithRelations,
  CategoryWithChildren,
  CurrencyCode,
  TagGroupWithTags,
} from "@/types/domain";
import type { CategorizationResult } from "@zeta/shared";

interface InboxTransactionRowProps {
  transaction: TransactionWithRelations;
  suggestion: CategorizationResult | null;
  categories: CategoryWithChildren[];
  tagGroups?: TagGroupWithTags[];
  similarTransactions?: TransactionWithRelations[];
  isSelected: boolean;
  onToggleSelect: () => void;
  onCategorize: (categoryId: string, includeSimilarIds?: string[]) => void;
  isPending: boolean;
}

export function InboxTransactionRow({
  transaction: tx,
  suggestion,
  categories,
  tagGroups = [],
  similarTransactions = [],
  isSelected,
  onToggleSelect,
  onCategorize,
  isPending,
}: InboxTransactionRowProps) {
  const [manualValue, setManualValue] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

  const description =
    tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "Sin descripción";
  const isOutflow = tx.direction === "OUTFLOW";

  function handleSelectCategory(categoryId: string) {
    setPendingCategory(categoryId);
  }

  function handleConfirm() {
    if (!pendingCategory) return;
    onCategorize(pendingCategory);
    setPendingCategory(null);
  }

  function handleConfirmAll() {
    if (!pendingCategory) return;
    const similarIds = similarTransactions.map((t) => t.id);
    onCategorize(pendingCategory, similarIds);
    setPendingCategory(null);
  }

  function handleCancelConfirm() {
    setPendingCategory(null);
    setManualValue(null);
    setShowPicker(false);
  }

  const pendingCategoryName = pendingCategory
    ? findCategoryName(categories, pendingCategory)
    : null;

  // Confirmation panel state
  if (pendingCategory) {
    return (
      <div className="rounded-lg border border-z-brass/30 bg-z-surface-2/80 p-3 space-y-3 animate-in fade-in duration-150">
        {/* Header: transaction info */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                isOutflow
                  ? "bg-z-debt/10 text-z-debt"
                  : "bg-z-income/10 text-z-income"
              }`}
            >
              {isOutflow ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownLeft className="h-3.5 w-3.5" />
              )}
            </div>
            <p className="text-sm font-medium truncate">{description}</p>
          </div>
          <p
            className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
              isOutflow ? "text-z-debt" : "text-z-income"
            }`}
          >
            {isOutflow ? "-" : "+"}
            {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
          </p>
        </div>

        {/* Selected category */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Categoría:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-z-brass/30 bg-z-brass/10 px-2.5 py-0.5 text-xs font-medium text-z-brass">
            <Check className="h-3 w-3" />
            {pendingCategoryName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-muted-foreground"
            onClick={handleCancelConfirm}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Similar transactions */}
        {similarTransactions.length > 0 && (
          <div className="rounded-lg border border-white/6 bg-black/10 p-2 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground px-1">
              {similarTransactions.length}{" "}
              {similarTransactions.length === 1
                ? "transacción similar"
                : "transacciones similares"}
            </p>
            <div className="space-y-0.5">
              {similarTransactions.map((st) => {
                const stDesc =
                  st.merchant_name ?? st.clean_description ?? st.raw_description ?? "—";
                const stIsOutflow = st.direction === "OUTFLOW";
                return (
                  <div
                    key={st.id}
                    className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-muted-foreground">
                        {stDesc}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground/60">
                        {formatDate(st.transaction_date, "dd MMM")}
                      </span>
                    </div>
                    <span
                      className={`tabular-nums whitespace-nowrap ${
                        stIsOutflow ? "text-z-debt/70" : "text-z-income/70"
                      }`}
                    >
                      {stIsOutflow ? "-" : "+"}
                      {formatCurrency(st.amount, st.currency_code as CurrencyCode)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inline tag picker */}
        {showTags && tagGroups.length > 0 && (
          <TagPicker
            entityType="transaction"
            entityId={tx.id}
            currentTags={[]}
            allTagGroups={tagGroups}
          />
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {tagGroups.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                onClick={() => setShowTags((v) => !v)}
              >
                <Tag className="h-3 w-3" />
                Etiquetar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs text-muted-foreground"
              onClick={handleCancelConfirm}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 px-3 text-xs gap-1 bg-z-brass text-z-ink hover:bg-z-brass/90"
              onClick={handleConfirm}
              disabled={isPending}
            >
              <Check className="h-3 w-3" />
              Aplicar
            </Button>
            {similarTransactions.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs gap-1 border-z-brass/30 text-z-brass hover:bg-z-brass/10"
                onClick={handleConfirmAll}
                disabled={isPending}
              >
                Aplicar a {similarTransactions.length + 1}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default state: category selection
  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
      {/* Checkbox */}
      <div className="pt-0.5">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`Seleccionar ${description}`}
        />
      </div>

      {/* Direction icon */}
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isOutflow
            ? "bg-z-debt/10 text-z-debt"
            : "bg-z-income/10 text-z-income"
        }`}
      >
        {isOutflow ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownLeft className="h-4 w-4" />
        )}
      </div>

      {/* Transaction info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{description}</p>
          <p
            className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
              isOutflow ? "text-z-debt" : "text-z-income"
            }`}
          >
            {isOutflow ? "-" : "+"}
            {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
          </p>
        </div>

        {/* Account badge */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {tx.account && (
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tx.account.color ?? undefined }}
              />
              {tx.account.name}
            </span>
          )}
          {similarTransactions.length > 0 && (
            <span className="rounded-full border px-2 py-0.5 text-[11px]">
              {similarTransactions.length + 1} similares
            </span>
          )}
        </div>

        {/* Suggestion or manual pick */}
        <div className="flex items-center gap-2 flex-wrap">
          {suggestion && !showPicker ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-z-alert">
                <Lightbulb className="h-3 w-3" />
                {getCategoryName(suggestion.category_id)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => handleSelectCategory(suggestion.category_id)}
                disabled={isPending}
              >
                <Check className="h-3 w-3" />
                Aceptar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                onClick={() => setShowPicker(true)}
                disabled={isPending}
              >
                <Pencil className="h-3 w-3" />
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CategoryZonePicker
                categories={categories}
                value={manualValue}
                onValueChange={(id) => {
                  setManualValue(id);
                  if (id) handleSelectCategory(id);
                }}
                direction={tx.direction}
                placeholder="Elegir categoría"
                triggerClassName="h-8 text-xs px-2.5 w-full sm:w-[240px]"
              />
              {showPicker && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setShowPicker(false)}
                >
                  Cancelar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
