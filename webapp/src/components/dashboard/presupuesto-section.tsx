import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { BudgetPaceChart } from "@/components/charts/budget-pace-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { AllocationBars5030 } from "@/components/budget/allocation-bars-5030";
import { DashboardBudgetBar } from "@/components/budget/dashboard-budget-bar";
import { SavingsRateWidget } from "@/components/dashboard/savings-rate-widget";
import { getDailyBudgetPace, getCategorySpending } from "@/actions/charts";
import { get503020Allocation } from "@/actions/allocation";
import type { CurrencyCode } from "@/types/domain";
import type { HealthMetersData } from "@/actions/health-meters";

export async function PresupuestoSection({
  month,
  currency,
  monthLabel,
  healthMetersData,
}: {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
  healthMetersData: HealthMetersData;
}) {
  const [budgetPaceData, categoryData, allocationData] = await Promise.all([
    getDailyBudgetPace(month, currency),
    getCategorySpending(month, currency),
    get503020Allocation(month, currency),
  ]);

  return (
    <DashboardSection title="Presupuesto" section="presupuesto">
      <WidgetSlot widgetId="budget-pulse">
        <BudgetPaceChart
          data={budgetPaceData.data}
          totalBudget={budgetPaceData.totalBudget}
          totalSpent={budgetPaceData.totalSpent}
          monthLabel={monthLabel}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="allocation-5030">
        <AllocationBars5030 data={allocationData} />
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
