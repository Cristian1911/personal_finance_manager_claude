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

  const fixedCats = categories.filter((c) => c.expense_type === "fixed" && c.budget && c.budget > 0);
  const varCats = categories.filter((c) => c.expense_type === "variable" && c.budget && c.budget > 0);
  const totalFixed = fixedCats.reduce((s, c) => s + (c.budget ?? 0), 0);
  const totalFixedSpent = fixedCats.reduce((s, c) => s + c.spent, 0);
  const totalVariable = varCats.reduce((s, c) => s + (c.budget ?? 0), 0);
  const totalVariableSpent = varCats.reduce((s, c) => s + c.spent, 0);
  const hasArchetypes = totalFixed > 0 || totalVariable > 0;

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
                ? "text-red-600"
                : overallPercent > 80
                  ? "text-amber-600"
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

      {hasArchetypes && (
        <div className="flex gap-4 text-xs">
          {totalFixed > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground/50 shrink-0" />
              <span className="text-muted-foreground">
                Fijo: {formatCurrency(totalFixedSpent)} / {formatCurrency(totalFixed)}
                <span className="ml-1 font-medium text-foreground">
                  {Math.round((totalFixedSpent / totalFixed) * 100)}%
                </span>
              </span>
            </div>
          )}
          {totalVariable > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-z-income shrink-0" />
              <span className="text-muted-foreground">
                Variable: {formatCurrency(totalVariableSpent)} / {formatCurrency(totalVariable)}
                <span className="ml-1 font-medium text-foreground">
                  {Math.round((totalVariableSpent / totalVariable) * 100)}%
                </span>
              </span>
            </div>
          )}
        </div>
      )}

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
