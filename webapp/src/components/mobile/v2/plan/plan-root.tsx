"use client";

import { Suspense } from "react";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PlanHeroWrapper } from "./plan-hero-wrapper";
import { PlanZoneChips } from "./plan-zone-chips";
import { PlanFlowChart } from "./plan-flow-chart";
import { PlanDistribution } from "./plan-distribution";
import { MonthSelector } from "@/components/month-selector";
import type { PlanPageData } from "@/types/plan";
import type { AllocationData } from "@/actions/allocation";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type { CurrencyCode, CategoryBudgetData } from "@/types/domain";

interface PlanRootProps {
  planData: PlanPageData;
  allocationData: AllocationData | null;
  timelineData: PlanTimelineData;
  currency: CurrencyCode;
  monthLabel: string;
  dayOfMonth: number;
  daysInMonth: number;
  categories: CategoryBudgetData[];
}

export function PlanRoot({
  planData,
  allocationData,
  timelineData,
  currency,
  monthLabel,
  dayOfMonth,
  daysInMonth,
  categories,
}: PlanRootProps) {
  const { activeZone, toggle } = useExpandableZone<string>();

  return (
    <div className="space-y-2">
      <MobileHeader
        variant="main"
        title="Plan"
        subtitle={`${monthLabel} · ${daysInMonth - dayOfMonth}d restantes`}
      />

      {/* Month navigation */}
      <div className="flex justify-center">
        <Suspense fallback={<span className="text-xs capitalize text-muted-foreground">{monthLabel}</span>}>
          <MonthSelector />
        </Suspense>
      </div>

      {/* Budget hero — expandable per-category (client boundary isolated) */}
      <PlanHeroWrapper
        totalSpent={planData.budget.totalSpent}
        totalBudgeted={planData.budget.totalBudgeted}
        pressure={planData.heroSummary.pressure}
        dayOfMonth={dayOfMonth}
        daysInMonth={daysInMonth}
        currency={currency}
        categories={categories}
      />

      {/* Expandable zone chips — presupuesto, obligaciones */}
      <PlanZoneChips
        budget={planData.budget}
        recurring={planData.recurring}
        currency={currency}
        activeZone={activeZone}
        onToggle={toggle}
      />

      {/* Flow chart — timeline with real+projected data */}
      <PlanFlowChart
        timelineData={timelineData}
        currency={currency}
      />

      {/* Distribution — budget-type aware */}
      <PlanDistribution allocation={allocationData} />

      {/* Scenarios — only when stable */}
      {planData.scenarios.count > 0 && (
        <div className="rounded-2xl border border-white/6 bg-black/10 px-3.5 py-3 text-center text-xs text-muted-foreground">
          {planData.scenarios.count} escenario{planData.scenarios.count !== 1 ? "s" : ""} guardado{planData.scenarios.count !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
