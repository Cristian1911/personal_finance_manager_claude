"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { categorizeTransaction } from "@/actions/categorize";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { formatDate } from "@/lib/utils/date";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Home,
  Utensils,
  Car,
  HeartPulse,
  Sparkles,
  Shield,
  Briefcase,
  PlusCircle,
  Tag,
} from "lucide-react";
import { StaggerList, StaggerItem } from "./motion";
import type { CategoryBudgetData, CategoryWithChildren, TransactionWithRelations } from "@/types/domain";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  shield: Shield,
  briefcase: Briefcase,
  "plus-circle": PlusCircle,
  tag: Tag,
};

export interface MobilePresupuestoProps {
  uncategorizedTransactions: TransactionWithRelations[];
  budgetCategories: CategoryBudgetData[];
  categoryTree: CategoryWithChildren[];
}

export function MobilePresupuesto({
  uncategorizedTransactions,
  budgetCategories,
  categoryTree,
}: MobilePresupuestoProps) {
  const [inboxExpanded, setInboxExpanded] = useState(true);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visibleInbox = uncategorizedTransactions
    .filter((tx) => !dismissed.has(tx.id))
    .slice(0, 10);

  const activeBudgets = budgetCategories.filter(
    (c) => c.budget !== null && c.budget > 0
  );

  const unbudgeted = budgetCategories.filter(
    (c) => (c.budget === null || c.budget === 0) && c.spent > 0
  );

  function handleCategorize(txId: string, categoryId: string | null) {
    if (!categoryId) return;
    // Optimistically remove from list
    setDismissed((prev) => new Set(prev).add(txId));
    startTransition(async () => {
      const result = await categorizeTransaction(txId, categoryId);
      if (!result.success) {
        // Revert on failure
        setDismissed((prev) => {
          const next = new Set(prev);
          next.delete(txId);
          return next;
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Budget Progress */}
      {activeBudgets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Con presupuesto
          </h3>
          <StaggerList className="space-y-3">
            {activeBudgets.map((cat) => (
              <StaggerItem key={cat.id}>
                <BudgetRow category={cat} />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}

      {/* Unbudgeted categories with spending */}
      {unbudgeted.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sin presupuesto
          </h3>
          <div className="space-y-3">
            {unbudgeted.map((cat) => (
              <UnbudgetedRow key={cat.id} category={cat} />
            ))}
          </div>
        </div>
      )}

      {/* Categorization Inbox */}
      {visibleInbox.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setInboxExpanded(!inboxExpanded)}
            className="flex w-full items-center gap-2 mb-2"
            aria-label={`${visibleInbox.length} transacciones sin categoría`}
            aria-expanded={inboxExpanded}
          >
            <AlertTriangle className="size-4 text-z-alert" />
            <span className="text-sm font-semibold">
              {visibleInbox.length} sin categoría
            </span>
            {inboxExpanded ? (
              <ChevronDown className="size-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground ml-auto" />
            )}
          </button>

          {inboxExpanded && (
            <StaggerList className="rounded-lg border p-3 space-y-2">
              {visibleInbox.map((tx) => (
                <StaggerItem key={tx.id}>
                <InboxRow
                  key={tx.id}
                  transaction={tx}
                  categoryTree={categoryTree}
                  onCategorize={handleCategorize}
                  disabled={isPending}
                  isExpanded={expandedTxId === tx.id}
                  onToggleExpand={() =>
                    setExpandedTxId(expandedTxId === tx.id ? null : tx.id)
                  }
                />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </div>
      )}

      {activeBudgets.length === 0 && unbudgeted.length === 0 && visibleInbox.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay presupuestos configurados.
        </p>
      )}
    </div>
  );
}

function InboxRow({
  transaction,
  categoryTree,
  onCategorize,
  disabled,
  isExpanded,
  onToggleExpand,
}: {
  transaction: TransactionWithRelations;
  categoryTree: CategoryWithChildren[];
  onCategorize: (txId: string, categoryId: string | null) => void;
  disabled: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const tx = transaction;
  const description =
    tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "Sin descripción";
  const isOutflow = tx.direction === "OUTFLOW";

  return (
    <div>
      {/* Compact row — tappable */}
      <div
        className="flex items-center gap-2 cursor-pointer rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate">{description}</p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-medium tabular-nums",
            isOutflow ? "text-z-debt" : "text-z-income"
          )}
        >
          {isOutflow ? "-" : "+"}
          {formatCurrency(tx.amount, tx.currency_code)}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            !isExpanded && "-rotate-90"
          )}
        />
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-2 space-y-3 rounded-lg bg-muted/30 p-3">
          {/* Direction + description + amount */}
          <div className="flex items-start gap-2">
            <div
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                isOutflow
                  ? "bg-z-debt/10 text-z-debt"
                  : "bg-z-income/10 text-z-income"
              )}
            >
              {isOutflow ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownLeft className="size-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{description}</p>
              {tx.raw_description && tx.raw_description !== description && (
                <p className="text-xs text-muted-foreground truncate">
                  {tx.raw_description}
                </p>
              )}
            </div>
          </div>

          {/* Account + date */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {tx.account && (
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: tx.account.color ?? undefined }}
                />
                {tx.account.name}
              </span>
            )}
            <span>{formatDate(tx.transaction_date, "dd MMM yyyy")}</span>
          </div>

          {/* Category picker — full width */}
          <CategoryCombobox
            categories={categoryTree}
            value={null}
            onValueChange={(id) => onCategorize(tx.id, id)}
            direction={tx.direction}
            placeholder="Elegir categoría"
            triggerClassName="w-full h-9 text-sm"
          />
        </div>
      )}
    </div>
  );
}

function UnbudgetedRow({ category }: { category: CategoryBudgetData }) {
  const IconComp = ICON_MAP[category.icon] ?? Tag;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${category.color}20`, color: category.color }}
        >
          <IconComp className="size-3.5" />
        </span>
        <span className="text-sm font-medium truncate">
          {category.name_es ?? category.name}
        </span>
      </div>
      <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap ml-2">
        {formatCurrency(category.spent)}
      </span>
    </div>
  );
}

function BudgetRow({ category }: { category: CategoryBudgetData }) {
  const IconComp = ICON_MAP[category.icon] ?? Tag;
  const percent = category.percentUsed;

  const barColor =
    percent > 90
      ? "bg-z-debt"
      : percent >= 70
        ? "bg-z-expense"
        : "bg-z-income";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            <IconComp className="size-3.5" />
          </span>
          <span className="text-sm font-medium truncate">
            {category.name_es ?? category.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {percent > 90 && <AlertTriangle className="size-3.5 text-z-debt" />}
          {percent >= 70 && percent <= 90 && <AlertCircle className="size-3.5 text-z-expense" />}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatCurrency(category.spent)} / {formatCurrency(category.budget!)}
          </span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
