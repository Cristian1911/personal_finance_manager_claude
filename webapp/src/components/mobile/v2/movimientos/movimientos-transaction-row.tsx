"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { MOBILE_ACTION_BUTTON_CLASS } from "@/lib/constants/styles";
import type { TransactionWithAccount } from "@/types/domain";

interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
}

export function MovimientosTransactionRow({
  transaction: tx,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const description =
    tx.merchant_name ||
    tx.clean_description ||
    tx.raw_description ||
    "Sin descripcion";

  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        expanded && "border-l-2 border-z-brass pl-2"
      )}
    >
      {/* Collapsed row — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between px-2 py-2 text-left transition-colors hover:bg-white/5",
          tx.is_excluded && "opacity-40"
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{description}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: tx.account.color ?? undefined }}
            />
            <span className="truncate">{tx.account.name}</span>
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 ml-2">
          <span
            className={cn(
              "text-sm font-medium",
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
        </span>
      </button>

      {/* Expanded: action pills */}
      {expanded && (
        <div className="flex gap-2 px-2 pb-2 pt-1">
          <Link
            href="/categorizar"
            className={cn(
              MOBILE_ACTION_BUTTON_CLASS,
              "rounded-full px-3 py-1"
            )}
          >
            Categorizar
          </Link>
          <Link
            href={`/transactions/${tx.id}`}
            className="rounded-full border border-white/8 bg-transparent px-3 py-1 text-[10px] font-semibold text-muted-foreground"
          >
            Editar
          </Link>
          <button
            type="button"
            className="rounded-full border border-white/8 bg-transparent px-3 py-1 text-[10px] font-semibold text-muted-foreground"
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}
