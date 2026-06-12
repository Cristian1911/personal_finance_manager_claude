import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getEstimatedIncome } from "@/actions/income";
import { getPreferredCurrency } from "@/actions/profile";
import { BudgetBuilder } from "@/components/budget/budget-builder";

export default async function ArmarPresupuestoPage() {
  const currency = await getPreferredCurrency();
  const [categoriesResult, incomeEstimate] = await Promise.all([
    getCategoriesWithBudgetData(undefined, currency),
    getEstimatedIncome(currency),
  ]);

  const groups = (categoriesResult.success ? categoriesResult.data : []).filter(
    (c) => c.direction === "OUTFLOW" && c.is_active
  );

  return (
    <BudgetBuilder
      groups={groups}
      income={incomeEstimate?.monthlyAverage ?? 0}
      currency={currency}
    />
  );
}
