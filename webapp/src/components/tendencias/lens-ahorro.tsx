import type { CurrencyCode } from "@/types/domain";
import type { AhorroData } from "./types";
import { SavingsRateCard } from "./savings-rate-card";
import { IncomeExpenseCard } from "./income-expense-card";
import { BudgetAdherenceCard } from "./budget-adherence-card";

export function LensAhorro({ data, currency }: { data: AhorroData; currency: CurrencyCode }) {
  return (
    <>
      <SavingsRateCard savings={data.savings} />
      <IncomeExpenseCard cashflow={data.cashflow} currency={currency} />
      <BudgetAdherenceCard adherence={data.adherence} />
    </>
  );
}
