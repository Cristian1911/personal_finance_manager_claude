import { getDebtOverview } from "@/actions/debt";
import { getEstimatedIncome } from "@/actions/income";
import { DebtHeroCard } from "@/components/debt/debt-hero-card";
import { UtilizationGauge } from "@/components/debt/utilization-gauge";
import { InterestCostCard } from "@/components/debt/interest-cost-card";
import { DebtAccountCard } from "@/components/debt/debt-account-card";
import { DebtInsights } from "@/components/debt/debt-insights";
import { SalaryBar } from "@/components/debt/salary-bar";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import Link from "next/link";
import type { CurrencyCode } from "@/types/domain";
import { getPreferredCurrency } from "@/actions/profile";
import { getCurrentSalaryBreakdown, getMinPayment } from "@zeta/shared";

export default async function DeudasPage() {
  const currency = await getPreferredCurrency();

  const overview = await getDebtOverview(currency);
  const incomeEstimate = await getEstimatedIncome(currency);

  if (overview.accounts.length === 0) {
    return (
      <div className="space-y-6">
        <MobilePageHeader title="Deudas" backHref="/gestionar" />
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold">Deudas</h1>
          <p className="text-muted-foreground">
            Visualiza y gestiona tus deudas
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">
            No tienes cuentas de deuda registradas.
          </p>
          <Link href="/accounts" className="text-primary hover:underline text-sm">
            Agregar tarjeta de crédito o préstamo
          </Link>
        </div>
      </div>
    );
  }

  const creditCards = overview.accounts.filter((a) => a.type === "CREDIT_CARD");
  const loans = overview.accounts.filter((a) => a.type === "LOAN");
  const preferredCurrencyCreditCards = creditCards.filter((a) => a.currency === currency);
  const totalCreditUsed = preferredCurrencyCreditCards.reduce((sum, a) => sum + a.balance, 0);
  const secondaryCurrencies = overview.debtByCurrency.filter((d) => d.currency !== currency && d.totalDebt > 0);

  // Salary breakdown — only if income is detected
  const salaryBreakdown = incomeEstimate && incomeEstimate.monthlyAverage > 0
    ? getCurrentSalaryBreakdown({
        monthlyIncome: incomeEstimate.monthlyAverage,
        debtPayments: overview.accounts
          .filter((a) => a.balance > 0)
          .map((a) => ({
            accountId: a.id,
            name: a.name,
            amount: getMinPayment(a),
          })),
      })
    : null;

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Deudas" backHref="/gestionar" />
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Deudas</h1>
          <p className="text-muted-foreground">
            Visualiza y gestiona tus deudas
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/deudas/planificador">
            <Calculator className="h-4 w-4 mr-2" />
            Planificador de pagos
          </Link>
        </Button>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DebtHeroCard
          totalDebt={overview.totalDebt}
          secondaryCurrencies={secondaryCurrencies}
        />
        {overview.totalCreditLimit > 0 && (
          <UtilizationGauge
            utilization={overview.overallUtilization}
            totalUsed={totalCreditUsed}
            totalLimit={overview.totalCreditLimit}
          />
        )}
        <InterestCostCard monthlyInterest={overview.monthlyInterestEstimate} />
      </div>

      {/* Insights */}
      <DebtInsights insights={overview.insights} />

      {/* Salary breakdown */}
      {salaryBreakdown && incomeEstimate && (
        <SalaryBar breakdown={salaryBreakdown} currency={currency} />
      )}

      {/* Per-account cards */}
      {creditCards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Tarjetas de crédito</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creditCards.map((acct) => (
              <DebtAccountCard key={acct.id} account={acct} />
            ))}
          </div>
        </div>
      )}

      {loans.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Préstamos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loans.map((acct) => (
              <DebtAccountCard key={acct.id} account={acct} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
