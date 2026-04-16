"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Link2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { CategoryIcon } from "@/components/categories/category-icon";
import { TagChip } from "@/components/tags/tag-chip";
import { LinkPickerSheet } from "@/components/recurring/link-picker-sheet";
import { useOutflowCategories } from "@/components/providers/app-data-provider";
import { categorizeTransaction } from "@/actions/categorize";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import {
  getCandidateOccurrencesForTransaction,
  linkExistingTransactionToOccurrence,
  getAccountIdsWithPendingOccurrences,
} from "@/actions/occurrences";
import type { CandidateOccurrence } from "@/actions/occurrences";
import { toast } from "sonner";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";

// Dynamic import — CategoryPickerBody's tree (~804 LOC with Radix Command/Popover,
// inline create form, etc.) is heavy. Lazy-*mount* via openedOnceIds below defers
// rendering; dynamic import also defers the JS bundle cost.
const CategoryPickerBody = dynamic(
  () => import("@/components/categories/category-zone-picker").then((m) => m.CategoryPickerBody),
  { ssr: false },
);

interface RecentTransactionMobile {
  id: string;
  description: string;
  amount: number;
  currency_code: CurrencyCode;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
  account_name: string;
  account_color: string | null;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  recurrence_group_id: string | null;
  tags: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
}

interface InicioActivityProps {
  transactions: RecentTransactionMobile[];
}

function findCategoryById(
  categories: CategoryWithChildren[],
  id: string,
): { id: string; name: string; icon: string | null } | null {
  for (const parent of categories) {
    if (parent.id === id) {
      return { id: parent.id, name: parent.name_es ?? parent.name ?? "", icon: parent.icon ?? null };
    }
    const child = parent.children.find((c) => c.id === id);
    if (child) {
      return { id: child.id, name: child.name_es ?? child.name ?? "", icon: child.icon ?? null };
    }
  }
  return null;
}

