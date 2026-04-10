"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { Pencil, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { TagChip } from "@/components/tags/tag-chip";
import { CategoryIcon } from "@/components/categories/category-icon";
import { categorizeTransaction } from "@/actions/categorize";
import { toast } from "sonner";
import type { TransactionWithAccount, CategoryWithChildren } from "@/types/domain";

interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  /** Called after a successful category assignment — used by categorizar to remove from list / prompt bulk apply */
  onCategorized?: (txId: string, categoryId: string) => void;
}

export function MovimientosTransactionRow({
  transaction: tx,
  categories,
  tags = [],
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
          "flex w-full items-center gap-2 px-2 py-2.5 text-left transition-colors hover:bg-white/5",
          tx.is_excluded && "opacity-40"
        )}
      >
        <div className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-md",
          tx.direction === "INFLOW" ? "bg-green-500/12 text-z-income" : "bg-orange-500/12 text-z-expense"
        )}>
          {tx.direction === "INFLOW" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{description}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
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
            tx.is_excluded && "line-through"
          )}
        >
          {tx.direction === "INFLOW" ? "+" : "-"}
          {formatCurrency(tx.amount, tx.currency_code)}
        </span>
      </button>

      {/* Tags (collapsed only) */}
      {!expanded && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1.5 pl-[38px]">
          {tags.map((t) => (
            <TagChip
              key={t.id}
              tag={{ id: t.id, name: t.name, color: t.color } as any}
              groupColor={t.group_color}
              size="sm"
            />
          ))}
        </div>
      )}

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
