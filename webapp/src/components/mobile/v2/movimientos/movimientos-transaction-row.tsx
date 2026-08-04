"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatTime } from "@/lib/utils/date";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { chipBackground, zoneBorder, zoneTextColor } from "@/lib/utils/zone-colors";
import { TagChip } from "@/components/tags/tag-chip";
import {
  TransactionQuickActions,
  TransactionIconTile,
  accountTail,
  resolveCategoryColor,
} from "@/components/transactions/transaction-quick-actions";
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
  const catColor = localCategory ? resolveCategoryColor(categories, localCategory.id) : null;
  // La fecha vive en el header del grupo; aquí solo la hora. Null en la mayoría
  // de tx importadas por PDF — la meta-línea degrada al chip de categoría solo.
  const timeStr = formatTime(tx.transaction_time);

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
        PANEL_SURFACE_CLASS,
        "px-3.5 py-3 transition-colors",
        // Estado expandido ("tono", ver TOKENS.md): sube un tier de superficie
        // y refuerza borde + highlight para delimitar la tarjeta activa.
        expanded && "border-white/[0.14] bg-z-surface-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]",
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={expanded ? `Ocultar acciones de ${description}` : `Ver acciones de ${description}`}
        className={cn(
          "flex w-full items-center gap-3 text-left",
          tx.is_excluded && "opacity-40",
        )}
      >
        <TransactionIconTile category={localCategory} categories={categories} />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-medium">
            {tx.recurrence_group_id && (
              <>
                <Repeat className="size-3 shrink-0 text-z-brass" aria-hidden="true" />
                <span className="sr-only">Vinculado a recurrente:</span>
              </>
            )}
            <span className="truncate">{description}</span>
          </p>
          <div className="mt-1 flex min-w-0">
            <span
              className="inline-flex max-w-full items-center truncate rounded-full border px-2 py-px text-[11px] font-medium"
              style={
                catColor
                  ? {
                      backgroundColor: chipBackground(catColor),
                      borderColor: zoneBorder(catColor),
                      color: zoneTextColor(catColor),
                    }
                  : {
                      backgroundColor: "color-mix(in srgb, var(--z-sage) 14%, transparent)",
                      borderColor: "color-mix(in srgb, var(--z-sage) 20%, transparent)",
                      color: "var(--z-sage-light)",
                    }
              }
            >
              {categoryName ?? "Sin categoría"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "text-[15px] font-medium tabular-nums",
              tx.direction === "INFLOW" ? "text-z-income" : "text-z-expense",
              tx.is_excluded && "line-through",
            )}
          >
            {tx.direction === "INFLOW" ? "+" : "−"}
            {formatCurrency(tx.amount, tx.currency_code)}
          </span>
          <div className="flex items-center gap-1">
            {timeStr && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-z-sage-dark">
                {timeStr}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-z-sage-dark">
              <span
                className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
                style={{ backgroundColor: tx.account.color ?? undefined }}
              />
              {accountTail(tx.account.name)}
            </span>
          </div>
        </div>
      </button>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-[50px] pt-1.5">
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
        <div className="mt-3">
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
