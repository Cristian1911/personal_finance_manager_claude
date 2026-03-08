import {
  getCategoriesWithBudgetData,
  getAllCategoriesForManagement,
} from "@/actions/categories";
import { BudgetSummaryBar } from "@/components/budget/budget-summary-bar";
import { BudgetCategoryGrid } from "@/components/budget/budget-category-grid";
import { TrendComparison } from "@/components/budget/trend-comparison";
import { CategoryManageList } from "@/components/budget/category-manage-list";
import { MonthSelector } from "@/components/month-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { month } = await searchParams;
  const selectedMonth = parseMonth(month);

  const [result, manageResult] = await Promise.all([
    getCategoriesWithBudgetData(month),
    getAllCategoriesForManagement(),
  ]);
  const categories = result.success ? result.data : [];
  const outflowCategories = categories.filter((c) => c.direction === "OUTFLOW");
  const allCategories = manageResult.success ? manageResult.data : [];

  const daysRemaining = getDaysRemainingInMonth(selectedMonth);
  const monthLabel = formatMonthLabel(selectedMonth);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Presupuesto</h1>
          <p className="text-muted-foreground">¿Cómo vas este mes?</p>
        </div>
        <MonthSelector />
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
  );
}
