"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { MonthlyBreakdown } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

interface DeudasSalaryBarProps {
  breakdown: MonthlyBreakdown;
  currency: CurrencyCode;
}

export function DeudasSalaryBar({ breakdown, currency }: DeudasSalaryBarProps) {
  const { activeZone, toggle } = useExpandableZone<string>();
  const isOpen = activeZone === "salary";
  const { segments, freePercentage } = breakdown;

  return (
    <button
      type="button"
      onClick={() => toggle("salary")}
      className={cn(
        "block w-full text-left transition-colors",
        PANEL_INSET_CLASS,
        "p-3"
      )}
      aria-expanded={isOpen}
    >
      {/* Collapsed: bar + label */}
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage-dark">
          Tu salario
        </p>
        <p className="text-[11px] font-semibold text-z-sage-light">
          {freePercentage.toFixed(0)}% libre
        </p>
      </div>

      {/* Stacked bar — always visible */}
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((seg) => (
          <div
            key={seg.accountId}
            className="h-full transition-all"
            style={{
              width: `${Math.max(seg.percentage, 1)}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>

      {/* Expanded: legend */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-2.5 space-y-1 transition-opacity duration-150",
              isOpen ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {segments.map((seg) => (
              <div
                key={seg.accountId}
                className="flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-z-sage-light">{seg.name}</span>
                </div>
                <span className="font-medium text-z-sage-light">
                  {formatCurrency(seg.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
