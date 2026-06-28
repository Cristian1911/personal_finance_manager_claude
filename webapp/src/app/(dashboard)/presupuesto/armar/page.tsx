import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getEstimatedIncome } from "@/actions/income";
import { getPreferredCurrency } from "@/actions/profile";
import { getUncategorizedTransactions } from "@/actions/categorize";
import { getBudgetMode } from "@/actions/budget";
import { BudgetBuilder } from "@/components/budget/budget-builder";
import type { BudgetMode } from "@/types/domain";

const VALID_MODES: BudgetMode[] = ["per_category", "zero_based", "50_30_20"];

export default async function ArmarPresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const currency = await getPreferredCurrency();
  const [categoriesResult, incomeEstimate, uncategorized, budgetModeResult] =
    await Promise.all([
      getCategoriesWithBudgetData(undefined, currency),
      getEstimatedIncome(currency),
      getUncategorizedTransactions(),
      getBudgetMode(),
    ]);

  const groups = (categoriesResult.success ? categoriesResult.data : []).filter(
    (c) => c.direction === "OUTFLOW" && c.is_active
  );

  const hasUncategorized = uncategorized.length > 0;

  // Mode comes from the wizard (query) on first build, else the saved mode,
  // else the flexible default. budget_mode itself is persisted by the builder
  // only when a real budget is saved.
  const persisted = budgetModeResult.success ? budgetModeResult.data : null;
  const mode: BudgetMode =
    modeParam && VALID_MODES.includes(modeParam as BudgetMode)
      ? (modeParam as BudgetMode)
      : persisted && VALID_MODES.includes(persisted as BudgetMode)
        ? (persisted as BudgetMode)
        : "per_category";

  return (
    <BudgetBuilder
      groups={groups}
      income={incomeEstimate?.monthlyAverage ?? 0}
      currency={currency}
      hasUncategorized={hasUncategorized}
      mode={mode}
    />
  );
}
