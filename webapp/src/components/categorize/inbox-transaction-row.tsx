"use client";

import { useState } from "react";
import { Check, Lightbulb, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryPickerDialog } from "@/components/categorize/category-picker-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { getCategoryName } from "@venti5/shared";
import type { TransactionWithRelations, CategoryWithChildren, CurrencyCode } from "@/types/domain";
import type { CategorizationResult } from "@venti5/shared";

interface InboxTransactionRowProps {
  transaction: TransactionWithRelations;
  suggestion: CategorizationResult | null;
  categories: CategoryWithChildren[];
  similarCount?: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCategorize: (categoryId: string) => void;
  isPending: boolean;
}

export function InboxTransactionRow({
  transaction: tx,
  suggestion,
  categories,
  similarCount = 0,
  isSelected,
  onToggleSelect,
  onCategorize,
  isPending,
}: InboxTransactionRowProps) {
  const [manualValue, setManualValue] = useState<string | null>(null);
  const description =
    tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "Sin descripción";
  const isOutflow = tx.direction === "OUTFLOW";

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
            ? "bg-red-500/10 text-red-500"
            : "bg-emerald-500/10 text-emerald-500"
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
              isOutflow ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
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
          {similarCount > 1 && (
            <span className="rounded-full border px-2 py-0.5 text-[11px]">
              {similarCount} similares
            </span>
          )}
        </div>

        {/* Suggestion or manual pick */}
        <div className="flex items-center gap-2 flex-wrap">
          {suggestion ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Lightbulb className="h-3 w-3" />
                {getCategoryName(suggestion.category_id)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => onCategorize(suggestion.category_id)}
                disabled={isPending}
              >
                <Check className="h-3 w-3" />
                Aceptar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CategoryPickerDialog
                categories={categories}
                value={manualValue}
                onValueChange={(id) => {
                  setManualValue(id);
                  if (id) onCategorize(id);
                }}
                direction={tx.direction}
                placeholder="Elegir categoría"
                triggerClassName="h-8 text-xs px-2.5 w-[240px]"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
