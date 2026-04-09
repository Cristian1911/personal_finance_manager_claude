"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { categorizeTransaction } from "@/actions/categorize";
import { toast } from "sonner";
import type { TransactionWithAccount, CategoryWithChildren } from "@/types/domain";

interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  /** Called after a successful category assignment — used by categorizar to remove from list / prompt bulk apply */
  onCategorized?: (txId: string, categoryId: string) => void;
}

export function MovimientosTransactionRow({
  transaction: tx,
  categories,
  onCategorized,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  // Optimistic local state
  const [localCategory, setLocalCategory] = useState(tx.category);

  const description =
    tx.merchant_name ||
    tx.clean_description ||
    tx.raw_description ||
    "Sin descripción";

  const categoryName = localCategory?.name_es ?? localCategory?.name ?? null;

  function handleCategorize(categoryId: string | null) {
    if (!categoryId) return;
    const cat = categories
      .flatMap((c) => [c, ...(c.children ?? [])])
      .find((c) => c.id === categoryId);
    if (cat) {
      setLocalCategory({ id: cat.id, name: cat.name, name_es: cat.name_es, icon: cat.icon, color: cat.color });
    }
    startTransition(async () => {
      const result = await categorizeTransaction(tx.id, categoryId);
      if (!result.success) {
        setLocalCategory(tx.category);
        toast.error("Error al categorizar");
      } else {
        onCategorized?.(tx.id, categoryId);
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        expanded && "border-l-2 border-z-brass pl-2"
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-2 py-2.5 text-left transition-colors hover:bg-white/5",
          tx.is_excluded && "opacity-40"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{description}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: tx.account.color ?? undefined }}
            />
            <span className="truncate">{tx.account.name}</span>
            <span className="text-white/15">·</span>
            <span>{formatDate(tx.transaction_date, "dd MMM")}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              tx.direction === "INFLOW" && "text-z-income",
              tx.is_excluded && "line-through"
            )}
          >
            {tx.direction === "INFLOW" ? "+" : "-"}
            {formatCurrency(tx.amount, tx.currency_code)}
          </span>
          <span
            className={cn(
              "text-muted-foreground/50 text-xs transition-transform",
              expanded && "rotate-90"
            )}
          >
            ›
          </span>
        </div>
      </button>

      {/* Expanded: inline pickers + edit link */}
      {expanded && (
        <div className="flex items-center gap-1.5 px-2 pb-2.5 pt-0.5">
          {categoryName ? (
            <span className="rounded-lg bg-z-brass/10 px-2.5 py-1 text-[10px] font-semibold text-z-brass">
              {categoryName}
            </span>
          ) : (
            <CategoryZonePicker
              categories={categories}
              value={null}
              onValueChange={handleCategorize}
              direction={tx.direction === "OUTFLOW" ? "OUTFLOW" : undefined}
              placeholder="Categoría"
              variant="drawer"
              triggerClassName="text-[10px] h-auto py-1 px-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-z-brass hover:bg-white/[0.06]"
            />
          )}
          <TagZonePicker
            entityType="transaction"
            entityId={tx.id}
            compact
          />
          <div className="flex-1" />
          <Link
            href={`/transactions/${tx.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]"
          >
            <Pencil className="size-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
