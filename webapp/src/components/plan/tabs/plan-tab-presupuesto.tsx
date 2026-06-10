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
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { StateChip } from "@/components/mobile/v2/state-chip";
import { CategoryIcon } from "@/components/categories/category-icon";
import { PlanAllocationChip } from "@/components/mobile/v2/plan/plan-allocation-chip";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS, PANEL_INSET_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { categoryBudgetGroup, isFixedBudgetCategory } from "@zeta/shared";
import { ScenarioSection, ScenarioEntryPoint } from "@/components/budget/scenario/scenario-section";
import {
  normalizeVerdict,
  type ScenarioCategoryOption,
  type ScenarioDeseoOption,
} from "@/components/budget/scenario/scenario-model";
import type { CurrencyCode, CategoryBudgetData } from "@/types/domain";

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

  // D6: group categories by risk state — over → near → safe
  const over = [...budgeted]
    .filter((c) => c.percentUsed > 100)
    .sort((a, b) => b.percentUsed - a.percentUsed);
  const near = [...budgeted]
    .filter((c) => c.percentUsed >= 85 && c.percentUsed <= 100)
    .sort((a, b) => b.percentUsed - a.percentUsed);
  const safe = [...budgeted]
    .filter((c) => c.percentUsed < 85)
    .sort((a, b) => a.percentUsed - b.percentUsed);
  const hasBudgetedCategories = over.length + near.length + safe.length > 0;

  const pressure = progress >= 100 ? "critical" : progress >= 80 ? "watch" : "stable";
  const chipConfig = {
    stable: { label: "En control", variant: "sage" as const },
    watch: { label: "Atención", variant: "warn" as const },
    critical: { label: "Sobre límite", variant: "danger" as const },
  } as const;
  const chip = chipConfig[pressure];

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
        <MobileHeader variant="sub" title="Presupuesto" backHref="/plan" />

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

          {/* Categories grouped by risk state — D6 */}
          {hasBudgetedCategories && (
            <div className="space-y-5">
              {over.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <p className={cn(SECTION_EYEBROW_CLASS, "text-z-expense")}>
                      Sobre límite
                    </p>
                    <span className="text-[10px] text-muted-foreground">{over.length}</span>
                  </div>
                  <div className="space-y-3">
                    {over.map((cat) => (
                      <MobileBudgetCategoryRow key={cat.id} category={cat} currency={currency} />
                    ))}
                  </div>
                </section>
              )}
              {near.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <p className={cn(SECTION_EYEBROW_CLASS, "text-z-brass")}>
                      Cerca del límite
                    </p>
                    <span className="text-[10px] text-muted-foreground">{near.length}</span>
                  </div>
                  <div className="space-y-3">
                    {near.map((cat) => (
                      <MobileBudgetCategoryRow key={cat.id} category={cat} currency={currency} />
                    ))}
                  </div>
                </section>
              )}
              {safe.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <p className={cn(SECTION_EYEBROW_CLASS, "text-z-income")}>
                      Dentro del límite
                    </p>
                    <span className="text-[10px] text-muted-foreground">{safe.length}</span>
                  </div>
                  <div className="space-y-3">
                    {safe.map((cat) => (
                      <MobileBudgetCategoryRow key={cat.id} category={cat} currency={currency} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

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
          <MonthPlanner categories={outflowCategories} />
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

// ─── Mobile helper ──────────────────────────────────────────────────────────

function MobileBudgetCategoryRow({
  category,
  currency,
}: {
  category: CategoryBudgetData;
  currency: CurrencyCode;
}) {
  const pct = category.percentUsed;
  const isOver = pct >= 100;
  const isWarning = pct >= 80 && pct < 100;

  const barColor = isOver
    ? "bg-z-debt"
    : isWarning
      ? "bg-z-alert"
      : "bg-z-income";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        {/* Left: icon + name */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            <CategoryIcon icon={category.icon} className="size-3.5" />
          </span>
          <span className="text-sm font-medium truncate">
            {category.name_es ?? category.name}
          </span>
        </div>

        {/* Right: amounts */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              isOver ? "text-z-debt" : isWarning ? "text-z-alert" : "text-foreground"
            )}
          >
            {formatCurrency(category.spent, currency)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            / {formatCurrency(category.budget!, currency)}
          </span>
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
