"use client";

import { useState, useMemo, useTransition } from "react";
import { Check } from "lucide-react";
import { CategoryIcon } from "@/components/categories/category-icon";
import { CurrencyInput } from "@/components/ui/currency-input";
import { upsertBudgetForCategory } from "@/actions/budget";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface BudgetZeroBasedProps {
  categories: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
}

export function BudgetZeroBased({
  categories,
  income,
  currency,
}: BudgetZeroBasedProps) {
  // Only outflow parent categories
  const outflowCategories = useMemo(
    () => categories.filter((c) => c.direction === "OUTFLOW"),
    [categories],
  );

  // Local state for all budget amounts — initialized from server data
  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, number>>(
    () => {
      const initial: Record<string, number> = {};
      for (const cat of outflowCategories) {
        initial[cat.id] = cat.budget ?? 0;
      }
      return initial;
    },
  );

  const [, startTransition] = useTransition();

  // Computed totals
  const totalAssigned = useMemo(
    () => Object.values(budgetAmounts).reduce((sum, v) => sum + v, 0),
    [budgetAmounts],
  );

  const remaining = income - totalAssigned;
  const ratio = income > 0 ? Math.min(totalAssigned / income, 1) : 0;
  const overAssigned = remaining < 0;
  const exactZero = remaining === 0 && income > 0;
  const lowRemaining = !overAssigned && !exactZero && remaining / income <= 0.1;

  function handleAmountChange(categoryId: string, raw: string) {
    const num = parseFloat(raw) || 0;
    setBudgetAmounts((prev) => ({ ...prev, [categoryId]: num }));
  }

  function handleBlur(categoryId: string) {
    const amount = budgetAmounts[categoryId] ?? 0;
    startTransition(async () => {
      await upsertBudgetForCategory(categoryId, amount);
    });
  }

  // Bar color
  const barColor = overAssigned
    ? "bg-red-500"
    : exactZero
      ? "bg-emerald-500"
      : lowRemaining
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="space-y-4">
      {/* ── Sticky Assignment Bar ── */}
      <div className="sticky top-0 z-10 bg-z-bg pb-2">
        <div className="rounded-2xl border border-white/6 bg-z-surface-2/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="h-3 flex-1 rounded-full bg-z-surface-3">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{ width: `${Math.min(ratio * 100, 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-bold">
              {overAssigned ? (
                <span className="text-red-400">
                  {formatCurrency(Math.abs(remaining), currency)} sobre-asignado
                </span>
              ) : exactZero ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="size-4" />
                  Todo asignado
                </span>
              ) : (
                <span
                  className={cn(
                    lowRemaining ? "text-amber-400" : "text-foreground",
                  )}
                >
                  {formatCurrency(remaining, currency)} por asignar
                </span>
              )}
            </span>
          </div>

          {/* Income label */}
          <p className="text-muted-foreground mt-1 text-xs">
            Ingreso: {formatCurrency(income, currency)}
          </p>
        </div>
      </div>

      {/* ── Category List ── */}
      <div className="space-y-3">
        {outflowCategories.map((cat) => {
          const assigned = budgetAmounts[cat.id] ?? 0;
          const spent = cat.spent;
          const spentRatio = assigned > 0 ? Math.min(spent / assigned, 1) : 0;

          // Spent bar color
          const spentBarColor =
            assigned === 0
              ? "bg-muted"
              : spent > assigned
                ? "bg-red-500"
                : spent / assigned > 0.8
                  ? "bg-amber-500"
                  : "bg-emerald-500";

          return (
            <div
              key={cat.id}
              className="rounded-xl border border-white/6 bg-card p-4"
              style={{ borderLeft: `4px solid ${cat.color}` }}
            >
              {/* Row: icon + name | input */}
              <div className="flex items-center gap-3">
                <CategoryIcon
                  icon={cat.icon}
                  className="text-muted-foreground size-5 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {cat.name_es ?? cat.name}
                </span>
                <div className="w-32 shrink-0">
                  <CurrencyInput
                    value={assigned}
                    className="h-8 text-right text-sm"
                    onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                    onBlur={() => handleBlur(cat.id)}
                  />
                </div>
              </div>

              {/* Progress: spent vs assigned */}
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-z-surface-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      spentBarColor,
                    )}
                    style={{ width: `${spentRatio * 100}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {assigned === 0 ? (
                    "Sin asignar"
                  ) : (
                    <>
                      {formatCurrency(spent, currency)} gastado
                      {assigned > 0 && (
                        <span className="ml-1">
                          · {Math.round((spent / assigned) * 100)}% ejecutado
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
