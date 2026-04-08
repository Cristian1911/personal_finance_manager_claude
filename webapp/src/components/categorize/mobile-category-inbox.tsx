"use client";

import { useState, useMemo, useTransition } from "react";
import { Inbox, CheckCheck } from "lucide-react";
import { autoCategorize, extractPattern } from "@zeta/shared";
import {
  categorizeTransaction,
  bulkCategorize,
  confirmAutoCategory,
  bulkConfirmAutoCategory,
} from "@/actions/categorize";
import { BulkActionBar } from "./bulk-action-bar";
import { MobileCategoryDrawer } from "./mobile-category-drawer";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TransactionWithRelations, CategoryWithChildren } from "@/types/domain";
import type { UserRule, CategorizationResult } from "@zeta/shared";

type ActiveTab = "uncategorized" | "auto-review";

interface MobileCategoryInboxProps {
  initialTransactions: TransactionWithRelations[];
  autoCategorizedTransactions?: TransactionWithRelations[];
  categories: CategoryWithChildren[];
  userRules: UserRule[];
  destinatarioSuggestions?: Record<
    string,
    {
      destinatario_id: string;
      destinatario_name: string;
      category_id: string | null;
    }
  >;
}

function groupByDate(
  items: TransactionWithRelations[]
): { date: string; transactions: TransactionWithRelations[] }[] {
  const sorted = [...items].sort((a, b) =>
    b.transaction_date.localeCompare(a.transaction_date)
  );
  const map = new Map<string, TransactionWithRelations[]>();
  for (const tx of sorted) {
    const group = map.get(tx.transaction_date) ?? [];
    group.push(tx);
    map.set(tx.transaction_date, group);
  }
  return Array.from(map.entries()).map(([date, transactions]) => ({
    date,
    transactions,
  }));
}

