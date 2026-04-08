import { getPlanPageData } from "@/actions/plan";
import { getCategoriesByRhythm } from "@/actions/categories";
import { PlanHero } from "@/components/plan/plan-hero";
import { PlanBudgetSection } from "@/components/plan/plan-budget-section";
import { PlanBudgetToggle } from "@/components/plan/plan-budget-toggle";
import { PlanDebtSection } from "@/components/plan/plan-debt-section";
import { PlanRecurringSection } from "@/components/plan/plan-recurring-section";
import { PlanScenarioPreview } from "@/components/plan/plan-scenario-preview";
import { PlanTabNav, type PlanTab } from "@/components/plan/plan-tab-nav";
import type { CurrencyCode } from "@/types/domain";

interface PlanResumenZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
  activeTab: PlanTab;
}

export async function PlanResumenZone({
  month,
  currency,
  monthLabel,
  activeTab,
}: PlanResumenZoneProps) {
  const [planData, rhythmResult] = await Promise.all([
    getPlanPageData(month, currency),
    getCategoriesByRhythm(month, currency),
  ]);

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
}
