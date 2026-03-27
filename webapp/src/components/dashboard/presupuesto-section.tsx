import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import dynamic from "next/dynamic";
import { AllocationBars5030 } from "@/components/budget/allocation-bars-5030";

const BudgetPaceChart = dynamic(
  () => import("@/components/charts/budget-pace-chart").then((m) => ({ default: m.BudgetPaceChart })),
  { loading: () => <div className="h-[240px] w-full rounded-xl bg-muted animate-pulse" /> }
);

const CategoryDonut = dynamic(
  () => import("@/components/charts/category-donut").then((m) => ({ default: m.CategoryDonut })),
  { loading: () => <div className="h-[280px] w-full rounded-xl bg-muted animate-pulse" /> }
);
import { DashboardBudgetBar } from "@/components/budget/dashboard-budget-bar";
import { SavingsRateWidget } from "@/components/dashboard/savings-rate-widget";
import { getDailyBudgetPace, getCategorySpending } from "@/actions/charts";
import { get503020Allocation } from "@/actions/allocation";
import type { CurrencyCode } from "@/types/domain";
import type { HealthMetersData } from "@/actions/health-meters";
import type { AllocationData } from "@/actions/allocation";

export async function PresupuestoSection({
  month,
  currency,
  monthLabel,
  healthMetersData,
  allocationData: allocationDataProp,
}: {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
  healthMetersData: HealthMetersData;
  allocationData?: AllocationData | null;
}) {
  const [budgetPaceData, categoryData, resolvedAllocation] = await Promise.all([
    getDailyBudgetPace(month, currency),
    getCategorySpending(month, currency),
    allocationDataProp !== undefined
      ? Promise.resolve(allocationDataProp)
      : get503020Allocation(month, currency),
  ]);

  let presupuestoSubtitle: string | undefined;
  if (resolvedAllocation) {
    const needsPct = Math.round(resolvedAllocation.needs.percent);
    const totalSpentPct = Math.round(resolvedAllocation.needs.percent + resolvedAllocation.wants.percent);
    if (totalSpentPct > 100) {
      presupuestoSubtitle = `Necesidades al ${needsPct}% — por encima del presupuesto`;
    } else if (totalSpentPct >= 90) {
      presupuestoSubtitle = `Necesidades al ${needsPct}% — cerca del limite`;
    } else {
      presupuestoSubtitle = `Necesidades al ${needsPct}% — dentro del presupuesto`;
    }
  } else {
    presupuestoSubtitle = "Configura tu presupuesto en ajustes";
  }

  return (
    <DashboardSection title="Presupuesto" section="presupuesto" subtitle={presupuestoSubtitle}>
      <WidgetSlot widgetId="budget-pulse">
        <BudgetPaceChart
          data={budgetPaceData.data}
          totalBudget={budgetPaceData.totalBudget}
          totalSpent={budgetPaceData.totalSpent}
          monthLabel={monthLabel}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="allocation-5030">
        <AllocationBars5030 data={resolvedAllocation} />
      </WidgetSlot>

      <WidgetSlot widgetId="savings-rate">
        <SavingsRateWidget data={healthMetersData} />
      </WidgetSlot>

      <WidgetSlot widgetId="category-donut">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={categoryData} currency={currency} />
          </CardContent>
        </Card>
      </WidgetSlot>

      <WidgetSlot widgetId="budget-bar">
        <DashboardBudgetBar data={categoryData} monthLabel={monthLabel} />
      </WidgetSlot>
    </DashboardSection>
  );
}
