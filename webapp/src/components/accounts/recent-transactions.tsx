"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CompactTransactionRow } from "./compact-transaction-row";
import { getAccountTransactions } from "@/actions/accounts";
import { BRASS_GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { TransactionWithAccount } from "@/types/domain";

interface RecentTransactionsProps {
  accountId: string;
  initialTransactions: TransactionWithAccount[];
  initialHasMore: boolean;
}

const PAGE_SIZE = 20;

export function RecentTransactions({
  accountId,
  initialTransactions,
  initialHasMore,
}: RecentTransactionsProps) {
  const [transactions, setTransactions] =
    useState<TransactionWithAccount[]>(initialTransactions);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const result = await getAccountTransactions(accountId, {
        offset: transactions.length,
        limit: PAGE_SIZE,
      });
      if (result.success) {
        setTransactions((prev) => [...prev, ...result.data.transactions]);
        setHasMore(result.data.hasMore);
      }
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2">
        <h2 className="text-sm font-semibold text-white">Transacciones</h2>
        <Link
          href={`/transactions?account=${accountId}`}
          className="text-xs text-z-brass hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {/* List */}
      {transactions.length > 0 ? (
        <div className="divide-y divide-white/[0.04]">
          {transactions.map((tx) => (
            <CompactTransactionRow key={tx.id} transaction={tx} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-z-muted">
            No hay transacciones en esta cuenta
          </p>
          <Link
            href={`/transactions/new?account=${accountId}`}
            className={cn(
              BRASS_GHOST_BUTTON_CLASS,
              "rounded-lg px-3 py-1.5 text-xs font-medium"
            )}
          >
            Agregar transacción
          </Link>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="px-4 pt-2 pb-1">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className={cn(
              "w-full rounded-lg py-2 text-xs font-medium text-z-muted transition-colors hover:bg-white/[0.04]",
              isPending && "opacity-50"
            )}
          >
            {isPending ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}
