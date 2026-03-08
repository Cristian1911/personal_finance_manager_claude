"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { Badge } from "@/components/ui/badge";
import type { CategoryBudgetData } from "@/types/domain";

interface TrendComparisonProps {
  categories: CategoryBudgetData[];
}

export function TrendComparison({ categories }: TrendComparisonProps) {
  const withSpending = categories.filter(
    (c) => c.spent > 0 || c.average3m > 0
  );

  if (withSpending.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No hay datos de gasto aun para comparar tendencias.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {withSpending.map((cat) => {
        const diff =
          cat.average3m > 0
            ? ((cat.spent - cat.average3m) / cat.average3m) * 100
            : 0;
        const showAnomaly = Math.abs(diff) > 30 && cat.average3m > 0;
        const maxValue = Math.max(cat.spent, cat.average3m, 1);

        return (
          <div key={cat.id} className="space-y-2">
            {/* Category header */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {cat.name_es ?? cat.name}
              </span>
              {showAnomaly && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5",
                    diff > 0
                      ? "border-red-200 text-red-600"
                      : "border-green-200 text-green-600"
                  )}
                >
                  {diff > 0 ? "+" : ""}
                  {Math.round(diff)}% vs promedio
                </Badge>
              )}
            </div>

            {/* This month bar */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-28 shrink-0">
                  Este mes
                </span>
                <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(cat.spent / maxValue) * 100}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
                <span className="text-xs font-medium w-24 text-right shrink-0">
                  {formatCurrency(cat.spent)}
                </span>
              </div>

              {/* Average 3m bar */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-28 shrink-0">
                  Promedio 3 meses
                </span>
                <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-muted-foreground/30 transition-all"
                    style={{
                      width: `${(cat.average3m / maxValue) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium w-24 text-right shrink-0">
                  {formatCurrency(cat.average3m)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
