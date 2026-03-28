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
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { MobilePresupuesto } from "@/components/mobile/mobile-presupuesto";
import { MonthPlanner } from "@/components/budget/month-planner";
import { MonthSelector } from "@/components/month-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHero, HeroPill, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { ArrowRight, CalendarClock, Sparkles, Tags } from "lucide-react";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";
import { getPreferredCurrency } from "@/actions/profile";
import Link from "next/link";

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
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Presupuesto" backHref="/plan">
        <MonthSelector />
      </MobilePageHeader>

      <PageHero
        pills={<><HeroPill>Detalle del plan</HeroPill><HeroAccentPill>Ritmo de gasto</HeroAccentPill></>}
        title="El presupuesto que define cuánto margen real te queda este mes"
        description="Aquí aterrizas el plan en categorías concretas: límites, ritmo de consumo y áreas donde conviene corregir antes de cerrar el mes."
        actions={<>
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
        </>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Mes activo"
            value={monthLabel}
            description="Contexto temporal sobre el que estás ajustando los límites."
          />
          <StatCard
            label={<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark"><CalendarClock className="size-4 text-z-brass" />Días restantes</div>}
            value={daysRemaining}
            description="Tiempo que queda para corregir el ritmo antes del cierre."
          />
          <StatCard
            label={<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark"><Tags className="size-4 text-z-brass" />Categorías con límite</div>}
            value={outflowCategories.length}
            description="Las categorías que hoy participan en el control mensual."
          />
          <StatCard
            label={<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark"><Sparkles className="size-4 text-z-brass" />Sin categoría</div>}
            value={uncategorized.length}
            description="Movimientos que todavía pueden distorsionar la lectura del presupuesto."
          />
        </div>
      </PageHero>

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
