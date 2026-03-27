"use client";

import { useState } from "react";
import { Check, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryPickerDialog } from "@/components/categorize/category-picker-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { getCategoryName } from "@zeta/shared";
import type { TransactionWithRelations, CategoryWithChildren, CurrencyCode } from "@/types/domain";

interface AutoReviewRowProps {
  transaction: TransactionWithRelations;
  categories: CategoryWithChildren[];
  onConfirm: () => void;
  onChangeCat: (categoryId: string) => void;
  isPending: boolean;
}

export function AutoReviewRow({
  transaction: tx,
  categories,
  onConfirm,
  onChangeCat,
  isPending,
}: AutoReviewRowProps) {
  const [showPicker, setShowPicker] = useState(false);
  const description =
    tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "Sin descripcion";
  const isOutflow = tx.direction === "OUTFLOW";
  const categoryName = tx.category
    ? (tx.category.name_es ?? tx.category.name)
    : getCategoryName(tx.category_id ?? "");

  return (
    <div className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
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
        </div>

        {/* Current category + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {tx.category && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${tx.category.color}20`,
                color: tx.category.color ?? undefined,
              }}
            >
              {tx.category.icon && <span>{tx.category.icon}</span>}
              {tx.category.name_es ?? tx.category.name}
            </span>
          )}
          {!tx.category && categoryName && (
            <span className="text-xs text-muted-foreground">
              {categoryName}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={onConfirm}
            disabled={isPending}
          >
            <Check className="h-3 w-3" />
            Confirmar
          </Button>

          {showPicker ? (
            <CategoryPickerDialog
              categories={categories}
              value={null}
              onValueChange={(id) => {
                if (id) onChangeCat(id);
                setShowPicker(false);
              }}
              direction={tx.direction}
              placeholder="Cambiar categoria"
              triggerClassName="h-7 text-xs px-2.5 w-full sm:w-[200px]"
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground"
              onClick={() => setShowPicker(true)}
              disabled={isPending}
            >
              <RefreshCw className="h-3 w-3" />
              Cambiar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
