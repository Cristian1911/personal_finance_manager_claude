import dynamic from "next/dynamic";
import { getBudgetMode } from "@/actions/budget";
import { getEstimatedIncome } from "@/actions/income";
import { getCategoriesWithBudgetData, getAllCategoriesForManagement, getCategories } from "@/actions/categories";
import { get503020Allocation } from "@/actions/allocation";
import { getUncategorizedTransactions } from "@/actions/categorize";
import { getAttentionSnapshot } from "@/actions/attention";
import { getBudgetScenarios } from "@/actions/budget-scenarios";
import { getWishlistItems } from "@/actions/wishlist";
import { getAccounts } from "@/actions/accounts";
import { BudgetSummaryBar } from "@/components/budget/budget-summary-bar";
import { BudgetCategoryGrid } from "@/components/budget/budget-category-grid";
import { TrendComparison } from "@/components/budget/trend-comparison";
import { CategoryZoneManager } from "@/components/categories/category-zone-manager";
import { MonthPlanner } from "@/components/budget/month-planner";
import { MobileBudgetList } from "@/components/budget/mobile-budget-list";
import { BudgetAjustesSheet } from "@/components/budget/budget-ajustes-sheet";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { StateChip } from "@/components/mobile/v2/state-chip";
import { PlanAllocationChip } from "@/components/mobile/v2/plan/plan-allocation-chip";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS, PANEL_INSET_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { BudgetMode } from "@/types/domain";
import { categoryBudgetGroup, isFixedBudgetCategory } from "@zeta/shared";
import { ScenarioSection, ScenarioEntryPoint } from "@/components/budget/scenario/scenario-section";
import {
  normalizeVerdict,
  type ScenarioCategoryOption,
  type ScenarioDeseoOption,
} from "@/components/budget/scenario/scenario-model";
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
    budgetScenarios,
    wishlistItems,
    accountsResult,
  ] = await Promise.all([
    getBudgetMode(),
    getEstimatedIncome(currency, month),
    getCategoriesWithBudgetData(month, currency),
    get503020Allocation(month, currency),
    getAllCategoriesForManagement(),
    getUncategorizedTransactions(),
    getCategories(),
    getAttentionSnapshot(),
    getBudgetScenarios(),
    getWishlistItems(),
    getAccounts(),
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

  // ── "Simular cambio" inputs ──
  const scenarioCategories: ScenarioCategoryOption[] = outflowCategories
    .filter((c) => c.is_active)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name_es ?? c.name,
      icon: c.icon,
      color: c.color,
      budget: c.budget,
      avg3m: c.average3m > 0 ? c.average3m : null,
      group: categoryBudgetGroup(c),
      isFixed: isFixedBudgetCategory(c.slug),
    }));

  const accounts = accountsResult.success ? accountsResult.data : [];
  const cushion = accounts
    .filter((a) => a.account_type === "CHECKING" || a.account_type === "SAVINGS")
    .reduce((sum, a) => sum + Math.max(0, a.current_balance), 0);

  const scenarioDeseos: ScenarioDeseoOption[] = wishlistItems
    .filter((w) => w.status === "wishlist" && w.amount > 0)
    .map((w) => ({
      id: w.id,
      name: w.name,
      amount: w.amount,
      verdict: normalizeVerdict(w.last_verdict),
    }));

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

  // ── Mobile data ──
  const budgeted = outflowCategories.filter((c) => (c.budget ?? 0) > 0);
  const totalSpent = budgeted.reduce((s, c) => s + c.spent, 0);
  const totalBudgeted = budgeted.reduce((s, c) => s + (c.budget ?? 0), 0);
  const progress = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const remaining = totalBudgeted - totalSpent;

  // Distribution: essential vs wants
  const essentialSpent = budgeted.filter((c) => c.is_essential).reduce((s, c) => s + c.spent, 0);
  const wantsSpent = budgeted.filter((c) => !c.is_essential).reduce((s, c) => s + c.spent, 0);
  const essentialPct = totalSpent > 0 ? Math.round((essentialSpent / totalSpent) * 100) : 0;
  const wantsPct = totalSpent > 0 ? Math.round((wantsSpent / totalSpent) * 100) : 0;

  const pressure = progress >= 100 ? "critical" : progress >= 80 ? "watch" : "stable";
  const chipConfig = {
    stable: { label: "En control", variant: "sage" as const },
    watch: { label: "Atención", variant: "warn" as const },
    critical: { label: "Sobre límite", variant: "danger" as const },
  } as const;
  const chip = chipConfig[pressure];

  const ajustesProps = {
    mode: budgetMode as BudgetMode | null,
    income,
    incomeSource: incomeEstimate?.source ?? null,
    currency,
  };

  return (
    <ScenarioSection
      categories={scenarioCategories}
      deseos={scenarioDeseos}
      scenarios={budgetScenarios}
      income={income}
      cushion={cushion}
      currency={currency}
    >
    <div className="space-y-6">
      {/* Mobile view */}
      <div className={cn("lg:hidden", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
        <MobileHeader
          variant="sub"
          title="Presupuesto"
          backHref="/plan"
          action={<BudgetAjustesSheet variant="icon" {...ajustesProps} />}
        />

        <div className="space-y-4 px-4 pt-4">
          {/* Budget hero card */}
          <div className={cn(PANEL_INSET_CLASS, "p-4")}>
            <div className="flex items-center justify-between gap-2">
              <p className={SECTION_EYEBROW_CLASS}>
                Gastado este mes
              </p>
              <StateChip label={chip.label} variant={chip.variant} />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span
                className={cn(
                  "text-[42px] font-[680] leading-none tracking-[-0.06em]",
                  progress >= 100 ? "text-z-debt" : "text-z-income"
                )}
              >
                {progress}%
              </span>
              <div className="text-right">
                <p className="text-lg font-semibold">
                  {formatCurrency(totalSpent, currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  de {formatCurrency(totalBudgeted, currency)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative mt-3 h-2.5 rounded-full bg-z-surface-2">
              <div
                className={cn(
                  "h-full rounded-full",
                  progress >= 100
                    ? "bg-gradient-to-r from-z-debt/90 to-z-debt/65"
                    : "bg-gradient-to-r from-z-income/90 to-z-income/65"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>

            {/* 50/30/20 allocation chip — D7 opens sheet on tap */}
            <div className="mt-3">
              <PlanAllocationChip
                allocation={allocationData}
                fallbackNeedsPct={essentialPct}
                fallbackWantsPct={wantsPct}
              />
            </div>
          </div>

          {/* Simular cambio — entry / mode toggle */}
          <ScenarioEntryPoint />

          {/* Categories grouped by risk state — tap any row to edit its límite */}
          <MobileBudgetList categories={outflowCategories} currency={currency} />

          {/* Remaining budget */}
          {totalBudgeted > 0 && (
            <div className={cn(PANEL_INSET_CLASS, "flex items-center justify-between p-3")}>
              <span className="text-xs text-muted-foreground">Restante</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  remaining < 0 ? "text-z-debt" : "text-z-income"
                )}
              >
                {formatCurrency(remaining, currency)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop view */}
      <div className="hidden lg:block space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Presupuesto</h2>
            <p className="text-sm text-muted-foreground">{monthLabel} · {daysRemaining} días restantes</p>
          </div>
          <div className="flex items-center gap-2">
            <BudgetAjustesSheet variant="button" {...ajustesProps} />
            <MonthPlanner categories={outflowCategories} />
          </div>
        </div>

        {/* Simular cambio — entry / mode toggle */}
        <ScenarioEntryPoint className="max-w-md" />

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
    </ScenarioSection>
  );
}
