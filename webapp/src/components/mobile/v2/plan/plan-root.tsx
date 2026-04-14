"use client";

import { Suspense } from "react";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PlanNetHero } from "./plan-net-hero";
import { PlanExpandableChips } from "./plan-expandable-chips";
import { PlanDrillCards } from "./plan-drill-cards";
import { MonthSelector } from "@/components/month-selector";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { PlanPageData } from "@/types/plan";
import type { PlanTimelineData } from "@/actions/plan-timeline";
import type { CurrencyCode } from "@/types/domain";

interface PlanRootProps {
  planData: PlanPageData;
  timelineData: PlanTimelineData;
  currency: CurrencyCode;
  monthLabel: string;
  dayOfMonth: number;
  daysInMonth: number;
  periodoSummary: { hasActive: boolean; percentAssigned: number; unassignedCount?: number } | null;
  wishlistCount: number;
}

export function PlanRoot({
  planData,
  timelineData,
  currency,
  monthLabel,
  dayOfMonth,
  daysInMonth,
  periodoSummary,
  wishlistCount,
}: PlanRootProps) {
  const { activeZone, toggle } = useExpandableZone<string>();
  const incomes = planData.recurring.upcomingIncome;
  const payments = planData.recurring.upcoming;

  return (
    <div className="space-y-2 pb-20">
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

      {/* Net hero — ingresos vs gastos with expandable chart */}
      <PlanNetHero
        ingresos={planData.recurring.totalMonthlyIncome}
        gastos={planData.recurring.totalMonthlyExpenses}
        currency={currency}
        daysRemaining={daysInMonth - dayOfMonth}
        timelineData={timelineData}
      />

      {/* Expandable chips — próximo ingreso / próximo pago */}
      <PlanExpandableChips
        incomes={incomes}
        payments={payments}
        currency={currency}
        expanded={activeZone}
        onToggle={toggle}
      />

      {/* Drill cards — navigate to Presupuesto, Periodo, Recurrentes, Deseos */}
      <PlanDrillCards
        budget={planData.budget}
        recurring={planData.recurring}
        periodoSummary={periodoSummary}
        wishlistCount={wishlistCount}
        currency={currency}
        expanded={activeZone}
        onToggle={toggle}
      />

      {/* Scenarios — only when stable */}
      {planData.scenarios.count > 0 && (
        <div className="rounded-2xl border border-white/6 bg-black/10 px-3.5 py-3 text-center text-xs text-muted-foreground">
          {planData.scenarios.count} escenario{planData.scenarios.count !== 1 ? "s" : ""} guardado{planData.scenarios.count !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
