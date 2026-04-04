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
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { DeudasHub } from "@/components/mobile/v2/deudas-hub";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import { getPreferredCurrency } from "@/actions/profile";
import { getRecentImpactEvents } from "@/actions/impact-events";
import { AccountImpactTimeline } from "@/components/impact/account-impact-timeline";
import { getCurrentSalaryBreakdown, getMinPayment, computeDebtStats, estimateMonthlyInterest } from "@zeta/shared";
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
  const [currency, impactEvents, debtOverview] = await Promise.all([
    getPreferredCurrency(),
    getRecentImpactEvents(20),
    getDebtOverview(),
  ]);

  // ── Mobile DeudasHub data ───────────────────────────────────────────────────
  const mobileDebtStats = computeDebtStats(debtOverview.accounts);
  const creditCards = debtOverview.accounts.filter((a) => a.type === "CREDIT_CARD");
  const cardUsedAmount = creditCards
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + a.balance, 0);
  const cardTotalCupo = creditCards
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + (a.creditLimit ?? 0), 0);
  const cardUsagePercent = cardTotalCupo > 0 ? Math.round((cardUsedAmount / cardTotalCupo) * 100) : 0;
  const cardInterestMonthly = creditCards
    .filter((a) => a.currency === currency)
    .reduce((sum, a) => sum + estimateMonthlyInterest(a.balance, a.interestRate ?? 0), 0);
  const totalInterestMonthly = debtOverview.monthlyInterestEstimate;

  // Nearest payoff: find account closest to being paid off
  const activeAccounts = debtOverview.accounts.filter((a) => a.balance > 0 && a.currency === currency);
  const nearestPayoff = (() => {
    if (activeAccounts.length === 0) return null;
    let best: { name: string; remaining: number; months: number; progressPercent: number } | null = null;
    for (const a of activeAccounts) {
      const monthlyPay = a.monthlyPayment ?? 0;
      if (monthlyPay <= 0) continue;
      const months = Math.ceil(a.balance / monthlyPay);
      const original = a.type === "CREDIT_CARD" ? (a.creditLimit ?? a.balance) : (a.loanAmount ?? a.balance);
      const progress = original > 0 ? Math.round(((original - a.balance) / original) * 100) : 0;
      if (!best || months < best.months) {
        best = { name: a.name, remaining: a.balance, months, progressPercent: progress };
      }
    }
    return best;
  })();

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Mobile: v2 header + DeudasHub */}
      <div className="lg:hidden">
        <MobileHeader
          variant="page"
          title="Deudas"
          subtitle={`Lectura en ${currency}`}
          action={
            <Suspense>
              <MonthSelector />
            </Suspense>
          }
        />
        <div className="pt-3">
          <DeudasHub
            monthlyPayment={mobileDebtStats.totalMonthlyPayment}
            monthlyInterest={totalInterestMonthly}
            cardUsagePercent={cardUsagePercent}
            cardUsedAmount={cardUsedAmount}
            cardTotalCupo={cardTotalCupo}
            cardInterestMonthly={cardInterestMonthly}
            totalInterestMonthly={totalInterestMonthly}
            nearestPayoff={nearestPayoff}
            accountCount={activeAccounts.length}
            currency={currency}
          />
        </div>
      </div>

      <div className="hidden lg:block">
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
              <Suspense>
                <MonthSelector />
              </Suspense>
            </>
          }
        />
      </div>

      <div className="hidden lg:block space-y-6">
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
    </div>
  );
}
