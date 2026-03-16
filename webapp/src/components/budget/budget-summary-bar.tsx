"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData } from "@/types/domain";

interface BudgetSummaryBarProps {
  categories: CategoryBudgetData[];
  daysRemaining: number;
  monthLabel: string;
}

export function BudgetSummaryBar({
  categories,
  daysRemaining,
  monthLabel,
}: BudgetSummaryBarProps) {
  const totalBudget = categories.reduce(
    (sum, c) => sum + (c.budget ?? 0),
    0
  );
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
  const totalRecurring = categories.reduce((sum, c) => sum + c.committedRecurring, 0);
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const budgetedCategories = categories.filter(
    (c) => c.budget && c.budget > 0 && c.spent > 0
  );

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
          <p className="text-lg font-semibold">
            {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-lg font-semibold",
              overallPercent > 100
                ? "text-z-debt"
                : overallPercent > 80
                  ? "text-z-expense"
                  : "text-foreground"
            )}
          >
            {Math.round(overallPercent)}%
          </p>
          <p className="text-sm text-muted-foreground">
            {daysRemaining} {daysRemaining === 1 ? "día" : "días"} restantes
          </p>
          {totalRecurring > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalRecurring)} en fijos
            </p>
          )}
        </div>
      </div>

      {/* Stacked horizontal progress bar */}
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
        {totalBudget > 0 &&
          budgetedCategories.map((cat) => {
            const segmentWidth = ((cat.budget ?? 0) / totalBudget) * 100;
            const fillPercent = Math.min(
              cat.spent / (cat.budget ?? 1),
              1
            );
            return (
              <div
                key={cat.id}
                className="relative h-full"
                style={{ width: `${segmentWidth}%` }}
              >
                <div
                  className="absolute inset-y-0 left-0 h-full transition-all"
                  style={{
                    width: `${fillPercent * 100}%`,
                    backgroundColor: cat.color,
                  }}
                />
              </div>
            );
          })}
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {budgetedCategories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: cat.color }}
            />
            {cat.name_es ?? cat.name}
          </div>
        ))}
      </div>
    </div>
  );
}
