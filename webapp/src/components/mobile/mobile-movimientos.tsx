"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type {
  Transaction,
  Category,
  CategoryWithChildren,
  CurrencyCode,
} from "@/types/domain";

interface MobileMovimientosProps {
  transactions: Transaction[];
  categories: CategoryWithChildren[];
}

interface CategoryChip {
  id: string;
  name: string;
  color: string;
  total: number;
}

/** Flatten a tree of CategoryWithChildren into a flat Category array */
function flattenCategories(tree: CategoryWithChildren[]): Category[] {
  const result: Category[] = [];
  for (const node of tree) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, ...cat } = node;
    result.push(cat);
    if (node.children.length > 0) {
      result.push(...flattenCategories(node.children));
    }
  }
  return result;
}

export function MobileMovimientos({
  transactions,
  categories,
}: MobileMovimientosProps) {
  const categoryMap = useMemo(() => {
    const flat = flattenCategories(categories);
    const map = new Map<string, Category>();
    for (const cat of flat) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const { inflow, outflow } = useMemo(() => {
    let inflowSum = 0;
    let outflowSum = 0;
    for (const t of transactions) {
      if (t.is_excluded) continue;
      if (t.direction === "INFLOW") {
        inflowSum += t.amount;
      } else {
        outflowSum += t.amount;
      }
    }
    return { inflow: inflowSum, outflow: outflowSum };
  }, [transactions]);

  const categoryChips = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.is_excluded || t.direction !== "OUTFLOW" || !t.category_id)
        continue;
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount);
    }

    const chips: CategoryChip[] = [];
    for (const [catId, total] of totals) {
      const cat = categoryMap.get(catId);
      if (cat) {
        chips.push({
          id: cat.id,
          name: cat.name_es ?? cat.name,
          color: cat.color,
          total,
        });
      }
    }

    chips.sort((a, b) => b.total - a.total);
    return chips.slice(0, 6);
  }, [transactions, categoryMap]);

  // Determine the primary currency from the first non-excluded transaction
  const currency = useMemo(() => {
    const first = transactions.find((t) => !t.is_excluded);
    return (first?.currency_code ?? "COP") as CurrencyCode;
  }, [transactions]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const date = tx.transaction_date;
      const existing = groups.get(date);
      if (existing) {
        existing.push(tx);
      } else {
        groups.set(date, [tx]);
      }
    }

    // Sort by date descending
    return Array.from(groups.entries()).sort(([a], [b]) =>
      b.localeCompare(a)
    );
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">No hay transacciones</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="font-semibold text-orange-500">
              {formatCurrency(outflow, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="font-semibold text-green-500">
              {formatCurrency(inflow, currency)}
            </p>
          </div>
        </div>

        {/* Category chips — horizontally scrollable */}
        {categoryChips.length > 0 && (
          <div
            className="mt-3 -mx-4 px-4 flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {categoryChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: chip.color }}
                />
                {formatCurrency(chip.total, currency)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Date-grouped transaction feed */}
      <div className="space-y-4">
        {groupedByDate.map(([date, txs]) => (
          <div key={date}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {formatDate(date, "EEEE, dd MMM")}
            </p>
            <div className="space-y-1">
              {txs.map((tx) => {
                const description =
                  tx.merchant_name ||
                  tx.clean_description ||
                  tx.raw_description ||
                  "Sin descripcion";

                return (
                  <Link
                    key={tx.id}
                    href={`/transactions/${tx.id}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-2 -mx-2 hover:bg-muted transition-colors",
                      tx.is_excluded && "opacity-40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          tx.direction === "INFLOW"
                            ? "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
                            : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                        )}
                      >
                        {tx.direction === "INFLOW" ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">
                        {description}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium shrink-0 ml-2",
                        tx.direction === "INFLOW" && "text-green-600",
                        tx.is_excluded && "line-through"
                      )}
                    >
                      {tx.direction === "INFLOW" ? "+" : "-"}
                      {formatCurrency(tx.amount, tx.currency_code)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
