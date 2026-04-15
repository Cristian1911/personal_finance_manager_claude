import { connection } from "next/server";
import { Suspense } from "react";
import { getWishlistItemsForDashboard } from "@/actions/wishlist";
import { MonthSelector } from "@/components/month-selector";
import { PlanTabNav, type PlanTab } from "@/components/plan/plan-tab-nav";
import { PlanTabPresupuesto } from "@/components/plan/tabs/plan-tab-presupuesto";
import { PlanTabPeriodo } from "@/components/plan/tabs/plan-tab-periodo";
import { PlanTabRecurrentes } from "@/components/plan/tabs/plan-tab-recurrentes";
import { PlanTabDeseos } from "@/components/plan/tabs/plan-tab-deseos";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { DesktopOnly } from "@/components/ui/responsive-render";
import { getPreferredCurrency } from "@/actions/profile";
import { getActivePeriod } from "@/actions/cashflow-planner";
import { ensureCurrentOccurrences } from "@/actions/occurrences";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";
import { PlanResumenZone } from "@/components/plan/zones/plan-resumen-zone";
import { PlanMobileZone } from "@/components/plan/zones/plan-mobile-zone";
import { PlanAccountsSection } from "@/components/plan/plan-accounts-section";
import type { CurrencyCode } from "@/types/domain";

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

  // Shell: lightweight data for header + tab nav badges
  const [, currency, wishlistSummary, activePeriodResult] = await Promise.all([
    ensureCurrentOccurrences(),
    getPreferredCurrency(),
    getWishlistItemsForDashboard(),
    getActivePeriod(),
  ]);

  const isResumen = activeTab === "resumen";

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

  // Tab content for non-resumen tabs (already Suspensed)
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

  // Skeletons for resumen zones
  const resumenSkeleton = (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
        <div className="h-[280px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="h-[280px] rounded-xl bg-z-surface-2 animate-pulse" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="h-[300px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="space-y-6">
          <div className="h-[140px] rounded-xl bg-z-surface-2 animate-pulse" />
          <div className="h-[140px] rounded-xl bg-z-surface-2 animate-pulse" />
        </div>
      </div>
      <div className="h-[200px] rounded-xl bg-z-surface-2 animate-pulse" />
    </div>
  );

  const mobileSkeleton = (
    <div className="space-y-4">
      <div className="h-[200px] rounded-2xl bg-z-surface-2 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[80px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="h-[80px] rounded-xl bg-z-surface-2 animate-pulse" />
      </div>
      <div className="h-[160px] rounded-xl bg-z-surface-2 animate-pulse" />
    </div>
  );

  return (
    <div className={PAGE_STACK_CLASS}>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        {isResumen ? (
          <div className="space-y-6">
            <Suspense fallback={mobileSkeleton}>
              <PlanMobileZone
                month={month}
                currency={currency as CurrencyCode}
                monthLabel={monthLabel}
                periodoSummary={periodoSummary}
                wishlistCount={wishlistSummary?.totalCount ?? 0}
              />
            </Suspense>
            <PlanAccountsSection />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex justify-center">
              <Suspense fallback={<div className="h-9 w-40 rounded-md bg-z-surface-2 animate-pulse" />}>
                <MonthSelector compact />
              </Suspense>
            </div>
            {tabContent && (
              <Suspense fallback={<div className="h-64 rounded-xl bg-z-surface-2 animate-pulse" />}>
                {tabContent}
              </Suspense>
            )}
          </div>
        )}
      </div>

      {/* ── Desktop (not mounted on mobile to avoid blocking rendering thread) ── */}
      <DesktopOnly>
        <div className="space-y-6">
          {/* Header — renders immediately from shell data */}
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
              <PlanTabNav activeTab={activeTab} month={month} />
              <Suspense fallback={<div className="h-9 w-40 rounded-md bg-z-surface-2 animate-pulse" />}>
                <MonthSelector />
              </Suspense>
            </div>
          </div>

          {/* Resumen content — streams via zone */}
          {isResumen && (
            <Suspense fallback={resumenSkeleton}>
              <PlanResumenZone
                month={month}
                currency={currency as CurrencyCode}
                monthLabel={monthLabel}
                activeTab={activeTab}
              />
            </Suspense>
          )}

          {/* Tab content — already Suspensed */}
          {tabContent && (
            <Suspense fallback={<div className="h-64 rounded-xl bg-z-surface-2 animate-pulse" />}>
              {tabContent}
            </Suspense>
          )}
        </div>
      </DesktopOnly>
    </div>
  );
}
