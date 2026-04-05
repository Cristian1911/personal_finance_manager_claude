"use client";

import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { PlanBudgetHero } from "./plan-budget-hero";
import type { PlanPressure } from "@/types/plan";
import type { CurrencyCode, CategoryBudgetData } from "@/types/domain";

interface PlanHeroWrapperProps {
  totalSpent: number;
  totalBudgeted: number;
  pressure: PlanPressure;
  dayOfMonth: number;
  daysInMonth: number;
  currency: CurrencyCode;
  categories: CategoryBudgetData[];
}

export function PlanHeroWrapper(props: PlanHeroWrapperProps) {
  const { activeZone, toggle } = useExpandableZone<string>();

  return (
    <PlanBudgetHero
      {...props}
      expanded={activeZone === "hero"}
      onToggle={() => toggle("hero")}
    />
  );
}
