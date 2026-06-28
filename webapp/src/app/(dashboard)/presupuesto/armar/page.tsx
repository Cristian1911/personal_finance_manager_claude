import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getEstimatedIncome } from "@/actions/income";
import { getPreferredCurrency } from "@/actions/profile";
import { getUncategorizedTransactions } from "@/actions/categorize";
import { BudgetBuilder } from "@/components/budget/budget-builder";

export default async function ArmarPresupuestoPage() {
  const currency = await getPreferredCurrency();
  const [categoriesResult, incomeEstimate, uncategorized] = await Promise.all([
    getCategoriesWithBudgetData(undefined, currency),
    getEstimatedIncome(currency),
    getUncategorizedTransactions(),
  ]);

  const groups = (categoriesResult.success ? categoriesResult.data : []).filter(
    (c) => c.direction === "OUTFLOW" && c.is_active
  );

  const hasUncategorized = uncategorized.length > 0;

  return (
    <BudgetBuilder
      groups={groups}
      income={incomeEstimate?.monthlyAverage ?? 0}
      currency={currency}
      hasUncategorized={hasUncategorized}
    />
  );
}
