import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDebtOverview } from "@/actions/debt";
import { getEstimatedIncome } from "@/actions/income";
import { DebtHeroCard } from "@/components/debt/debt-hero-card";
import { DebtAccountCard } from "@/components/debt/debt-account-card";
import { DebtQuickStats } from "@/components/debt/debt-quick-stats";
import { SalaryBar } from "@/components/debt/salary-bar";
import { MonthSelector } from "@/components/month-selector";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import { getPreferredCurrency } from "@/actions/profile";
import { getRecentImpactEvents } from "@/actions/impact-events";
import { AccountImpactTimeline } from "@/components/impact/account-impact-timeline";
import { getCurrentSalaryBreakdown, getMinPayment, computeDebtStats } from "@zeta/shared";
import { getExchangeRate } from "@/actions/exchange-rate";
import { ExchangeRateNudge } from "@/components/debt/exchange-rate-nudge";
import {
  DebtOverviewSkeleton,
  DebtQuickStatsSkeleton,
  SalaryBarSkeleton,
  DebtAccountsSkeleton,
} from "@/components/debt/debt-skeletons";

// ──────────────────────────────────────────────────────────────────────────────
// Tier 2 async Server Component — streams in all debt data with skeleton fallback
// ──────────────────────────────────────────────────────────────────────────────

async function DebtOverviewSection({
  currency,
  month,
}: {
  currency: CurrencyCode;
  month: string | undefined;
}) {
  const [overview, incomeEstimate, exchangeRateResult] = await Promise.all([
    getDebtOverview(currency),
    getEstimatedIncome(currency, month),
    getExchangeRate("USD" as CurrencyCode, currency).catch(() => null),
  ]);

  if (overview.accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-2">
          No tienes cuentas de deuda registradas.
        </p>
        <Link href="/accounts" className="text-primary hover:underline text-sm">
          Agregar tarjeta de crédito o préstamo
        </Link>
      </div>
    );
  }

  const creditCards = overview.accounts.filter((a) => a.type === "CREDIT_CARD");
  const loans = overview.accounts.filter((a) => a.type === "LOAN");
  const preferredCurrencyCreditCards = creditCards.filter((a) => a.currency === currency);
  const totalCreditUsed = preferredCurrencyCreditCards.reduce((sum, a) => sum + a.balance, 0);
  const secondaryCurrencies = overview.debtByCurrency.filter(
    (d) => d.currency !== currency && d.totalDebt > 0
  );

  const exchangeRate = secondaryCurrencies.length > 0 ? exchangeRateResult : null;

  const salaryBreakdown =
    incomeEstimate && incomeEstimate.monthlyAverage > 0
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

  const stats = computeDebtStats(overview.accounts);

  return (
    <>
      <DebtHeroCard
        totalDebt={overview.totalDebt}
        totalMonthlyPayment={stats.totalMonthlyPayment}
        monthlyInterest={overview.monthlyInterestEstimate}
        secondaryCurrencies={secondaryCurrencies}
        currency={currency}
      />

      {exchangeRate && secondaryCurrencies.length > 0 && (
        <ExchangeRateNudge
          rate={exchangeRate.rate}
          avg30d={exchangeRate.avg30d}
          percentVsAvg={exchangeRate.percentVsAvg}
          from={secondaryCurrencies[0].currency as CurrencyCode}
          to={currency}
        />
      )}

      <DebtQuickStats
        stats={stats}
        currency={currency}
        overallUtilization={overview.overallUtilization}
        totalCreditUsed={totalCreditUsed}
        totalCreditLimit={overview.totalCreditLimit}
      />

      {salaryBreakdown && incomeEstimate && (
        <SalaryBar breakdown={salaryBreakdown} currency={currency} />
      )}

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
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Page — tier 1: headers instant, tier 2 streams in
// ──────────────────────────────────────────────────────────────────────────────

export default async function DeudasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const { month } = await searchParams;
  const [currency, impactEvents] = await Promise.all([
    getPreferredCurrency(),
    getRecentImpactEvents(20),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Deudas" backHref="/plan">
        <Suspense>
          <MonthSelector />
        </Suspense>
      </MobilePageHeader>

      <PageHeaderRow
        title="Deudas"
        subtitle={`Lectura en ${currency}`}
        actions={
          <>
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/deudas/planificador">
                Planificador de pagos
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className={GHOST_BUTTON_CLASS}>
              <Link href="/plan">Volver a Plan</Link>
            </Button>
            <div className="hidden lg:block">
              <Suspense>
                <MonthSelector />
              </Suspense>
            </div>
          </>
        }
      />

      <Suspense
        fallback={
          <div className="space-y-6">
            <DebtOverviewSkeleton />
            <DebtQuickStatsSkeleton />
            <SalaryBarSkeleton />
            <DebtAccountsSkeleton />
          </div>
        }
      >
        <DebtOverviewSection currency={currency} month={month} />
      </Suspense>

      <AccountImpactTimeline events={impactEvents} />
    </div>
  );
}
