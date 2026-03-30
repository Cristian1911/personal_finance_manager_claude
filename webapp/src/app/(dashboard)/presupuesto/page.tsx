import { connection } from "next/server";
import { getBudgetMode } from "@/actions/budget";
import { getEstimatedIncome } from "@/actions/income";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { BudgetWizard } from "@/components/budget/budget-wizard";
import { BudgetPageClient } from "@/components/budget/budget-page-client";
import { parseMonth, formatMonthLabel } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

export default async function PresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;

  const { supabase, user } = await getAuthenticatedClient();
  const { data: profile } = user
    ? await supabase.from("profiles").select("preferred_currency").eq("id", user.id).single()
    : { data: null };
  const currency = (profile?.preferred_currency ?? "COP") as CurrencyCode;

  const [modeResult, incomeEstimate, categoriesResult] = await Promise.all([
    getBudgetMode(),
    getEstimatedIncome(currency, month),
    getCategoriesWithBudgetData(month, currency),
  ]);

  const budgetMode = modeResult.success ? modeResult.data : null;
  const income = incomeEstimate?.monthlyAverage ?? 0;
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
          currency={currency}
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
      monthLabel={formatMonthLabel(parseMonth(month))}
    />
  );
}
