"use client";

import { Suspense, useMemo } from "react";
import { formatDate } from "@/lib/utils/date";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { MonthSelector } from "@/components/month-selector";
import { MovimientosLectura } from "./movimientos-lectura";
import { MovimientosHerramientas } from "./movimientos-herramientas";
import { MovimientosUtilidades } from "./movimientos-utilidades";
import { MovimientosTransactionRow } from "./movimientos-transaction-row";
import type {
  Transaction,
  PendingEmailTransaction,
  CategoryWithChildren,
  Account,
  Tag,
  CurrencyCode,
} from "@/types/domain";

interface MovimientosRootProps {
  transactions: Transaction[];
  categories: CategoryWithChildren[];
  outflowCategories: CategoryWithChildren[];
  accounts: Account[];
  tags: Tag[];
  count: number;
  totalInflow: number;
  totalOutflow: number;
  uncategorizedCount: number;
  pendingEmails: PendingEmailTransaction[];
  currency: CurrencyCode;
}

export function MovimientosRoot({
  transactions,
  categories,
  outflowCategories,
  accounts,
  tags,
  count,
  totalInflow,
  totalOutflow,
  uncategorizedCount,
  pendingEmails,
  currency,
}: MovimientosRootProps) {
  /** Page-level accordion — one expanded section at a time */
  const { activeZone, toggle } = useExpandableZone<string>();

  const uncategorizedTransactions = useMemo(
    () =>
      transactions
        .filter((tx) => tx.direction === "OUTFLOW" && !tx.category_id)
        .slice(0, 5),
    [transactions]
  );

  /** Group transactions by date, sorted descending */
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
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  return (
    <div className="space-y-3">
      <MobileHeader
        variant="page"
        title="Movimientos"
        chip="Mesa operativa"
        action={
          <Suspense>
            <MonthSelector />
          </Suspense>
        }
      />

      {/* Lectura — month summary with expandable flow chart */}
      <MovimientosLectura
        count={count}
        totalInflow={totalInflow}
        totalOutflow={totalOutflow}
        transactions={transactions}
        currency={currency}
        expanded={activeZone === "lectura"}
        onToggle={() => toggle("lectura")}
      />

      {/* Herramientas — action tools grid */}
      <MovimientosHerramientas
        uncategorizedTransactions={uncategorizedTransactions}
        uncategorizedCount={uncategorizedCount}
        pendingEmails={pendingEmails}
        pendingMatchCount={0}
        categories={outflowCategories}
        accounts={accounts}
        currency={currency}
        expandedTool={activeZone?.startsWith("tool-") ? activeZone.replace("tool-", "") : null}
        onToggleTool={(id) => toggle(`tool-${id}`)}
      />

      {/* Utilidades — search, filter, month, register pills */}
      <MovimientosUtilidades
        accounts={accounts}
        categories={categories}
        tags={tags}
      />

      {/* Feed — date-grouped transaction rows */}
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            No hay movimientos en esta vista
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([date, txs]) => (
            <div key={date}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatDate(date, "EEEE, dd MMM")}
              </p>
              <div className="space-y-0.5">
                {txs.map((tx) => (
                  <MovimientosTransactionRow key={tx.id} transaction={tx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
