"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryIcon } from "@/components/categories/category-icon";
import { TagChip } from "@/components/tags/tag-chip";
import { TransactionQuickActions } from "@/components/transactions/transaction-quick-actions";
import type { TransactionWithAccount, CategoryWithChildren } from "@/types/domain";

interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  /** Account IDs that have pending recurring occurrences — enables "Vincular a recurrente" */
  linkableAccountIds?: Set<string>;
  /** Called after a successful category assignment — used by categorizar to remove from list / prompt bulk apply */
  onCategorized?: (txId: string, categoryId: string) => void;
}

export function MovimientosTransactionRow({
  transaction: tx,
  categories,
  tags = [],
  linkableAccountIds,
  onCategorized,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  // Optimistic category for the collapsed-row subtitle (the action surface owns
  // the rest of the mutations and reports back via onCategorized).
  const [localCategory, setLocalCategory] = useState(tx.category);

  const description =
    tx.merchant_name || tx.clean_description || tx.raw_description || "Sin descripción";
  const categoryName = localCategory?.name_es ?? localCategory?.name ?? null;

  function handleCategorized(txId: string, categoryId: string) {
    const cat = categories
      .flatMap((c) => [c, ...(c.children ?? [])])
      .find((c) => c.id === categoryId);
    if (cat) {
      setLocalCategory({ id: cat.id, name: cat.name, name_es: cat.name_es, icon: cat.icon, color: cat.color });
    }
    onCategorized?.(txId, categoryId);
  }

  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        expanded && "border-l-2 border-z-brass pl-2",
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 px-2 py-2.5 text-left transition-colors hover:bg-white/5",
          tx.is_excluded && "opacity-40",
        )}
      >
        <div
          className={cn(
            "flex size-[22px] shrink-0 items-center justify-center rounded-md",
            tx.direction === "INFLOW" ? "bg-z-income/12 text-z-income" : "bg-z-expense/12 text-z-expense",
          )}
        >
          {tx.direction === "INFLOW" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-medium">
            {tx.recurrence_group_id && (
              <>
                <Repeat className="size-3 shrink-0 text-z-brass/70" aria-hidden="true" />
                <span className="sr-only">Vinculado a recurrente:</span>
              </>
            )}
            <span className="truncate">{description}</span>
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: tx.account.color ?? undefined }}
            />
            <span className="truncate">{tx.account.name}</span>
            <span className="text-white/15">·</span>
            {categoryName ? (
              <span className="inline-flex items-center gap-0.5 truncate">
                {localCategory?.icon && <CategoryIcon icon={localCategory.icon} className="size-3 shrink-0" />}
                {categoryName}
              </span>
            ) : (
              <span className="text-z-brass">Sin cat.</span>
            )}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-medium tabular-nums",
            tx.direction === "INFLOW" && "text-z-income",
            tx.is_excluded && "line-through",
          )}
        >
          {tx.direction === "INFLOW" ? "+" : "-"}
          {formatCurrency(tx.amount, tx.currency_code)}
        </span>
      </button>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1.5 pl-[38px]">
          {tags.map((t) => (
            <TagChip
              key={t.id}
              tag={{ name: t.name, color: t.color }}
              groupColor={t.group_color}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Expanded: shared quick-action surface */}
      {expanded && (
        <div className="px-2 pb-2.5 pt-0.5">
          <TransactionQuickActions
            transaction={tx}
            categories={categories}
            tags={tags}
            linkableAccountIds={linkableAccountIds}
            onCategorized={handleCategorized}
          />
        </div>
      )}
    </div>
  );
}
