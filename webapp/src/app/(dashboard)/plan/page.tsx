import { connection } from "next/server";
import { Suspense } from "react";
import { getPlanPageData } from "@/actions/plan";
import { getCategoriesByRhythm } from "@/actions/categories";
import { getWishlistItemsForDashboard } from "@/actions/wishlist";
import { MonthSelector } from "@/components/month-selector";
import { PlanBudgetSection } from "@/components/plan/plan-budget-section";
import { PlanBudgetToggle } from "@/components/plan/plan-budget-toggle";
import { PlanDebtSection } from "@/components/plan/plan-debt-section";
import { PlanHero } from "@/components/plan/plan-hero";
import { PlanRecurringSection } from "@/components/plan/plan-recurring-section";
import { PlanScenarioPreview } from "@/components/plan/plan-scenario-preview";
import { PlanTabNav, type PlanTab } from "@/components/plan/plan-tab-nav";
import { PlanTabPresupuesto } from "@/components/plan/tabs/plan-tab-presupuesto";
import { PlanTabPeriodo } from "@/components/plan/tabs/plan-tab-periodo";
import { PlanTabRecurrentes } from "@/components/plan/tabs/plan-tab-recurrentes";
import { PlanTabDeseos } from "@/components/plan/tabs/plan-tab-deseos";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { PlanRoot } from "@/components/mobile/v2/plan/plan-root";
import { PlanMobileNavList } from "@/components/plan/plan-mobile-nav-list";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import { getActivePeriod } from "@/actions/cashflow-planner";
import { getPlanTimelineData } from "@/actions/plan-timeline";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";

const VALID_TABS: PlanTab[] = ["resumen", "presupuesto", "periodo", "recurrentes", "deseos"];

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;
  const rawTab = params.tab;
  const activeTab: PlanTab = VALID_TABS.includes(rawTab as PlanTab)
    ? (rawTab as PlanTab)
    : "resumen";

  const monthLabel = formatMonthLabel(parseMonth(month));

  // For resumen tab (and mobile), fetch plan data
  // For other tabs, we only need minimal data for the header
  const [currency, wishlistSummary, activePeriodResult] = await Promise.all([
    getPreferredCurrency(),
    getWishlistItemsForDashboard(),
    getActivePeriod(),
  ]);

  const isResumen = activeTab === "resumen";

  // Only fetch heavy plan data for resumen tab
  const [planData, rhythmResult, categoryBudgetResult, timelineData] = isResumen
    ? await Promise.all([
        getPlanPageData(month, currency),
        getCategoriesByRhythm(month, currency),
        getCategoriesWithBudgetData(month, currency),
        getPlanTimelineData(month, currency),
      ])
    : [null, null, null, null];

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

  // ── Mobile: show PlanRoot for resumen, tab content for others ──
  const mobileContent = (() => {
    if (isResumen && planData) {
      const allocationData = planData.budget.allocation;
      const categoryBudgetData = categoryBudgetResult?.success ? categoryBudgetResult.data : [];
      const now = new Date();
      const planDayOfMonth = now.getDate();
      const planDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      return (
        <PlanRoot
          planData={planData}
          allocationData={allocationData}
          timelineData={timelineData!}
          currency={planData.currency}
          monthLabel={monthLabel}
          dayOfMonth={planDayOfMonth}
          daysInMonth={planDaysInMonth}
          categories={categoryBudgetData}
        />
      );
    }
    return null; // Non-resumen tabs render tab content below (shared mobile+desktop)
  })();

  // ── Desktop: resumen tab shows the full plan layout ──
  const desktopResumenContent = (() => {
    if (!isResumen || !planData) return null;
    const allocationData = planData.budget.allocation;
    const rhythmData = rhythmResult?.success ? rhythmResult.data : [];

    return (
      <>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
          <PlanHero
            summary={planData.heroSummary}
            currency={planData.currency}
            monthLabel={monthLabel}
            incomeEstimate={planData.incomeEstimate}
          />
          {/* Decision rail — now shows tab links instead of page links */}
          <div className="space-y-3 rounded-2xl border border-white/6 bg-z-surface-2/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Módulos del plan
            </p>
            <PlanTabNav activeTab={activeTab} />
          </div>
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
      </>
    );
  })();

  // ── Tab content for non-resumen tabs ──
  const tabContent = (() => {
    switch (activeTab) {
      case "presupuesto":
        return <PlanTabPresupuesto month={month} currency={currency} />;
      case "periodo":
        return <PlanTabPeriodo />;
      case "recurrentes":
        return <PlanTabRecurrentes />;
      case "deseos":
        return <PlanTabDeseos />;
      default:
        return null;
    }
  })();

  return (
    <div className={PAGE_STACK_CLASS}>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        {/* Tab navigation — always visible on mobile */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">Plan</p>
              <h1 className="text-xl font-semibold">{activeTab === "resumen" ? "Tu plan" : ""}</h1>
            </div>
            {isResumen && (
              <Suspense fallback={<span className="text-xs capitalize text-muted-foreground">{monthLabel}</span>}>
                <MonthSelector />
              </Suspense>
            )}
          </div>
          {/* NOTE: PlanTabNav removed from here — hidden on mobile, replaced by bottom nav list */}
        </div>

        {/* Mobile tab content */}
        {mobileContent}
        {tabContent && (
          <div className="mt-4">
            <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
              {tabContent}
            </Suspense>
          </div>
        )}

        {/* Bottom navigation to other Plan tabs */}
        <PlanMobileNavList activeTab={activeTab} />
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
          <div className="flex items-center gap-3">
            <PlanTabNav activeTab={activeTab} />
            <Suspense fallback={<div className="h-9 w-40 rounded-md bg-muted animate-pulse" />}>
              <MonthSelector />
            </Suspense>
          </div>
        </div>

        {/* Tab content */}
        {desktopResumenContent}
        {tabContent && (
          <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
            {tabContent}
          </Suspense>
        )}
      </div>
    </div>
  );
}
