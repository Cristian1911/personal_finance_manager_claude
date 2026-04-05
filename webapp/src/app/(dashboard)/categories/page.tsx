import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  getCategoriesWithBudgetData,
  getAllCategoriesForManagement,
  getCategories,
} from "@/actions/categories";
import { getUncategorizedTransactions } from "@/actions/categorize";
import { getAttentionSnapshot } from "@/actions/attention";
import { BudgetSummaryBar } from "@/components/budget/budget-summary-bar";
import { BudgetCategoryGrid } from "@/components/budget/budget-category-grid";
import { TrendComparison } from "@/components/budget/trend-comparison";
import { CategoryZoneManager } from "@/components/categories/category-zone-manager";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { MobilePresupuesto } from "@/components/mobile/mobile-presupuesto";
import { MonthPlanner } from "@/components/budget/month-planner";
import { MonthSelector } from "@/components/month-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";
import { getPreferredCurrency } from "@/actions/profile";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const { month, tab } = await searchParams;
  const selectedMonth = parseMonth(month);

  // Normalize old tab parameter
  const activeTab = tab === "gestionar" ? "configurar" : (tab ?? "presupuesto");

  const currency = await getPreferredCurrency();
  const [manageResult, uncategorized, categoryTreeResult, attentionSnapshot, result] = await Promise.all([
    getAllCategoriesForManagement(),
    getUncategorizedTransactions(),
    getCategories(),
    getAttentionSnapshot(),
    getCategoriesWithBudgetData(month, currency),
  ]);
  const categories = result.success ? result.data : [];
  const outflowCategories = categories.filter((c) => c.direction === "OUTFLOW");
  const allCategories = manageResult.success ? manageResult.data : [];
  const categoryTree = categoryTreeResult.success ? categoryTreeResult.data : [];

  const daysRemaining = getDaysRemainingInMonth(selectedMonth);
  const monthLabel = formatMonthLabel(selectedMonth);
  const withBudget = outflowCategories.filter((c) => (c.budget ?? 0) > 0).length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Presupuesto" backHref="/plan">
        <MonthSelector />
      </MobilePageHeader>

      <PageHeaderRow
        title="Presupuesto"
        subtitle={`${monthLabel} · ${daysRemaining} días restantes`}
        actions={
          <>
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/plan">
                Volver a Plan
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <MonthPlanner categories={outflowCategories} />
            <div className="hidden lg:block">
              <MonthSelector />
            </div>
          </>
        }
      />

      <div className="hidden lg:grid gap-4 lg:grid-cols-2">
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

        <Tabs defaultValue={activeTab}>
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
