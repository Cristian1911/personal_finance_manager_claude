import dynamic from "next/dynamic";
import { getBudgetMode } from "@/actions/budget";
import { getEstimatedIncome } from "@/actions/income";
import { getCategoriesWithBudgetData, getAllCategoriesForManagement, getCategories } from "@/actions/categories";
import { get503020Allocation } from "@/actions/allocation";
import { getUncategorizedTransactions } from "@/actions/categorize";
import { getAttentionSnapshot } from "@/actions/attention";
import { BudgetSummaryBar } from "@/components/budget/budget-summary-bar";
import { BudgetCategoryGrid } from "@/components/budget/budget-category-grid";
import { TrendComparison } from "@/components/budget/trend-comparison";
import { CategoryZoneManager } from "@/components/categories/category-zone-manager";
import { MobilePresupuesto } from "@/components/mobile/mobile-presupuesto";
import { MonthPlanner } from "@/components/budget/month-planner";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

const BudgetWizard = dynamic(
  () => import("@/components/budget/budget-wizard").then((m) => ({ default: m.BudgetWizard })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
);


interface PlanTabPresupuestoProps {
  month: string | undefined;
  currency: CurrencyCode;
}

export async function PlanTabPresupuesto({ month, currency }: PlanTabPresupuestoProps) {
  const [
    modeResult,
    incomeEstimate,
    categoriesResult,
    allocationData,
    manageResult,
    uncategorized,
    categoryTreeResult,
    attentionSnapshot,
  ] = await Promise.all([
    getBudgetMode(),
    getEstimatedIncome(currency, month),
    getCategoriesWithBudgetData(month, currency),
    get503020Allocation(month, currency),
    getAllCategoriesForManagement(),
    getUncategorizedTransactions(),
    getCategories(),
    getAttentionSnapshot(),
  ]);

  const budgetMode = modeResult.success ? modeResult.data : null;
  const income = incomeEstimate?.monthlyAverage ?? 0;
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const outflowCategories = categories.filter((c) => c.direction === "OUTFLOW");
  const allCategories = manageResult.success ? manageResult.data : [];
  const categoryTree = categoryTreeResult.success ? categoryTreeResult.data : [];

  const target = parseMonth(month);
  const daysRemaining = getDaysRemainingInMonth(target);
  const monthLabel = formatMonthLabel(target);
  const withBudget = outflowCategories.filter((c) => (c.budget ?? 0) > 0).length;

  // If no budget mode configured yet, show wizard
  if (!budgetMode) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Configura tu presupuesto</h2>
          <p className="text-sm text-muted-foreground">
            Elige como quieres gestionar tu dinero cada mes.
          </p>
        </div>
        <BudgetWizard
          categories={categories}
          estimatedIncome={income}
          currency={currency}
          allocationData={allocationData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile view */}
      <div className="lg:hidden">
        <MobilePresupuesto
          uncategorizedTransactions={uncategorized}
          budgetCategories={outflowCategories}
          categoryTree={categoryTree}
        />
      </div>

      {/* Desktop view */}
      <div className="hidden lg:block space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Presupuesto</h2>
            <p className="text-sm text-muted-foreground">{monthLabel} · {daysRemaining} días restantes</p>
          </div>
          <MonthPlanner categories={outflowCategories} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SummaryCard
            metrics={[
              { label: "Días restantes", value: daysRemaining, context: monthLabel },
              { label: "Con límite", value: withBudget, context: "categorías activas" },
              { label: "Sin categoría", value: uncategorized.length, context: "movimientos pendientes" },
            ]}
          />
          <AttentionCard
            signals={attentionSnapshot.signals.filter((s) => s.page === "categories" || s.page === "transactions")}
          />
        </div>

        <BudgetSummaryBar
          categories={outflowCategories}
          daysRemaining={daysRemaining}
          monthLabel={monthLabel}
        />

        <Tabs defaultValue="presupuesto">
          <TabsList>
            <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
            <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
            <TabsTrigger value="configurar">Configurar</TabsTrigger>
          </TabsList>

          <TabsContent value="presupuesto" className="mt-4">
            <BudgetCategoryGrid categories={outflowCategories} />
          </TabsContent>

          <TabsContent value="tendencias" className="mt-4">
            <TrendComparison categories={outflowCategories} />
          </TabsContent>

          <TabsContent value="configurar" className="mt-4">
            <CategoryZoneManager categories={allCategories} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
