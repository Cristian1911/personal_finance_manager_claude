"use client";

import { useState, useMemo, useTransition, useCallback, useEffect, useRef } from "react";
import { Inbox, Sparkles, CheckCheck, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InboxTransactionRow } from "./inbox-transaction-row";
import { BulkActionBar } from "./bulk-action-bar";
import { autoCategorize, extractPattern } from "@venti5/shared";
import { categorizeTransaction, bulkCategorize } from "@/actions/categorize";
import { formatDate } from "@/lib/utils/date";
import { trackClientEvent } from "@/lib/utils/analytics";
import type { TransactionWithRelations, CategoryWithChildren } from "@/types/domain";
import type { UserRule, CategorizationResult } from "@venti5/shared";

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
  const didTrackSeenRef = useRef(false);

  useEffect(() => {
    if (didTrackSeenRef.current) return;
    didTrackSeenRef.current = true;
    void trackClientEvent({
      event_name: "uncategorized_item_seen",
      flow: "categorize",
      step: "inbox",
      entry_point: "direct",
      success: true,
      metadata: { pending_uncategorized: initialTransactions.length },
    });
  }, [initialTransactions.length]);

  useEffect(() => {
    void trackClientEvent({
      event_name: "category_suggestion_shown",
      flow: "categorize",
      step: "inbox",
      entry_point: "direct",
      success: true,
      metadata: {
        suggestions_count: suggestedCount,
        pending_uncategorized: transactions.length,
      },
    });
  }, [suggestedCount, transactions.length]);

  const patternGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const tx of transactions) {
      const pattern = extractPattern(
        tx.merchant_name,
        tx.clean_description,
        tx.raw_description
      );
      if (!pattern) continue;
      const existing = groups.get(pattern) ?? [];
      existing.push(tx.id);
      groups.set(pattern, existing);
    }
    return groups;
  }, [transactions]);

  const txIdToSimilarCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const ids of patternGroups.values()) {
      for (const id of ids) {
        map.set(id, ids.length);
      }
    }
    return map;
  }, [patternGroups]);

  const groupedSuggestionItems = useMemo(() => {
    const planned = new Map<string, string>();

    for (const ids of patternGroups.values()) {
      if (ids.length < 2) continue;

      const votes = new Map<string, number>();
      for (const id of ids) {
        const suggestion = suggestions.get(id);
        if (!suggestion) continue;
        votes.set(
          suggestion.category_id,
          (votes.get(suggestion.category_id) ?? 0) + 1
        );
      }
      if (votes.size === 0) continue;

      const [dominantCategory] = Array.from(votes.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0];

      for (const id of ids) {
        const txSuggestion = suggestions.get(id);
        if (txSuggestion && txSuggestion.category_id !== dominantCategory) continue;
        planned.set(id, dominantCategory);
      }
    }

    return Array.from(planned.entries()).map(([txId, categoryId]) => ({
      txId,
      categoryId,
    }));
  }, [patternGroups, suggestions]);

  const groupedSuggestionCount = groupedSuggestionItems.length;
  const hasMerchantBatchAction = useMemo(
    () => Array.from(patternGroups.values()).some((ids) => ids.length >= 2),
    [patternGroups]
  );

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
          void trackClientEvent({
            event_name: "transaction_categorized",
            flow: "categorize",
            step: "single",
            entry_point: "cta",
            success: false,
            error_code: "categorize_failed",
          });
        } else {
          void trackClientEvent({
            event_name: "transaction_categorized",
            flow: "categorize",
            step: "single",
            entry_point: "cta",
            success: true,
            metadata: { category_id: categoryId },
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
        void trackClientEvent({
          event_name: "bulk_categorize_applied",
          flow: "categorize",
          step: "bulk_suggestions",
          entry_point: "cta",
          success: false,
          error_code: "bulk_categorize_failed",
        });
      } else {
        void trackClientEvent({
          event_name: "bulk_categorize_applied",
          flow: "categorize",
          step: "bulk_suggestions",
          entry_point: "cta",
          success: true,
          metadata: { count: items.length, source: "suggestions" },
        });
      }
    });
  }, [suggestions, initialTransactions]);

  const handleApplyByMerchant = useCallback(() => {
    if (groupedSuggestionItems.length === 0) return;
    const ids = new Set(groupedSuggestionItems.map((i) => i.txId));

    setTransactions((prev) => prev.filter((t) => !ids.has(t.id)));
    setSelected(new Set());

      startTransition(async () => {
        const result = await bulkCategorize(groupedSuggestionItems);
        if (!result.success) {
          setTransactions(initialTransactions);
          void trackClientEvent({
            event_name: "bulk_categorize_applied",
            flow: "categorize",
            step: "bulk_merchant",
            entry_point: "cta",
            success: false,
            error_code: "bulk_categorize_failed",
          });
        } else {
          void trackClientEvent({
            event_name: "bulk_categorize_applied",
            flow: "categorize",
            step: "bulk_merchant",
            entry_point: "cta",
            success: true,
            metadata: { count: groupedSuggestionItems.length, source: "merchant_batch" },
          });
        }
      });
  }, [groupedSuggestionItems, initialTransactions]);

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
          void trackClientEvent({
            event_name: "bulk_categorize_applied",
            flow: "categorize",
            step: "bulk_manual",
            entry_point: "cta",
            success: false,
            error_code: "bulk_categorize_failed",
          });
        } else {
          void trackClientEvent({
            event_name: "bulk_categorize_applied",
            flow: "categorize",
            step: "bulk_manual",
            entry_point: "cta",
            success: true,
            metadata: { count: items.length, source: "bulk" },
          });
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
          {hasMerchantBatchAction && groupedSuggestionCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleApplyByMerchant}
              disabled={isPending}
              className="gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Aplicar por comercio ({groupedSuggestionCount})
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
                  similarCount={txIdToSimilarCount.get(tx.id) ?? 0}
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
