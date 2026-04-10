"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { LANDING_BUDGET_DATA } from "./landing-data";

function getOverallColor(pct: number): string {
  if (pct > 85) return "text-z-debt";
  if (pct > 70) return "text-z-alert";
  return "text-z-income";
}

export function LandingBudget() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const totalSpent = LANDING_BUDGET_DATA.reduce((sum, cat) => sum + cat.spent, 0);
  const totalBudget = LANDING_BUDGET_DATA.reduce((sum, cat) => sum + cat.budget, 0);
  const overallPct = Math.round((totalSpent / totalBudget) * 100);

  return (
    <section className="py-16 sm:py-24 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-4 border-white/12 text-z-brass">
            Presupuesto
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            ¿En qué se va tu dinero?
          </h2>
          <p className="mt-4 text-base text-white/52">
            Visualiza cada categoría, identifica dónde se rompe el plan y mantén el control sin
            adivinar.
          </p>
        </div>

        <Card className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-medium text-white/70">Gasto total del mes</span>
                <span className={`text-lg font-bold ${getOverallColor(overallPct)}`}>
                  {overallPct}%
                </span>
              </div>
              <div className="mb-1 h-3 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-white/40 transition-all duration-500"
                  style={{ width: `${Math.min(overallPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/40">
                <span>{formatCurrency(totalSpent, "COP")}</span>
                <span>{formatCurrency(totalBudget, "COP")}</span>
              </div>
            </div>

            <div className="space-y-5">
              {LANDING_BUDGET_DATA.map((cat, idx) => {
                const pct = Math.round((cat.spent / cat.budget) * 100);
                const isHovered = hoveredIdx === idx;

                return (
                  <div
                    key={cat.name}
                    className="group cursor-default"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onTouchStart={() => setHoveredIdx(idx)}
                    onTouchEnd={() => setHoveredIdx(null)}
                  >
                    {/* Label row */}
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white/80">
                        <span className="text-base leading-none">{cat.icon}</span>
                        {cat.name}
                      </span>
                      <span className="text-sm font-medium tabular-nums text-white/60">
                        {isHovered
                          ? `${formatCurrency(cat.spent, "COP")} / ${formatCurrency(cat.budget, "COP")}`
                          : `${pct}%`}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="h-3 w-full overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
