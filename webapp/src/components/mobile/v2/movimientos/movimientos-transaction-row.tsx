"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Repeat } from "lucide-react";
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
import type { TransactionWithAccount, CategoryWithChildren , TransferLegSummary } from "@/types/domain";

interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  /** Account IDs that have pending recurring occurrences — enables "Vincular a recurrente" */
  linkableAccountIds?: Set<string>;
  /** Called after a successful category assignment — used by categorizar to remove from list / prompt bulk apply */
  onCategorized?: (txId: string, categoryId: string) => void;
  /** The other leg of the same transfer, when the feed has it in hand. Turns the
   *  row into a single "origen → destino" movement instead of two rows that read
   *  as a spend and an income that never happened. */
  counterpart?: TransactionWithAccount | TransferLegSummary;
}

/** Last four digits alone: two of these plus an arrow must fit one row, and the
 *  brand prefix `accountTail` keeps ("VISA ····7022") overflows it. */
function accountMask(name: string): string {
  const match = name.match(/(\d{4})\s*$/);
  return match ? `····${match[1]}` : accountTail(name);
}

/** Account chip used by transfer rows: same dot + tail language as the account
 *  chip in the amount column, so a transfer reads as "this account → that one".
 *  A null account is the side the feed can't see — never guessed. */
function AccountChip({ account }: { account: { name: string; color: string | null } | null }) {
  return (
    <span className="flex min-w-0 items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-z-sage-light">
      <span
        className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ backgroundColor: account?.color ?? "var(--z-sage-dark)" }}
        aria-hidden="true"
      />
      <span className="truncate">{account ? accountMask(account.name) : "otra cuenta"}</span>
    </span>
  );
}

export function MovimientosTransactionRow({
  transaction: tx,
  categories,
  tags = [],
  linkableAccountIds,
  onCategorized,
  counterpart,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  // Optimistic category for the collapsed-row subtitle (the action surface owns
  // the rest of the mutations and reports back via onCategorized).
  const [localCategory, setLocalCategory] = useState(tx.category);

  // A transfer moves money between the user's own accounts: it is neither spend
  // nor income (every metric filters it out via `transfer_group_id IS NULL`), so
  // the row drops the +/− and the income/expense colour and states the flow.
  const isTransfer = Boolean(tx.transfer_group_id);
  const origin = counterpart
    ? (tx.direction === "OUTFLOW" ? tx : counterpart).account
    : tx.direction === "OUTFLOW"
      ? tx.account
      : null;
  const destination = counterpart
    ? (tx.direction === "OUTFLOW" ? counterpart : tx).account
    : tx.direction === "INFLOW"
      ? tx.account
      : null;

  // The account chips below carry origin → destination, so the title is free to
  // name the movement itself. The OUTFLOW leg is the one that carries a useful
  // name ("Pago NU tarjeta"); the INFLOW side is usually just the source account.
  const outflowLeg =
    tx.direction === "OUTFLOW" ? tx : counterpart?.direction === "OUTFLOW" ? counterpart : null;
  const transferName =
    outflowLeg?.merchant_name || outflowLeg?.clean_description || "Transferencia";
  const description = isTransfer
    ? transferName
    : tx.merchant_name || tx.clean_description || tx.raw_description || "Sin descripción";
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
        aria-label={
          isTransfer
            ? `${expanded ? "Ocultar" : "Ver"} acciones de la transferencia ${
                origin && destination
                  ? `de ${origin.name} a ${destination.name}`
                  : origin
                    ? `desde ${origin.name}`
                    : `hacia ${destination!.name}`
              }`
            : `${expanded ? "Ocultar" : "Ver"} acciones de ${description}`
        }
        className={cn(
          "flex w-full items-center gap-3 text-left",
          tx.is_excluded && "opacity-40",
        )}
      >
        <TransactionIconTile
          category={isTransfer ? null : localCategory}
          categories={categories}
          icon={isTransfer ? <ArrowLeftRight className="size-[17px]" /> : undefined}
        />

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
            {isTransfer ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <AccountChip account={origin} />
                <ArrowRight className="size-3 shrink-0 text-z-sage-dark" aria-hidden="true" />
                <AccountChip account={destination} />
              </span>
            ) : (
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
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "text-[15px] font-medium tabular-nums",
              isTransfer
                ? "text-z-sage-light"
                : tx.direction === "INFLOW"
                  ? "text-z-income"
                  : "text-z-expense",
              tx.is_excluded && "line-through",
            )}
          >
            {!isTransfer && (tx.direction === "INFLOW" ? "+" : "−")}
            {formatCurrency(tx.amount, tx.currency_code)}
          </span>
          <div className="flex items-center gap-1">
            {timeStr && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-z-sage-dark">
                {timeStr}
              </span>
            )}
            {!isTransfer && (
              <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-z-sage-dark">
                <span
                  className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
                  style={{ backgroundColor: tx.account.color ?? undefined }}
                />
                {accountTail(tx.account.name)}
              </span>
            )}
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

      {/* Expanded: shared quick-action surface. On a merged row the actions act
          on this leg; the other one gets an explicit escape hatch so the pair is
          never a black box. */}
      {expanded && counterpart && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2">
          <span className="min-w-0 truncate text-[11px] text-z-sage-dark">
            Acciones sobre {accountTail(tx.account.name)}
          </span>
          <Link
            href={`/transactions/${counterpart.id}`}
            aria-label={`Ver el otro lado de la transferencia en ${counterpart.account.name}`}
            className="shrink-0 text-[11px] font-medium text-z-brass hover:underline"
          >
            Ver el otro lado
          </Link>
        </div>
      )}
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
