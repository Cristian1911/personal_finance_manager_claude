import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarRange } from "lucide-react";
import { getPlanPageData } from "@/actions/plan";
import { MonthSelector } from "@/components/month-selector";
import { PlanBudgetSection } from "@/components/plan/plan-budget-section";
import { PlanDecisionRail } from "@/components/plan/plan-decision-rail";
import { PlanDebtSection } from "@/components/plan/plan-debt-section";
import { PlanHero } from "@/components/plan/plan-hero";
import { PlanRecurringSection } from "@/components/plan/plan-recurring-section";
import { PlanScenarioPreview } from "@/components/plan/plan-scenario-preview";
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
  const planData = await getPlanPageData(month);

  return (
    <div className="space-y-6">
      <div className="space-y-3 lg:hidden">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Plan
          </p>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tu capa estratégica</h1>
            <p className="text-sm text-muted-foreground">
              Decide qué ajustar antes de bajar a detalle
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/6 bg-z-surface-2 px-3 py-2 text-sm text-muted-foreground">
          <CalendarRange className="size-4 text-z-brass" />
          <Suspense fallback={<span className="capitalize">{monthLabel}</span>}>
            <MonthSelector />
          </Suspense>
        </div>
      </div>

      <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Plan
          </p>
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
          currency={planData.currency}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <PlanBudgetSection budget={planData.budget} currency={planData.currency} />

        <div className="space-y-6">
          <PlanDebtSection debt={planData.debt} currency={planData.currency} />
          <PlanRecurringSection recurring={planData.recurring} currency={planData.currency} />
        </div>
      </div>

      <PlanScenarioPreview scenarios={planData.scenarios} />
    </div>
  );
}
