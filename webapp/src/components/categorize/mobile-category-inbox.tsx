"use client";

import { useState, useMemo, useTransition } from "react";
import { Inbox, CheckCheck } from "lucide-react";
import { extractPattern } from "@zeta/shared";
import { bulkCategorize, bulkConfirmAutoCategory } from "@/actions/categorize";
import { MovimientosTransactionRow } from "@/components/mobile/v2/movimientos/movimientos-transaction-row";
import { formatDate } from "@/lib/utils/date";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { TransactionWithAccount, CategoryWithChildren } from "@/types/domain";

type ActiveTab = "uncategorized" | "auto-review";

interface MobileCategoryInboxProps {
  initialTransactions: TransactionWithAccount[];
  autoCategorizedTransactions?: TransactionWithAccount[];
  categories: CategoryWithChildren[];
}

function groupByDate(
  items: TransactionWithAccount[]
): { date: string; transactions: TransactionWithAccount[] }[] {
  const sorted = [...items].sort((a, b) =>
    b.transaction_date.localeCompare(a.transaction_date)
  );
  const map = new Map<string, TransactionWithAccount[]>();
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
}: MobileCategoryInboxProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("uncategorized");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [autoTransactions, setAutoTransactions] = useState(autoCategorizedTransactions);
  const [, startTransition] = useTransition();

  // Similar transactions prompt
  const [similarPrompt, setSimilarPrompt] = useState<{
    categoryId: string;
    similarIds: string[];
    description: string;
  } | null>(null);

  // Build pattern → txIds map for similar detection
  const patternMap = useMemo(() => {
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
    return map;
  }, [transactions]);

  const activeList = activeTab === "uncategorized" ? transactions : autoTransactions;
  const grouped = useMemo(() => groupByDate(activeList), [activeList]);

  function handleCategorized(txId: string, categoryId: string) {
    // Remove from uncategorized list
    setTransactions((prev) => prev.filter((t) => t.id !== txId));

    // Check for similar uncategorized transactions
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;
    const pattern = extractPattern(tx.merchant_name, tx.clean_description, tx.raw_description);
    if (!pattern) return;

    const ids = patternMap.get(pattern) ?? [];
    const similarIds = ids.filter((id) => id !== txId);
    if (similarIds.length === 0) return;

    // Prompt user
    setSimilarPrompt({
      categoryId,
      similarIds,
      description: tx.merchant_name ?? tx.clean_description ?? "transacciones similares",
    });
  }

  function handleBulkApplySimilar() {
    if (!similarPrompt) return;
    const { categoryId, similarIds } = similarPrompt;
    setSimilarPrompt(null);

    startTransition(async () => {
      const items = similarIds.map((id) => ({ txId: id, categoryId }));
      const result = await bulkCategorize(items);
      if (result.success) {
        setTransactions((prev) => prev.filter((t) => !similarIds.includes(t.id)));
        toast.success(`${result.data.categorized} transacciones similares categorizadas`);
      } else {
        toast.error(result.error ?? "Error al categorizar");
      }
    });
  }

  function handleAutoReviewConfirmed(txId: string) {
    setAutoTransactions((prev) => prev.filter((t) => t.id !== txId));
  }

  function handleBulkConfirmAll() {
    const ids = autoTransactions.map((t) => t.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkConfirmAutoCategory(ids);
      if (result.success) {
        setAutoTransactions([]);
        toast.success(`${result.data.confirmed} confirmadas`);
      } else {
        toast.error(result.error ?? "Error al confirmar");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Tab pills */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab("uncategorized")}
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
          onClick={() => setActiveTab("auto-review")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            activeTab === "auto-review"
              ? "bg-z-brass text-z-ink"
              : "border border-white/10 bg-black/10 text-muted-foreground"
          )}
        >
          {autoTransactions.length} auto-categorizadas
        </button>
        {activeTab === "auto-review" && autoTransactions.length > 0 && (
          <button
            onClick={handleBulkConfirmAll}
            className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-z-brass border border-z-brass/20"
          >
            Confirmar todas
          </button>
        )}
      </div>

      {/* Transaction feed */}
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
              <div className="sticky top-0 z-10 -mx-1 px-1 pb-1 pt-0.5 backdrop-blur-sm">
                <p className={cn(MOBILE_EYEBROW_CLASS, "py-1")}>
                  {formatDate(date)}
                </p>
              </div>
              <div className="space-y-0.5">
                {dayTxs.map((tx) => (
                  <MovimientosTransactionRow
                    key={tx.id}
                    transaction={tx}
                    categories={categories}
                    onCategorized={
                      activeTab === "uncategorized"
                        ? handleCategorized
                        : handleAutoReviewConfirmed
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Similar transactions prompt */}
      <AlertDialog open={!!similarPrompt} onOpenChange={(open) => !open && setSimilarPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transacciones similares</AlertDialogTitle>
            <AlertDialogDescription>
              Hay {similarPrompt?.similarIds.length} transacciones más de &quot;{similarPrompt?.description}&quot; sin categoría. ¿Asignar la misma categoría a todas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Solo esta</AlertDialogCancel>
            <AlertDialogAction className={BRASS_BUTTON_CLASS} onClick={handleBulkApplySimilar}>
              Aplicar a todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
