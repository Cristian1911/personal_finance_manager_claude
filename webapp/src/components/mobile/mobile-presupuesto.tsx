"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { categorizeTransaction } from "@/actions/categorize";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import {
  AlertTriangle,
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

interface MobilePresupuestoProps {
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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visibleInbox = uncategorizedTransactions
    .filter((tx) => !dismissed.has(tx.id))
    .slice(0, 10);

  const activeBudgets = budgetCategories.filter(
    (c) => c.budget !== null && c.budget > 0
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
      {/* Categorization Inbox */}
      {visibleInbox.length > 0 && (
        <div>
          <button
            onClick={() => setInboxExpanded(!inboxExpanded)}
            className="flex w-full items-center gap-2 mb-2"
          >
            <AlertTriangle className="size-4 text-amber-500" />
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
            <div className="rounded-lg border p-3 space-y-2">
              {visibleInbox.map((tx) => (
                <InboxRow
                  key={tx.id}
                  transaction={tx}
                  categoryTree={categoryTree}
                  onCategorize={handleCategorize}
                  disabled={isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Budget Progress */}
      {activeBudgets.length > 0 && (
        <div className="space-y-3">
          {activeBudgets.map((cat) => (
            <BudgetRow key={cat.id} category={cat} />
          ))}
        </div>
      )}

      {activeBudgets.length === 0 && visibleInbox.length === 0 && (
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
}: {
  transaction: TransactionWithRelations;
  categoryTree: CategoryWithChildren[];
  onCategorize: (txId: string, categoryId: string | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">
          {transaction.merchant_name ?? transaction.clean_description ?? transaction.raw_description}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatCurrency(transaction.amount)}
        </p>
      </div>
      <CategoryCombobox
        categories={categoryTree}
        value={null}
        onValueChange={(id) => onCategorize(transaction.id, id)}
        direction={transaction.direction}
        placeholder="Categoría"
        triggerClassName="w-36 h-8 text-xs"
      />
    </div>
  );
}

function BudgetRow({ category }: { category: CategoryBudgetData }) {
  const IconComp = ICON_MAP[category.icon] ?? Tag;
  const percent = category.percentUsed;

  const barColor =
    percent > 90
      ? "bg-red-500"
      : percent >= 70
        ? "bg-amber-500"
        : "bg-green-500";

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
        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
          {formatCurrency(category.spent)} / {formatCurrency(category.budget!)}
        </span>
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
