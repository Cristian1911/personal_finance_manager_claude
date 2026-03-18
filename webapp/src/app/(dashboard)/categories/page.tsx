import { connection } from "next/server";
import {
  getCategoriesWithBudgetData,
  getAllCategoriesForManagement,
  getCategories,
} from "@/actions/categories";
import { getUncategorizedTransactions } from "@/actions/categorize";
import { BudgetSummaryBar } from "@/components/budget/budget-summary-bar";
import { BudgetCategoryGrid } from "@/components/budget/budget-category-grid";
import { TrendComparison } from "@/components/budget/trend-comparison";
import { CategoryManageList } from "@/components/budget/category-manage-list";
import { MonthEndInsight } from "@/components/budget/month-end-insight";
import { MobilePresupuesto } from "@/components/mobile/mobile-presupuesto";
import { MonthPlanner } from "@/components/budget/month-planner";
import { MonthSelector } from "@/components/month-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";
import { getPreferredCurrency } from "@/actions/profile";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const { month } = await searchParams;
  const selectedMonth = parseMonth(month);

  // Run currency fetch in parallel with non-dependent queries
  const [currency, manageResult, uncategorized, categoryTreeResult] = await Promise.all([
    getPreferredCurrency(),
    getAllCategoriesForManagement(),
    getUncategorizedTransactions(),
    getCategories(),
  ]);
  // Budget query depends on currency — must await after
  const result = await getCategoriesWithBudgetData(month, currency);
  const categories = result.success ? result.data : [];
  const outflowCategories = categories.filter((c) => c.direction === "OUTFLOW");
  const allCategories = manageResult.success ? manageResult.data : [];
  const categoryTree = categoryTreeResult.success ? categoryTreeResult.data : [];

  const daysRemaining = getDaysRemainingInMonth(selectedMonth);
  const monthLabel = formatMonthLabel(selectedMonth);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Presupuesto</h1>
          <p className="text-muted-foreground">¿Cómo vas este mes?</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPlanner categories={outflowCategories} />
          <MonthSelector />
        </div>
      </div>

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
        <BudgetSummaryBar
          categories={outflowCategories}
          daysRemaining={daysRemaining}
          monthLabel={monthLabel}
        />

        <MonthEndInsight categories={outflowCategories} daysRemaining={daysRemaining} />

        <Tabs defaultValue="presupuesto">
          <TabsList>
            <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
            <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
            <TabsTrigger value="gestionar">Gestionar</TabsTrigger>
          </TabsList>

          <TabsContent value="presupuesto" className="mt-4">
            <BudgetCategoryGrid categories={outflowCategories} />
          </TabsContent>

          <TabsContent value="tendencias" className="mt-4">
            <TrendComparison categories={outflowCategories} />
          </TabsContent>

          <TabsContent value="gestionar" className="mt-4">
            <CategoryManageList categories={allCategories} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
