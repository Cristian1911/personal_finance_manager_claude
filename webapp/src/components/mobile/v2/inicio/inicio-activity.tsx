"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowRight,
  Repeat,
} from "lucide-react";
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryIcon } from "@/components/categories/category-icon";
import { TagChip } from "@/components/tags/tag-chip";
import {
  TransactionQuickActions,
  type QuickActionTransaction,
} from "@/components/transactions/transaction-quick-actions";
import { useCategories } from "@/components/providers/app-data-provider";
import { getAccountIdsWithPendingOccurrences } from "@/actions/occurrences";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";

type AccountTypeEnum = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "CASH" | "INVESTMENT" | "LOAN" | "OTHER";

interface RecentTransactionMobile {
  id: string;
  description: string;
  amount: number;
  currency_code: CurrencyCode;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  account_id: string;
  account_name: string;
  account_color: string | null;
  account_mask: string | null;
  account_bank_key: string | null;
  account_type: AccountTypeEnum;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  destinatario_id: string | null;
  destinatario_name: string | null;
  recurrence_group_id: string | null;
  personal_debt_id: string | null;
  transfer_group_id: string | null;
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

/** Adapt the lighter dashboard recent-tx shape to the shared action contract. */
function toQuickAction(tx: RecentTransactionMobile): QuickActionTransaction {
  return {
    id: tx.id,
    account_id: tx.account_id,
    direction: tx.direction,
    amount: tx.amount,
    currency_code: tx.currency_code,
    transaction_date: tx.transaction_date,
    raw_description: null,
    merchant_name: tx.description,
    clean_description: null,
    category: tx.category_id
      ? { id: tx.category_id, name: tx.category_name ?? "", name_es: tx.category_name, icon: tx.category_icon, color: null }
      : null,
    destinatario: tx.destinatario_id
      ? { id: tx.destinatario_id, name: tx.destinatario_name ?? "" }
      : null,
    // Recent feed never lists excluded transactions (query filters them out).
    is_excluded: false,
    recurrence_group_id: tx.recurrence_group_id,
    personal_debt_id: tx.personal_debt_id,
    transfer_group_id: tx.transfer_group_id,
  };
}

export function InicioActivity({ transactions }: InicioActivityProps) {
  const categories = useCategories();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Refs for each row so we can scroll the expanded panel into view above the tab bar.
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Optimistic category for the collapsed-row subtitle (the shared action surface
  // owns the actual mutation and reports the chosen category back).
  const [optimisticCategories, setOptimisticCategories] = useState<
    Record<string, { id: string; name: string; icon: string | null }>
  >({});

  // Accounts with pending recurring occurrences — enables "Vincular a recurrente".
  const [linkableAccountIds, setLinkableAccountIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    getAccountIdsWithPendingOccurrences().then((ids) => setLinkableAccountIds(new Set(ids)));
  }, []);

  if (transactions.length === 0) return null;

  const visible = transactions.slice(0, 3);

  function toggleExpand(txId: string) {
    const willOpen = expandedId !== txId;
    setExpandedId(willOpen ? txId : null);
    if (willOpen) {
      requestAnimationFrame(() => {
        rowRefs.current[txId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  function handleCategorized(txId: string, categoryId: string) {
    const category = findCategoryById(categories, categoryId);
    if (category) {
      setOptimisticCategories((prev) => ({ ...prev, [txId]: category }));
    }
  }

  return (
    <div>
      <p className={cn(SECTION_EYEBROW_CLASS, "mb-1.5")}>Reciente</p>

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
                onClick={() => toggleExpand(tx.id)}
                className={cn(
                  "flex w-full gap-2 px-1 py-2 text-left transition-colors active:bg-white/[0.03]",
                  isOpen && "border-l-2 border-l-z-brass pl-2",
                )}
              >
                {/* A transfer is neither spend nor income — every metric filters
                    it out, so the row must not paint it red or green. */}
                <div
                  className={cn(
                    "mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-md",
                    tx.transfer_group_id
                      ? "bg-white/[0.06] text-z-sage-light"
                      : tx.direction === "INFLOW"
                        ? "bg-z-income/12 text-z-income"
                        : "bg-z-expense/12 text-z-expense",
                  )}
                >
                  {tx.transfer_group_id ? (
                    <ArrowLeftRight className="size-3" />
                  ) : tx.direction === "INFLOW" ? (
                    <ArrowDownLeft className="size-3" />
                  ) : (
                    <ArrowUpRight className="size-3" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-xs font-medium">
                    {tx.recurrence_group_id && (
                      <>
                        <Repeat className="size-3 shrink-0 text-z-brass/70" aria-hidden="true" />
                        <span className="sr-only">Vinculado a recurrente:</span>
                      </>
                    )}
                    <span className="truncate">{tx.description}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <AccountRowIdentity
                      account={{
                        name: tx.account_name,
                        mask: tx.account_mask,
                        bank_key: tx.account_bank_key,
                        account_type: tx.account_type,
                        color: tx.account_color,
                      }}
                      density="compact"
                      className="truncate"
                    />
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
                    tx.transfer_group_id
                      ? "text-z-sage-light"
                      : tx.direction === "INFLOW" && "text-z-income",
                  )}
                >
                  {!tx.transfer_group_id && (tx.direction === "INFLOW" ? "+" : "-")}
                  {formatCurrency(tx.amount, tx.currency_code)}
                </span>
              </button>

              {/* Smooth expand → shared quick-action surface (same as Movimientos) */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className={cn("px-1 py-1.5 transition-opacity duration-150", isOpen ? "opacity-100" : "opacity-0")}>
                    <TransactionQuickActions
                      transaction={toQuickAction(tx)}
                      categories={categories}
                      tags={tx.tags}
                      linkableAccountIds={linkableAccountIds}
                      onCategorized={handleCategorized}
                    />
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
    </div>
  );
}
