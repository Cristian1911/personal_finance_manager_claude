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
import { MonthPlanner } from "@/components/budget/month-planner";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { StateChip } from "@/components/mobile/v2/state-chip";
import { CategoryIcon } from "@/components/categories/category-icon";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { AlertTriangle } from "lucide-react";
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

  // Sort: over-budget first, then by percentUsed descending
  const sortedCategories = [...budgeted].sort((a, b) => {
    const aOver = a.percentUsed >= 100 ? 1 : 0;
    const bOver = b.percentUsed >= 100 ? 1 : 0;
    if (aOver !== bOver) return bOver - aOver;
    return b.percentUsed - a.percentUsed;
  });

  const pressure = progress >= 100 ? "critical" : progress >= 80 ? "watch" : "stable";
  const chipConfig = {
    stable: { label: "En control", variant: "sage" as const },
    watch: { label: "Atención", variant: "warn" as const },
    critical: { label: "Sobre límite", variant: "danger" as const },
  } as const;
  const chip = chipConfig[pressure];

  return (
    <div className="space-y-6">
      {/* Mobile view */}
      <div className="lg:hidden pb-20">
        <MobileHeader variant="sub" title="Presupuesto" backHref="/plan" />

        <div className="space-y-4 px-4 pt-4">
          {/* Budget hero card */}
          <div className={cn(PANEL_INSET_CLASS, "p-4")}>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
              Gastado este mes
            </p>

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
            <div className="relative mt-3 h-2.5 rounded-full bg-[#1e221d]">
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

            {/* Status + distribution */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>Necesario {essentialPct}%</span>
                <span className="text-white/15">|</span>
                <span>Deseos {wantsPct}%</span>
              </div>
              <StateChip label={chip.label} variant={chip.variant} />
            </div>
          </div>

          {/* Category list */}
          {sortedCategories.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark mb-2">
                Por categoría
              </p>
              <div className="space-y-3">
                {sortedCategories.map((cat) => (
                  <MobileBudgetCategoryRow key={cat.id} category={cat} currency={currency} />
                ))}
              </div>
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
          {isOver && (
            <AlertTriangle className="size-3.5 shrink-0 text-z-debt" />
          )}
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