export function InicioActivity({ transactions }: InicioActivityProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Track which rows have been opened at least once so we can defer mounting
  // the heavy CategoryPickerBody until the user actually interacts.
  const [openedOnceIds, setOpenedOnceIds] = useState<Set<string>>(new Set());
  const outflowCategories = useOutflowCategories();
  // Refs for each row so we can scroll the expanded panel into view above the tab bar.
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ---- Linkable account IDs (loaded client-side) ---- */
  const [linkableAccountIds, setLinkableAccountIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    getAccountIdsWithPendingOccurrences().then((ids) => setLinkableAccountIds(new Set(ids)));
  }, []);

  /* ---- Optimistic category assignment ---- */
  const [optimisticCategories, setOptimisticCategories] = useState<
    Record<string, { id: string; name: string; icon: string | null }>
  >({});
  const [, startCategoryTransition] = useTransition();

  function handleAssignCategory(txId: string, categoryId: string) {
    const category = findCategoryById(outflowCategories, categoryId);
    if (!category) return;
    setOptimisticCategories((prev) => ({ ...prev, [txId]: category }));
    setExpandedId(null);
    startCategoryTransition(async () => {
      const result = await categorizeTransaction(txId, categoryId);
      if (!result.success) {
        setOptimisticCategories((prev) => {
          const next = { ...prev };
          delete next[txId];
          return next;
        });
        toast.error(result.error ?? "Error al asignar categoría");
      } else {
        toast.success(`Categoría: ${category.name}`);
      }
    });
  }

  /* ---- Link to recurring flow ---- */
  const [linkingTxId, setLinkingTxId] = useState<string | null>(null);
  const [occurrenceCandidates, setOccurrenceCandidates] = useState<CandidateOccurrence[]>([]);
  const [isLinking, startLinkTransition] = useTransition();

  const handleOpenLinkPicker = async (txId: string) => {
    setLinkingTxId(txId);
    const result = await getCandidateOccurrencesForTransaction(txId);
    if (result.success) {
      setOccurrenceCandidates(result.data);
    } else {
      toast.error(result.error ?? "Error al buscar recurrentes");
      setLinkingTxId(null);
    }
  };

  const handleConfirmLink = (occurrenceId: string) => {
    if (!linkingTxId) return;
    const txId = linkingTxId;
    setLinkingTxId(null);
    startLinkTransition(async () => {
      const result = await linkExistingTransactionToOccurrence(occurrenceId, txId);
      if (result.success) {
        toast.success("Transacción vinculada a recurrente");
        // Refresh linkable accounts — some may no longer have pending occurrences
        getAccountIdsWithPendingOccurrences().then((ids) => setLinkableAccountIds(new Set(ids)));
      } else {
        toast.error(result.error ?? "No se pudo vincular");
      }
    });
  };

  if (transactions.length === 0) return null;

  const visible = transactions.slice(0, 3);

  return (
    <div>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-z-sage-dark">
        Reciente
      </p>

      <div>
        {visible.map((tx) => {
          const isOpen = expandedId === tx.id;
          const optimisticCat = optimisticCategories[tx.id];
          const categoryIcon = optimisticCat?.icon ?? tx.category_icon;
          const categoryName = optimisticCat?.name ?? tx.category_name;
          return (
            <div
              key={tx.id}
              ref={(el) => {
                rowRefs.current[tx.id] = el;
              }}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={isOpen ? `Cerrar detalles de ${tx.description}` : `Ver acciones para ${tx.description}`}
                onClick={() => {
                  const willOpen = !isOpen;
                  setExpandedId(willOpen ? tx.id : null);
                  if (willOpen) {
                    setOpenedOnceIds((prev) => {
                      if (prev.has(tx.id)) return prev;
                      const next = new Set(prev);
                      next.add(tx.id);
                      return next;
                    });
                    // Defer to next frame so the expanded panel has mounted before scrolling.
                    requestAnimationFrame(() => {
                      rowRefs.current[tx.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    });
                  }
                }}
                className={cn(
                  "flex w-full gap-2 px-1 py-2 text-left transition-colors active:bg-white/[0.03]",
                  isOpen && "border-l-2 border-l-z-brass pl-2"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-md",
                    tx.direction === "INFLOW"
                      ? "bg-z-income/12 text-z-income"
                      : "bg-z-expense/12 text-z-expense"
                  )}
                >
                  {tx.direction === "INFLOW" ? (
                    <ArrowDownLeft className="size-3" />
                  ) : (
                    <ArrowUpRight className="size-3" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{tx.description}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span
                      className="inline-block size-[5px] shrink-0 rounded-full"
                      style={{ backgroundColor: tx.account_color ?? undefined }}
                    />
                    <span className="truncate">{tx.account_name}</span>
                    {categoryIcon && categoryName && (
                      <>
                        <span className="text-white/15">&middot;</span>
                        <span className="inline-flex items-center gap-0.5 truncate">
                          <CategoryIcon icon={categoryIcon} className="size-3 shrink-0" />
                          {categoryName}
                        </span>
                      </>
                    )}
                  </p>
                  {tx.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tx.tags.map((t) => (
                        <TagChip
                          key={t.id}
                          tag={{ name: t.name, color: t.color }}
                          groupColor={t.group_color}
                          size="sm"
                        />
                      ))}
                    </div>
                  )}
                </div>

                <span
                  className={cn(
                    "shrink-0 text-xs font-medium tabular-nums",
                    tx.direction === "INFLOW" && "text-z-income"
                  )}
                >
                  {tx.direction === "INFLOW" ? "+" : "-"}
                  {formatCurrency(tx.amount, tx.currency_code)}
                </span>
              </button>

              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className={cn("py-1.5 transition-opacity duration-150", isOpen ? "opacity-100" : "opacity-0")}>
                    <div className={cn(PANEL_INSET_CLASS, "space-y-2 border-z-brass/15 bg-black/20 p-2.5")}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {tx.direction === "INFLOW" ? "Ingreso" : "Gasto"} &middot; {formatCurrency(tx.amount, tx.currency_code)}
                        </span>
                        <div className="flex items-center gap-2">
                          {linkableAccountIds.has(tx.account_id) && !tx.recurrence_group_id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenLinkPicker(tx.id);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
                            >
                              <Link2 className="size-2.5" />
                              Vincular
                            </button>
                          )}
                          <Link
                            href={`/transactions/${tx.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
                          >
                            <Pencil className="size-2.5" />
                            Ver detalle
                          </Link>
                        </div>
                      </div>
                      {/* OUTFLOW only; INFLOW txs use Ver detalle for the full form.
                          Lazy-mounted via openedOnceIds so the picker tree is not hydrated for rows the user never expands. */}
                      {tx.direction === "OUTFLOW" && openedOnceIds.has(tx.id) && (
                        <div className="border-t border-white/6 pt-2">
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Asignar categoría
                          </p>
                          <CategoryPickerBody
                            categories={outflowCategories}
                            value={optimisticCat?.id ?? tx.category_id}
                            onSelect={(id) => {
                              if (id) handleAssignCategory(tx.id, id);
                            }}
                            onCategoryCreated={() => { /* no-op inline — user creates via /categories */ }}
                            suggestion={null}
                            direction="OUTFLOW"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/transactions"
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
      >
        Ver todos
        <ArrowRight className="size-3" />
      </Link>

      {/* Link to recurring sheet */}
      {linkingTxId && (
        <LinkPickerSheet
          open={!!linkingTxId}
          onOpenChange={(open) => { if (!open) setLinkingTxId(null); }}
          title="Vincular a recurrente"
          subtitle={(() => {
            const tx = transactions.find((t) => t.id === linkingTxId);
            return tx ? `${tx.description} · ${formatCurrency(tx.amount, tx.currency_code)}` : "";
          })()}
          candidates={occurrenceCandidates.map((o) => ({
            id: o.id,
            label: o.merchant,
            sublabel: `${formatDate(o.occurrenceDate)} · ${formatCurrency(o.expectedAmount, o.currencyCode as CurrencyCode)} esperado`,
            amount: o.expectedAmount,
            currencyCode: o.currencyCode,
            direction: transactions.find((t) => t.id === linkingTxId)?.direction ?? "OUTFLOW",
            matchScore: o.matchScore,
          }))}
          onConfirm={handleConfirmLink}
          isPending={isLinking}
        />
      )}
    </div>
  );
}
