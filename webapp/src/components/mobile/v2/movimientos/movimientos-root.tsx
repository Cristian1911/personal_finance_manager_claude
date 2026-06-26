"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { MonthSelector } from "@/components/month-selector";
import { MovimientosLectura } from "./movimientos-lectura";
import { MovimientosHerramientas } from "./movimientos-herramientas";
import { MovimientosUtilidades } from "./movimientos-utilidades";
import { MovimientosTransactionRow } from "./movimientos-transaction-row";
import { getAccountIdsWithPendingOccurrences } from "@/actions/occurrences";
import { getTransactions } from "@/actions/transactions";
import type {
  TransactionWithAccount,
  PendingEmailTransaction,
  CategoryWithChildren,
  Account,
  Tag,
  CurrencyCode,
} from "@/types/domain";

interface MovimientosRootProps {
  transactions: TransactionWithAccount[];
  categories: CategoryWithChildren[];
  accounts: Account[];
  tags: Tag[];
  count: number;
  totalInflow: number;
  totalOutflow: number;
  uncategorizedCount: number;
  /** Actual uncategorized rows (server-fetched, all months) for the inline
   *  "sin categoría" preview — NOT derived from the paginated page list. */
  uncategorizedTransactions: TransactionWithAccount[];
  pendingEmails: PendingEmailTransaction[];
  currency: CurrencyCode;
  /** Server-resolved pagination state + the filters to replay for "Cargar más". */
  page?: number;
  totalPages?: number;
  filterParams?: Record<string, string | undefined>;
}

export function MovimientosRoot({
  transactions: initialTransactions,
  categories,
  accounts,
  tags,
  count,
  totalInflow,
  totalOutflow,
  uncategorizedCount,
  uncategorizedTransactions,
  pendingEmails,
  currency,
  page = 1,
  totalPages = 1,
  filterParams,
}: MovimientosRootProps) {
  /** Page-level accordion — one expanded section at a time */
  const { activeZone, toggle } = useExpandableZone<string>();

  /* ---- "Cargar más" pagination — appends pages in place ---- */
  const [extraPages, setExtraPages] = useState<TransactionWithAccount[]>([]);
  const [currentPage, setCurrentPage] = useState(page);
  const [maxPages, setMaxPages] = useState(totalPages);
  const [isLoadingMore, startLoadingMore] = useTransition();

  // Reset appended pages only when the FILTERS change — not on array
  // identity: row actions call router.refresh(), which delivers a fresh
  // initialTransactions reference for the same view and must not wipe the
  // pages the user already loaded.
  const filterKey = JSON.stringify(filterParams ?? {});
  useEffect(() => {
    setExtraPages([]);
    setCurrentPage(page);
    setMaxPages(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const transactions = useMemo(() => {
    if (extraPages.length === 0) return initialTransactions;
    // Dedup the WHOLE combined list: page shifting (new rows inserted while
    // paginating) can duplicate ids across appended pages too.
    const seen = new Set<string>();
    return [...initialTransactions, ...extraPages].filter((tx) => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });
  }, [initialTransactions, extraPages]);

  const hasMorePages = currentPage < maxPages;

  function loadMore() {
    if (!hasMorePages || isLoadingMore) return;
    startLoadingMore(async () => {
      const next = currentPage + 1;
      const result = await getTransactions({
        ...(filterParams ?? {}),
        page: String(next),
      });
      setExtraPages((prev) => [...prev, ...result.data]);
      setCurrentPage(result.page);
      setMaxPages(result.totalPages);
    });
  }

  /* ---- Linkable account IDs for "Vincular a recurrente" ---- */
  const [linkableAccountIds, setLinkableAccountIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    getAccountIdsWithPendingOccurrences().then((ids) => setLinkableAccountIds(new Set(ids)));
  }, []);

  const debtAccountIds = useMemo(
    () =>
      new Set(
        accounts
          .filter((a) => a.account_type === "CREDIT_CARD" || a.account_type === "LOAN")
          .map((a) => a.id)
      ),
    [accounts]
  );

  /** Build tags-by-transaction lookup from joined transaction_tags */
  const tagsByTxId = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string; color: string | null; group_color: string | null }>>();
    for (const tx of transactions) {
      const txTags = (tx as any).transaction_tags;
      if (txTags && Array.isArray(txTags)) {
        map.set(
          tx.id,
          txTags.map((tt: any) => ({
            id: tt.tag.id,
            name: tt.tag.name,
            color: tt.tag.color,
            group_color: tt.tag.group?.color ?? null,
          }))
        );
      }
    }
    return map;
  }, [transactions]);

  /** Group transactions by date, sorted descending */
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, TransactionWithAccount[]>();
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
        variant="main"
        title="Movimientos"
      />

      {/* Month navigation — matches Plan layout */}
      <div className="flex justify-center">
        <Suspense fallback={<span className="text-xs capitalize text-muted-foreground">...</span>}>
          <MonthSelector />
        </Suspense>
      </div>

      {/* Lectura — month summary with expandable flow chart */}
      <MovimientosLectura
        count={count}
        totalInflow={totalInflow}
        totalOutflow={totalOutflow}
        transactions={transactions}
        debtAccountIds={debtAccountIds}
        currency={currency}
        expanded={activeZone === "lectura"}
        onToggle={() => toggle("lectura")}
      />

      {/* Herramientas — action tools grid */}
      <MovimientosHerramientas
        uncategorizedTransactions={uncategorizedTransactions}
        uncategorizedCount={uncategorizedCount}
        pendingEmails={pendingEmails}
        categories={categories}
        accounts={accounts}
        currency={currency}
        expandedTool={activeZone?.startsWith("tool-") ? activeZone.replace("tool-", "") : null}
        onToggleTool={(id) => toggle(`tool-${id}`)}
      />

      {/* Utilidades — search + filter pills */}
      <MovimientosUtilidades
        accounts={accounts}
        tags={tags}
        categories={categories}
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
              <p className={cn("mb-2", SECTION_EYEBROW_CLASS)}>
                {formatDate(date, "EEEE, dd MMM")}
              </p>
              <div className="space-y-0.5">
                {txs.map((tx) => (
                  <MovimientosTransactionRow key={tx.id} transaction={tx} categories={categories} tags={tagsByTxId.get(tx.id)} linkableAccountIds={linkableAccountIds} />
                ))}
              </div>
            </div>
          ))}

          {/* Cargar más — appends the next server page in place */}
          {hasMorePages && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className={cn(
                "w-full rounded-lg py-2.5 text-xs font-medium text-z-sage-dark transition-colors active:bg-white/[0.04]",
                isLoadingMore && "opacity-50"
              )}
            >
              {isLoadingMore ? "Cargando..." : "Cargar más movimientos"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
