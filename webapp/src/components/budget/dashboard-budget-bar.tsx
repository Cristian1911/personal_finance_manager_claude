"use client";

import { formatCurrency } from "@/lib/utils/currency";
import type { CategorySpending } from "@/actions/charts";
import Link from "next/link";

interface DashboardBudgetBarProps {
  data: CategorySpending[];
  monthLabel: string;
}

export function DashboardBudgetBar({ data, monthLabel }: DashboardBudgetBarProps) {
  return (
    <Link href="/categories" className="block">
      <div className="rounded-lg border bg-card p-4 space-y-3 hover:bg-accent/50 transition-colors">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Gasto por categoría</p>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
        </div>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              {data.map((c) => (
                <div
                  key={c.categoryId ?? c.name}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${c.percentage}%`,
                    backgroundColor: c.color,
                  }}
                  title={`${c.name}: ${formatCurrency(c.amount)}`}
                />
              ))}
            </div>

            {/* Legend (top 5) */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {data.slice(0, 5).map((c) => (
                <div key={c.categoryId ?? c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
