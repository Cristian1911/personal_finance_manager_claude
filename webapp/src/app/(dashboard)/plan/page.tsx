import { connection } from "next/server";
import { Suspense } from "react";
import { getPlanPageData } from "@/actions/plan";
import { getCategoriesByRhythm } from "@/actions/categories";
import { getWishlistItemsForDashboard } from "@/actions/wishlist";
import { MonthSelector } from "@/components/month-selector";
import { PlanBudgetSection } from "@/components/plan/plan-budget-section";
import { PlanBudgetToggle } from "@/components/plan/plan-budget-toggle";
import { PlanDecisionRail } from "@/components/plan/plan-decision-rail";
import { PlanDebtSection } from "@/components/plan/plan-debt-section";
import { PlanHero } from "@/components/plan/plan-hero";
import { PlanRecurringSection } from "@/components/plan/plan-recurring-section";
import { PlanScenarioPreview } from "@/components/plan/plan-scenario-preview";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { PlanRoot } from "@/components/mobile/v2/plan/plan-root";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import { getActivePeriod } from "@/actions/cashflow-planner";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;
  const monthLabel = formatMonthLabel(parseMonth(month));
  const [currency, wishlistSummary, activePeriodResult] = await Promise.all([
    getPreferredCurrency(),
    getWishlistItemsForDashboard(),
    getActivePeriod(),
  ]);
  const [planData, rhythmResult, categoryBudgetResult] = await Promise.all([
    getPlanPageData(month, currency),
    getCategoriesByRhythm(month, currency),
    getCategoriesWithBudgetData(month, currency),
  ]);
  const allocationData = planData.budget.allocation;
  const rhythmData = rhythmResult.success ? rhythmResult.data : [];
  const categoryBudgetData = categoryBudgetResult.success ? categoryBudgetResult.data : [];
  const isStable = planData.heroSummary.pressure === "stable";
  const now = new Date();
  const planDayOfMonth = now.getDate();
  const planDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const activePeriod = activePeriodResult.success ? activePeriodResult.data : null;
  const periodoSummary = activePeriod
    ? {
        hasActive: true,
        percentAssigned: activePeriod.total_expenses > 0
          ? Math.round((activePeriod.total_assigned / activePeriod.total_expenses) * 100)
          : 0,
        unassignedCount: activePeriod.unassigned_expenses.length,
      }
    : null;

  return (
    <div className={PAGE_STACK_CLASS}>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <PlanRoot
          planData={planData}
          allocationData={allocationData}
          currency={planData.currency}
          monthLabel={monthLabel}
          dayOfMonth={planDayOfMonth}
          daysInMonth={planDaysInMonth}
          categories={categoryBudgetData}
        />
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:block space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <SectionEyebrow>Plan</SectionEyebrow>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Tu capa estratégica</h1>
              <p className="text-muted-foreground">
                {monthLabel} · reúne presupuesto, deuda, obligaciones y escenarios en una sola decisión
              </p>
            </div>
          </div>
          <Suspense fallback={<div className="h-9 w-40 rounded-md bg-muted animate-pulse" />}>
            <MonthSelector />
          </Suspense>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
          <PlanHero
            summary={planData.heroSummary}
            currency={planData.currency}
            monthLabel={monthLabel}
            incomeEstimate={planData.incomeEstimate}
          />
          <PlanDecisionRail
            budget={planData.budget}
            debt={planData.debt}
            recurring={planData.recurring}
            scenarios={planData.scenarios}
            desires={{ totalCount: wishlistSummary.totalCount, readyCount: wishlistSummary.readyCount }}
            periodo={periodoSummary}
            currency={planData.currency}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <PlanBudgetToggle
            domainView={<PlanBudgetSection budget={planData.budget} currency={planData.currency} />}
            rhythmGroups={rhythmData}
            currency={planData.currency}
          />
          <div className="space-y-6">
            <PlanDebtSection debt={planData.debt} currency={planData.currency} />
            <PlanRecurringSection recurring={planData.recurring} currency={planData.currency} />
          </div>
        </div>

        <PlanScenarioPreview scenarios={planData.scenarios} />
      </div>
    </div>
  );
}