export function MobileCategoryInbox({
  initialTransactions,
  autoCategorizedTransactions = [],
  categories,
  userRules,
  destinatarioSuggestions = {},
}: MobileCategoryInboxProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("uncategorized");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [autoTransactions, setAutoTransactions] = useState(
    autoCategorizedTransactions
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [drawerTx, setDrawerTx] =
    useState<TransactionWithRelations | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Compute suggestions via autoCategorize
  const suggestions = useMemo(() => {
    const map = new Map<string, CategorizationResult>();
    for (const tx of transactions) {
      if (
        tx.categorization_source === "USER_OVERRIDE" ||
        tx.categorization_source === "USER_CREATED"
      )
        continue;
      const desc =
        tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "";
      const result = autoCategorize(desc, userRules);
      if (result) map.set(tx.id, result);
    }
    return map;
  }, [transactions, userRules]);

  // Count similar transactions using extractPattern
  const similarCounts = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tx of transactions) {
      const pattern = extractPattern(
        tx.merchant_name,
        tx.clean_description,
        tx.raw_description
      );
      if (!pattern) continue;
      if (!map.has(pattern)) map.set(pattern, []);
      map.get(pattern)!.push(tx.id);
    }
    // Return txId → count of others with same pattern
    const result = new Map<string, number>();
    for (const ids of map.values()) {
      if (ids.length < 2) continue;
      for (const id of ids) {
        result.set(id, ids.length - 1);
      }
    }
    return result;
  }, [transactions]);

  const activeList = activeTab === "uncategorized" ? transactions : autoTransactions;
  const grouped = useMemo(() => groupByDate(activeList), [activeList]);

  // --- Handlers ---

  const openDrawer = (tx: TransactionWithRelations) => {
    setDrawerTx(tx);
    setDrawerOpen(true);
  };

  const handleCardTap = (tx: TransactionWithRelations) => {
    if (selectMode) {
      toggleSelect(tx.id);
    } else {
      openDrawer(tx);
    }
  };

  const handleCardLongPress = (tx: TransactionWithRelations) => {
    if (!selectMode) {
      setSelectMode(true);
      setSelected(new Set([tx.id]));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setSelectMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    clearSelection();
  };

  // Single transaction categorize (from drawer)
  const handleDrawerConfirm = (categoryId: string, applySimilar: boolean) => {
    if (!drawerTx) return;
    startTransition(async () => {
      if (activeTab === "auto-review") {
        // If user picked a different category than the auto-assigned one, override it
        const autoCategory = drawerTx.category_id;
        if (autoCategory && categoryId !== autoCategory) {
          const result = await categorizeTransaction(drawerTx.id, categoryId);
          if (result.success) {
            setAutoTransactions((prev) => prev.filter((t) => t.id !== drawerTx.id));
            toast.success("Categoría corregida");
          } else {
            toast.error(result.error ?? "Error al categorizar");
          }
        } else {
          const result = await confirmAutoCategory(drawerTx.id);
          if (result.success) {
            setAutoTransactions((prev) => prev.filter((t) => t.id !== drawerTx.id));
            toast.success("Auto-categorización confirmada");
          } else {
            toast.error(result.error ?? "Error al confirmar");
          }
        }
      } else {
        const idsToUpdate = [drawerTx.id];
        if (applySimilar) {
          const pattern = extractPattern(
            drawerTx.merchant_name,
            drawerTx.clean_description,
            drawerTx.raw_description
          );
          if (pattern) {
            for (const tx of transactions) {
              if (tx.id === drawerTx.id) continue;
              const p = extractPattern(tx.merchant_name, tx.clean_description, tx.raw_description);
              if (p === pattern) idsToUpdate.push(tx.id);
            }
          }
        }

        if (idsToUpdate.length === 1) {
          const result = await categorizeTransaction(drawerTx.id, categoryId);
          if (result.success) {
            setTransactions((prev) => prev.filter((t) => t.id !== drawerTx.id));
            toast.success("Categoría asignada");
          } else {
            toast.error(result.error ?? "Error al categorizar");
          }
        } else {
          const items = idsToUpdate.map((id) => ({ txId: id, categoryId }));
          const result = await bulkCategorize(items);
          if (result.success) {
            setTransactions((prev) =>
              prev.filter((t) => !idsToUpdate.includes(t.id))
            );
            toast.success(
              `${result.data.categorized} movimientos categorizados`
            );
          } else {
            toast.error(result.error ?? "Error al categorizar");
          }
        }
      }
      setDrawerOpen(false);
    });
  };

  // Bulk assign from BulkActionBar
  const handleBulkAssign = (categoryId: string) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      if (activeTab === "auto-review") {
        const result = await bulkConfirmAutoCategory(ids);
        if (result.success) {
          setAutoTransactions((prev) =>
            prev.filter((t) => !ids.includes(t.id))
          );
          toast.success(`${result.data.confirmed} confirmadas`);
        } else {
          toast.error(result.error ?? "Error al confirmar");
        }
      } else {
        const items = ids.map((id) => ({ txId: id, categoryId }));
        const result = await bulkCategorize(items);
        if (result.success) {
          setTransactions((prev) => prev.filter((t) => !ids.includes(t.id)));
          toast.success(`${result.data.categorized} movimientos categorizados`);
        } else {
          toast.error(result.error ?? "Error al categorizar");
        }
      }
      clearSelection();
    });
  };

  return (
    <div className="space-y-4">
      {/* Tab pills */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleTabChange("uncategorized")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            activeTab === "uncategorized"
              ? "bg-z-brass text-z-ink"
              : "border border-white/10 bg-black/10 text-muted-foreground"
          )}
        >
          {transactions.length} sin categoría
        </button>
        <button
          onClick={() => handleTabChange("auto-review")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            activeTab === "auto-review"
              ? "bg-z-brass text-z-ink"
              : "border border-white/10 bg-black/10 text-muted-foreground"
          )}
        >
          {autoTransactions.length} auto-categorizadas
        </button>
      </div>

      {/* Feed */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full border border-white/8 bg-black/10 p-4">
            {activeTab === "uncategorized" ? (
              <CheckCheck className="size-8 text-z-sage-dark" />
            ) : (
              <Inbox className="size-8 text-z-sage-dark" />
            )}
          </div>
          <div>
            <p className="font-semibold text-base">Bandeja limpia</p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "uncategorized"
                ? "No hay movimientos pendientes de categorizar"
                : "No hay auto-categorizaciones pendientes de revisión"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ date, transactions: dayTxs }) => (
            <div key={date}>
              {/* Sticky date header */}
              <div className="sticky top-0 z-10 -mx-1 px-1 pb-1 pt-0.5 backdrop-blur-sm">
                <p className={cn(MOBILE_EYEBROW_CLASS, "py-1")}>
                  {formatDate(date)}
                </p>
              </div>

              <div className="space-y-2">
                {dayTxs.map((tx) => {
                  const isOutflow = tx.direction === "OUTFLOW";
                  const amountColor = isOutflow
                    ? "text-z-debt"
                    : "text-z-sage-light";
                  const isSelected = selected.has(tx.id);
                  const txSuggestion =
                    activeTab === "uncategorized"
                      ? (suggestions.get(tx.id) ?? null)
                      : null;
                  const hasSuggestion = !!txSuggestion;

                  return (
                    <div
                      key={tx.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleCardTap(tx)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleCardLongPress(tx);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          handleCardTap(tx);
                      }}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors cursor-pointer select-none",
                        isSelected
                          ? "border-z-brass/30 bg-z-brass/10"
                          : "border-white/6 bg-z-surface-2/70"
                      )}
                    >
                      {/* Select checkbox indicator */}
                      {selectMode && (
                        <div
                          className={cn(
                            "shrink-0 size-5 rounded-full border-2 flex items-center justify-center",
                            isSelected
                              ? "border-z-brass bg-z-brass"
                              : "border-white/20 bg-transparent"
                          )}
                        >
                          {isSelected && (
                            <CheckCheck className="size-3 text-z-ink" />
                          )}
                        </div>
                      )}

                      {/* Account color dot */}
                      <div
                        className="shrink-0 size-2 rounded-full mt-0.5"
                        style={{ backgroundColor: tx.account?.color ?? "var(--z-sage-dark)" }}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Line 1: merchant + amount */}
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight truncate">
                            {tx.merchant_name ??
                              tx.clean_description ??
                              tx.raw_description ??
                              "Sin descripción"}
                          </p>
                          <p
                            className={cn(
                              "text-sm font-semibold tabular-nums shrink-0",
                              amountColor
                            )}
                          >
                            {isOutflow ? "−" : "+"}
                            {formatCurrency(tx.amount, tx.currency_code)}
                          </p>
                        </div>

                        {/* Line 2: account + date + suggestion chip */}
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground truncate">
                            {tx.account.name}
                          </span>
                          <span className="text-xs text-muted-foreground/50">
                            ·
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(tx.transaction_date)}
                          </span>
                          {hasSuggestion && (
                            <span className="rounded-full bg-z-brass/10 px-1.5 py-0.5 text-[10px] font-semibold text-z-brass leading-none">
                              Sugerida
                            </span>
                          )}
                          {activeTab === "auto-review" && tx.category && (
                            <span className="rounded-full bg-z-sage-dark/10 px-1.5 py-0.5 text-[10px] font-semibold text-z-sage-dark leading-none">
                              {tx.category.name_es ?? tx.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <BulkActionBar
          selectedCount={selected.size}
          categories={categories}
          onAssign={handleBulkAssign}
          onClearSelection={clearSelection}
          isPending={isPending}
        />
      )}

      {/* Drawer for single categorization */}
      <MobileCategoryDrawer
        transaction={drawerTx}
        suggestion={
          drawerTx
            ? (suggestions.get(drawerTx.id) ?? null)
            : null
        }
        categories={categories}
        similarCount={drawerTx ? (similarCounts.get(drawerTx.id) ?? 0) : 0}
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v);
          if (!v) setDrawerTx(null);
        }}
        onConfirm={handleDrawerConfirm}
        isPending={isPending}
        destinatarioSuggestion={
          drawerTx ? destinatarioSuggestions[drawerTx.id] : null
        }
      />
    </div>
  );
}
