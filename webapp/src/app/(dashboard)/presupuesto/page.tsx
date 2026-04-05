import { connection } from "next/server";
import dynamic from "next/dynamic";
import { getBudgetMode } from "@/actions/budget";
import { getEstimatedIncome } from "@/actions/income";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { get503020Allocation } from "@/actions/allocation";
import { getPreferredCurrency } from "@/actions/profile";
import { parseMonth, formatMonthLabel, getDaysRemainingInMonth } from "@/lib/utils/date";

const BudgetWizard = dynamic(
  () => import("@/components/budget/budget-wizard").then((m) => ({ default: m.BudgetWizard })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
);

const BudgetPageClient = dynamic(
  () => import("@/components/budget/budget-page-client").then((m) => ({ default: m.BudgetPageClient })),
  { loading: () => <div className="h-96 rounded-xl bg-muted animate-pulse" /> }
);

export default async function PresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;

  const currency = await getPreferredCurrency();

  const [modeResult, incomeEstimate, categoriesResult, allocationData] = await Promise.all([
    getBudgetMode(),
    getEstimatedIncome(currency, month),
    getCategoriesWithBudgetData(month, currency),
    get503020Allocation(month, currency),
  ]);

  const budgetMode = modeResult.success ? modeResult.data : null;
  const income = incomeEstimate?.monthlyAverage ?? 0;
  const categories = categoriesResult.success ? categoriesResult.data : [];

  const target = parseMonth(month);
  const daysRemaining = getDaysRemainingInMonth(target);

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
          currency={currency}
          allocationData={allocationData}
        />
      </div>
    );
  }

  return (
    <BudgetPageClient
      mode={budgetMode as "per_category" | "zero_based"}
      categories={categories}
      income={income}
      currency={currency}
      monthLabel={formatMonthLabel(target)}
      allocationData={allocationData}
      daysRemaining={daysRemaining}
    />
  );
}
