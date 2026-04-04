import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarRange } from "lucide-react";
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
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PlanHub } from "@/components/mobile/v2/plan-hub";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { formatMonthLabel, parseMonth, getDaysRemainingInMonth } from "@/lib/utils/date";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;
  const monthLabel = formatMonthLabel(parseMonth(month));
  const [planData, wishlistSummary] = await Promise.all([
    getPlanPageData(month),
    getWishlistItemsForDashboard(),
  ]);
  const rhythmResult = await getCategoriesByRhythm(month, planData.currency);
  const rhythmData = rhythmResult.success ? rhythmResult.data : [];

  return (
    <div className={PAGE_STACK_CLASS}>
      {/* Mobile: v2 Plan hub */}
      <div className="lg:hidden">
        <MobileHeader
          variant="page"
          title="Plan"
          subtitle={monthLabel}
          action={
            <Suspense fallback={<span className="capitalize text-xs">{monthLabel}</span>}>
              <MonthSelector />
            </Suspense>
          }
        />

        {(() => {
          const target = parseMonth(month);
          const daysRemaining = getDaysRemainingInMonth(target);
          const totalBudgeted = planData.budget.totalBudgeted;
          const totalSpent = planData.budget.totalSpent;
          const budgetPercent =
            totalBudgeted > 0
              ? Math.round((totalSpent / totalBudgeted) * 100)
              : 0;
          const remaining = Math.max(0, totalBudgeted - totalSpent);
          const dailyAvailable = daysRemaining > 0 ? remaining / daysRemaining : 0;

          const firstUpcoming = planData.recurring.upcoming[0];
          const nextPaymentName = firstUpcoming?.template.description ?? firstUpcoming?.template.account?.name ?? null;
          const nextPaymentDays = firstUpcoming
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(firstUpcoming.next_date).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                )
              )
            : null;

          const allocation = planData.budget.allocation;
          const allocationStyle: "50_30_20" | "ynab" | "per_category" =
            allocation ? "50_30_20" : "per_category";

          const distribution = allocation
            ? [
                { label: "Necesidades", percent: allocation.needs.percent, color: "#4ade80" },
                { label: "Gustos", percent: allocation.wants.percent, color: "#c4a94d" },
                { label: "Ahorro", percent: allocation.savings.percent, color: "#60a5fa" },
              ]
            : [];

          return (
            <div className="pt-3">
              <PlanHub
                budgetPercent={budgetPercent}
                spent={totalSpent}
                total={totalBudgeted}
                dailyAvailable={dailyAvailable}
                daysRemaining={daysRemaining}
                overBudgetCount={planData.budget.overLimitCount}
                nextPaymentName={nextPaymentName}
                nextPaymentDays={nextPaymentDays}
                allocationStyle={allocationStyle}
                distribution={distribution}
                currency={planData.currency}
              />
            </div>
          );
        })()}
      </div>

      <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-4">
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
  );
}
