"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { CategoryIcon } from "@/components/categories/category-icon";
import { CurrencyInput } from "@/components/ui/currency-input";
import { upsertBudgetForCategory } from "@/actions/budget";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface BudgetPerCategoryProps {
  categories: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
}

// --- Inline edit cell ---------------------------------------------------

function InlineBudgetEditor({
  categoryId,
  initialAmount,
  currency,
  onSave,
}: {
  categoryId: string;
  initialAmount: number;
  currency: CurrencyCode;
  onSave: (categoryId: string, amount: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(initialAmount || ""));
  const inputRef = useRef<HTMLDivElement>(null);

  // Focus the inner <input> when entering edit mode
  useEffect(() => {
    if (editing) {
      const input = inputRef.current?.querySelector("input");
      input?.focus();
      input?.select();
    }
  }, [editing]);

  function commit() {
    const num = parseFloat(draft) || 0;
    setEditing(false);
    onSave(categoryId, num);
  }

  if (!editing) {
    if (initialAmount > 0) {
      return (
        <button
          onClick={() => {
            setDraft(String(initialAmount));
            setEditing(true);
          }}
          className="text-sm font-semibold tabular-nums hover:text-primary transition-colors"
        >
          {formatCurrency(initialAmount, currency)}
        </button>
      );
    }

    return (
      <button
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="size-3.5" />
        Asignar
      </button>
    );
  }

  return (
    <div ref={inputRef} className="w-28">
      <CurrencyInput
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className="h-7 text-sm px-2"
        placeholder="0"
      />
    </div>
  );
}

// --- Main component -----------------------------------------------------

export function BudgetPerCategory({
  categories,
  income,
  currency,
}: BudgetPerCategoryProps) {
  const [, startTransition] = useTransition();

  // Optimistic local budget state
  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, number>>(
    () => {
      const map: Record<string, number> = {};
      for (const cat of categories) {
        if (cat.budget !== null && cat.budget > 0) {
          map[cat.id] = cat.budget;
        }
      }
      return map;
    }
  );

  const outflowCategories = useMemo(
    () => categories.filter((c) => c.direction === "OUTFLOW"),
    [categories],
  );

  const assigned = useMemo(
    () => Object.values(budgetAmounts).reduce((s, v) => s + v, 0),
    [budgetAmounts],
  );
  const remaining = income - assigned;

  function handleSave(categoryId: string, amount: number) {
    // Optimistic update
    setBudgetAmounts((prev) => {
      if (amount <= 0) {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      }
      return { ...prev, [categoryId]: amount };
    });

    // Sync to server
    startTransition(async () => {
      await upsertBudgetForCategory(categoryId, amount);
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Ingreso" value={income} currency={currency} />
        <SummaryCard label="Asignado" value={assigned} currency={currency} />
        <SummaryCard
          label="Libre"
          value={remaining}
          currency={currency}
          negative={remaining < 0}
        />
      </div>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {outflowCategories.map((cat) => {
          const budget = budgetAmounts[cat.id] ?? 0;
          const ratio = budget > 0 ? cat.spent / budget : 0;
          const barColor =
            budget === 0
              ? "bg-muted-foreground/30"
              : ratio > 1
                ? "bg-red-500"
                : ratio >= 0.75
                  ? "bg-yellow-500"
                  : "bg-emerald-500";

          return (
            <div
              key={cat.id}
              className="rounded-2xl border border-white/6 bg-card p-4"
              style={{ borderLeft: `4px solid ${cat.color}` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `${cat.color}20`,
                      color: cat.color,
                    }}
                  >
                    <CategoryIcon icon={cat.icon} className="size-4" />
                  </span>
                  <span className="truncate text-sm font-medium">
                    {cat.name_es ?? cat.name}
                  </span>
                </div>

                <InlineBudgetEditor
                  categoryId={cat.id}
                  initialAmount={budget}
                  currency={currency}
                  onSave={handleSave}
                />
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    barColor
                  )}
                  style={{
                    width: `${Math.min(ratio * 100, 100)}%`,
                  }}
                />
              </div>

              {/* Footer */}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {budget > 0 ? (
                  <>
                    {formatCurrency(cat.spent, currency)} gastado de{" "}
                    {formatCurrency(budget, currency)}
                  </>
                ) : (
                  "Sin presupuesto"
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Summary stat card --------------------------------------------------

function SummaryCard({
  label,
  value,
  currency,
  negative,
}: {
  label: string;
  value: number;
  currency: CurrencyCode;
  negative?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          negative && "text-red-500"
        )}
      >
        {formatCurrency(value, currency)}
      </p>
    </div>
  );
}
