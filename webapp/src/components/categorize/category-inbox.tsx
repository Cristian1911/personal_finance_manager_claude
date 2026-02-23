"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { Inbox, Sparkles, CheckCheck, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InboxTransactionRow } from "./inbox-transaction-row";
import { BulkActionBar } from "./bulk-action-bar";
import { autoCategorize } from "@/lib/utils/auto-categorize";
import { categorizeTransaction, bulkCategorize } from "@/actions/categorize";
import { formatDate } from "@/lib/utils/date";
import type { TransactionWithRelations, CategoryWithChildren } from "@/types/domain";
import type { UserRule, CategorizationResult } from "@/lib/utils/auto-categorize";

interface CategoryInboxProps {
  initialTransactions: TransactionWithRelations[];
  categories: CategoryWithChildren[];
  userRules: UserRule[];
}

export function CategoryInbox({
  initialTransactions,
  categories,
  userRules,
}: CategoryInboxProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Compute suggestions for all transactions
  const suggestions = useMemo(() => {
    const map = new Map<string, CategorizationResult>();
    for (const tx of transactions) {
      const desc =
        tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "";
      const result = autoCategorize(desc, userRules);
      if (result) map.set(tx.id, result);
    }
    return map;
  }, [transactions, userRules]);

  const suggestedCount = suggestions.size;

  // Group transactions by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, TransactionWithRelations[]>();
    for (const tx of transactions) {
      const dateKey = tx.transaction_date;
      const existing = groups.get(dateKey);
      if (existing) existing.push(tx);
      else groups.set(dateKey, [tx]);
    }
    return groups;
  }, [transactions]);

  const handleCategorize = useCallback(
    (txId: string, categoryId: string) => {
      // Optimistic: remove from list immediately
      setTransactions((prev) => prev.filter((t) => t.id !== txId));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(txId);
        return next;
      });

      startTransition(async () => {
        const result = await categorizeTransaction(txId, categoryId);
        if (!result.success) {
          // Revert on error — re-add the transaction
          setTransactions((prev) => {
            const tx = initialTransactions.find((t) => t.id === txId);
            return tx ? [...prev, tx].sort(
              (a, b) => b.transaction_date.localeCompare(a.transaction_date)
            ) : prev;
          });
        }
      });
    },
    [initialTransactions]
  );

  const handleAcceptAllSuggestions = useCallback(() => {
    const items = Array.from(suggestions.entries()).map(
      ([txId, result]) => ({
        txId,
        categoryId: result.category_id,
      })
    );
    if (items.length === 0) return;

    // Optimistic: remove all suggested from list
    const suggestedIds = new Set(items.map((i) => i.txId));
    setTransactions((prev) =>
      prev.filter((t) => !suggestedIds.has(t.id))
    );
    setSelected(new Set());

    startTransition(async () => {
      const result = await bulkCategorize(items);
      if (!result.success) {
        setTransactions(initialTransactions);
      }
    });
  }, [suggestions, initialTransactions]);

  const handleBulkAssign = useCallback(
    (categoryId: string) => {
      const items = Array.from(selected).map((txId) => ({
        txId,
        categoryId,
      }));
      if (items.length === 0) return;

      // Optimistic: remove selected from list
      setTransactions((prev) =>
        prev.filter((t) => !selected.has(t.id))
      );
      setSelected(new Set());

      startTransition(async () => {
        const result = await bulkCategorize(items);
        if (!result.success) {
          setTransactions(initialTransactions);
        }
      });
    },
    [selected, initialTransactions]
  );

  const toggleSelect = useCallback((txId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === transactions.length) return new Set();
      return new Set(transactions.map((t) => t.id));
    });
  }, [transactions]);

  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <PartyPopper className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-1">
          Todas las transacciones están categorizadas
        </h2>
        <p className="text-muted-foreground max-w-sm">
          No tienes transacciones pendientes por categorizar. Las nuevas
          transacciones sin categoría aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Inbox className="h-4 w-4" />
          <span>
            <strong className="text-foreground">{transactions.length}</strong>{" "}
            {transactions.length === 1 ? "transacción" : "transacciones"} sin
            categorizar
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
            >
              {selected.size === transactions.length
                ? "Deseleccionar todo"
                : "Seleccionar todo"}
            </Button>
          )}

          {suggestedCount > 0 && (
            <Button
              size="sm"
              onClick={handleAcceptAllSuggestions}
              disabled={isPending}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Aceptar {suggestedCount}{" "}
              {suggestedCount === 1 ? "sugerencia" : "sugerencias"}
            </Button>
          )}
        </div>
      </div>

      {/* Transaction list grouped by date */}
      <div className="space-y-6">
        {Array.from(groupedByDate.entries()).map(([dateKey, txs]) => (
          <div key={dateKey}>
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1.5 mb-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {formatDate(dateKey, "EEEE, dd 'de' MMMM")}
              </h3>
            </div>
            <div className="space-y-2">
              {txs.map((tx) => (
                <InboxTransactionRow
                  key={tx.id}
                  transaction={tx}
                  suggestion={suggestions.get(tx.id) ?? null}
                  categories={categories}
                  isSelected={selected.has(tx.id)}
                  onToggleSelect={() => toggleSelect(tx.id)}
                  onCategorize={(categoryId) =>
                    handleCategorize(tx.id, categoryId)
                  }
                  isPending={isPending}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          selectedCount={selected.size}
          categories={categories}
          onAssign={handleBulkAssign}
          onClearSelection={() => setSelected(new Set())}
          isPending={isPending}
        />
      )}
    </div>
  );
}
