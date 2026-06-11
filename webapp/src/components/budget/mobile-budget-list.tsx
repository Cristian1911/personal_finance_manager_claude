"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/categories/category-icon";
import { BudgetEditorSheet } from "./budget-editor-sheet";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { CategoryBudgetData, CurrencyCode, ExpenseType } from "@/types/domain";

interface MobileBudgetListProps {
  /** OUTFLOW categories with budget data for the current month. */
  categories: CategoryBudgetData[];
  currency: CurrencyCode;
}

export function MobileBudgetList({ categories, currency }: MobileBudgetListProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localCategories, setLocalCategories] = useState(categories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showUnbudgeted, setShowUnbudgeted] = useState(false);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const budgeted = localCategories.filter((c) => (c.budget ?? 0) > 0);
  const over = budgeted
    .filter((c) => c.percentUsed > 100)
    .sort((a, b) => b.percentUsed - a.percentUsed);
  const near = budgeted
    .filter((c) => c.percentUsed >= 85 && c.percentUsed <= 100)
    .sort((a, b) => b.percentUsed - a.percentUsed);
  const safe = budgeted
    .filter((c) => c.percentUsed < 85)
    .sort((a, b) => a.percentUsed - b.percentUsed);
  const unbudgeted = localCategories
    .filter((c) => c.is_active && (c.budget ?? 0) <= 0)
    .sort((a, b) => b.average3m - a.average3m);

  const editing = localCategories.find((c) => c.id === editingId) ?? null;

  function openEditor(categoryId: string) {
    setEditingId(categoryId);
    setSheetOpen(true);
  }

  function handleSaved(categoryId: string, amount: number, expenseType: ExpenseType | null) {
    setLocalCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              budget: amount,
              expense_type: expenseType,
              percentUsed: amount > 0 ? (c.spent / amount) * 100 : 0,
            }
          : c
      )
    );
    startTransition(() => router.refresh());
  }

  function handleDeleted(categoryId: string) {
    setLocalCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, budget: null, percentUsed: 0 } : c))
    );
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="space-y-5">
        {over.length > 0 && (
          <RiskSection label="Sobre límite" labelClass="text-z-expense" items={over} currency={currency} onEdit={openEditor} />
        )}
        {near.length > 0 && (
          <RiskSection label="Cerca del límite" labelClass="text-z-brass" items={near} currency={currency} onEdit={openEditor} />
        )}
        {safe.length > 0 && (
          <RiskSection label="Dentro del límite" labelClass="text-z-income" items={safe} currency={currency} onEdit={openEditor} />
        )}

        {unbudgeted.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowUnbudgeted((v) => !v)}
              className="flex w-full items-center justify-between"
              aria-expanded={showUnbudgeted}
            >
              <p className={SECTION_EYEBROW_CLASS}>Sin límite</p>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {unbudgeted.length}
                {showUnbudgeted ? (
                  <ChevronDown className="size-3" strokeWidth={1.5} />
                ) : (
                  <ChevronRight className="size-3" strokeWidth={1.5} />
                )}
              </span>
            </button>
            {showUnbudgeted && (
              <div className="mt-2 space-y-1">
                {unbudgeted.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => openEditor(cat.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left transition-colors active:bg-white/5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                      >
                        <CategoryIcon icon={cat.icon} className="size-3.5" />
                      </span>
                      <span className="truncate text-sm font-medium">
                        {cat.name_es ?? cat.name}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                      {cat.average3m > 0
                        ? `Prom. ${formatCurrency(Math.round(cat.average3m), currency)}`
                        : "Fijar límite"}
                      <ChevronRight className="size-3" strokeWidth={1.5} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <BudgetEditorSheet
        category={editing}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currency={currency}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────────

function RiskSection({
  label,
  labelClass,
  items,
  currency,
  onEdit,
}: {
  label: string;
  labelClass: string;
  items: CategoryBudgetData[];
  currency: CurrencyCode;
  onEdit: (categoryId: string) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className={cn(SECTION_EYEBROW_CLASS, labelClass)}>{label}</p>
        <span className="text-[10px] text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-3">
        {items.map((cat) => (
          <BudgetCategoryRow key={cat.id} category={cat} currency={currency} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}

function BudgetCategoryRow({
  category,
  currency,
  onEdit,
}: {
  category: CategoryBudgetData;
  currency: CurrencyCode;
  onEdit: (categoryId: string) => void;
}) {
  const pct = category.percentUsed;
  const isOver = pct > 100;
  const isWarning = pct >= 85 && pct <= 100;

  const barColor = isOver ? "bg-z-debt" : isWarning ? "bg-z-alert" : "bg-z-income";

  return (
    <button
      type="button"
      onClick={() => onEdit(category.id)}
      aria-label={`Editar límite de ${category.name_es ?? category.name}`}
      className="block w-full space-y-1.5 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            <CategoryIcon icon={category.icon} className="size-3.5" />
          </span>
          <span className="truncate text-sm font-medium">
            {category.name_es ?? category.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              isOver ? "text-z-debt" : isWarning ? "text-z-alert" : "text-foreground"
            )}
          >
            {formatCurrency(category.spent, currency)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            / {formatCurrency(category.budget!, currency)}
          </span>
          <ChevronRight className="size-3 text-z-sage-dark" strokeWidth={1.5} />
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </button>
  );
}
