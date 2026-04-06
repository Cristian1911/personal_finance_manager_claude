import { Suspense } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PlanHeroWrapper } from "./plan-hero-wrapper";
import { PlanActionCta } from "./plan-action-cta";
import { PlanFlowChart } from "./plan-flow-chart";
import { PlanDistribution } from "./plan-distribution";
import { MonthSelector } from "@/components/month-selector";
import { Wallet, ArrowRight } from "lucide-react";
import type { PlanPageData } from "@/types/plan";
import type { AllocationData } from "@/actions/allocation";
import type { CurrencyCode, CategoryBudgetData } from "@/types/domain";

interface PlanRootProps {
  planData: PlanPageData;
  allocationData: AllocationData | null;
  currency: CurrencyCode;
  monthLabel: string;
  dayOfMonth: number;
  daysInMonth: number;
  categories: CategoryBudgetData[];
}

export function PlanRoot({
  planData,
  allocationData,
  currency,
  monthLabel,
  dayOfMonth,
  daysInMonth,
  categories,
}: PlanRootProps) {
  const isStable = planData.heroSummary.pressure === "stable";

  return (
    <div className="space-y-2">
      <MobileHeader
        variant="page"
        title="Plan"
        subtitle={`${monthLabel} · ${daysInMonth - dayOfMonth}d restantes`}
        action={
          <Suspense fallback={<span className="text-xs capitalize">{monthLabel}</span>}>
            <MonthSelector />
          </Suspense>
        }
      />

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

      {/* Planear periodo — link to /plan/periodo */}
      <Link
        href="/plan/periodo"
        className="flex items-center justify-between rounded-2xl border border-white/6 bg-black/10 px-4 py-3.5 transition-colors active:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-z-income/10">
            <Wallet className="size-4 text-z-income" />
          </div>
          <div>
            <p className="text-sm font-medium">Planear periodo</p>
            <p className="text-xs text-muted-foreground">
              Asigna cada gasto a un ingreso
            </p>
          </div>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" />
      </Link>

      {/* Planificar CTA */}
      <PlanActionCta />

      {/* Flow chart — bar chart day-by-day */}
      <PlanFlowChart
        upcoming={planData.recurring.upcoming}
        currency={currency}
        daysInMonth={daysInMonth}
        dayOfMonth={dayOfMonth}
      />

      {/* Distribution — budget-type aware */}
      <PlanDistribution allocation={allocationData} />

      {/* Scenarios — only when stable */}
      {isStable && planData.scenarios.count > 0 && (
        <div className="rounded-2xl border border-white/6 bg-black/10 px-3.5 py-3 text-center text-xs text-muted-foreground">
          {planData.scenarios.count} escenario{planData.scenarios.count !== 1 ? "s" : ""} guardado{planData.scenarios.count !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
