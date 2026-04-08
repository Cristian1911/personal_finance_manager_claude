"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Hash, UserRound, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { DestinatarioDrawer } from "./destinatario-drawer";
import { TagDrawer } from "./tag-drawer";
import type { TransactionWithAccount } from "@/types/domain";

interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
}

export function MovimientosTransactionRow({
  transaction: tx,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [destDrawerOpen, setDestDrawerOpen] = useState(false);
  const [tagDrawerOpen, setTagDrawerOpen] = useState(false);

  // Optimistic local state for destinatario
  const [localDest, setLocalDest] = useState<{
    id: string;
    name: string;
  } | null>(tx.destinatario ?? null);

  const description =
    tx.merchant_name ||
    tx.clean_description ||
    tx.raw_description ||
    "Sin descripción";

  const categoryName = tx.category?.name_es ?? tx.category?.name ?? null;
  const destinatarioName = localDest?.name ?? null;

  const handleDestAssigned = useCallback((id: string, name: string) => {
    setLocalDest({ id, name });
  }, []);

  const handleDestRemoved = useCallback(() => {
    setLocalDest(null);
  }, []);

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

      {/* Expanded: metadata chips + icon actions */}
      {expanded && (
        <div className="flex items-center gap-1.5 px-2 pb-2.5 pt-0.5">
          {categoryName && (
            <span className="rounded-lg bg-z-brass/10 px-2.5 py-1 text-[10px] font-semibold text-z-brass">
              {categoryName}
            </span>
          )}
          {!categoryName && (
            <Link
              href="/categorizar"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-z-brass transition-colors hover:bg-white/[0.06]"
            >
              Categoría
            </Link>
          )}
          {destinatarioName && (
            <button
              type="button"
              onClick={() => setDestDrawerOpen(true)}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.08]"
            >
              {destinatarioName}
            </button>
          )}
          {!destinatarioName && (
            <button
              type="button"
              onClick={() => setDestDrawerOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]"
            >
              <UserRound className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setTagDrawerOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]"
          >
            <Hash className="size-3" />
          </button>
          <div className="flex-1" />
          <Link
            href={`/transactions/${tx.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]"
          >
            <Pencil className="size-3" />
          </Link>
        </div>
      )}

      {/* Drawers — rendered only when expanded to avoid unnecessary mount */}
      {expanded && (
        <>
          <DestinatarioDrawer
            open={destDrawerOpen}
            onOpenChange={setDestDrawerOpen}
            transactionId={tx.id}
            currentDestinatarioId={localDest?.id ?? null}
            currentDestinatarioName={destinatarioName}
            onAssigned={handleDestAssigned}
            onRemoved={handleDestRemoved}
          />
          <TagDrawer
            open={tagDrawerOpen}
            onOpenChange={setTagDrawerOpen}
            transactionId={tx.id}
          />
        </>
      )}
    </div>
  );
}
