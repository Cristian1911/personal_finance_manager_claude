import { connection } from "next/server";
import { getBudgetMode, getEstimatedIncome } from "@/actions/budget";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { BudgetWizard } from "@/components/budget/budget-wizard";
import { BudgetPageClient } from "@/components/budget/budget-page-client";
import { parseMonth, formatMonthLabel } from "@/lib/utils/date";

export default async function PresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;

  const [modeResult, incomeResult, categoriesResult] = await Promise.all([
    getBudgetMode(),
    getEstimatedIncome(),
    getCategoriesWithBudgetData(month),
  ]);

  const budgetMode = modeResult.success ? modeResult.data : null;
  const income = incomeResult.success ? incomeResult.data : 0;
  const categories = categoriesResult.success ? categoriesResult.data : [];

  if (!budgetMode) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Presupuesto
          </p>
          <h1 className="text-2xl font-bold">Configura tu presupuesto</h1>
          <p className="text-sm text-muted-foreground">
            Elige como quieres gestionar tu dinero cada mes.
          </p>
        </div>
        <BudgetWizard
          categories={categories}
          estimatedIncome={income}
          currency="COP"
        />
      </div>
    );
  }

  return (
    <BudgetPageClient
      mode={budgetMode as "per_category" | "zero_based"}
      categories={categories}
      income={income}
      currency="COP"
      monthLabel={formatMonthLabel(parseMonth(month))}
    />
  );
}
