import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDebtOverview, getDebtTrend, getArchivedDebtObligations } from "@/actions/debt";
import { getEstimatedIncome } from "@/actions/income";
import { getNonDebtAccounts } from "@/actions/extra-payment";
import { ExtraPaymentTrigger } from "@/components/debt/extra-payment-trigger";
import { DebtHeroCard } from "@/components/debt/debt-hero-card";
import { DebtAccountCard } from "@/components/debt/debt-account-card";
import { DebtQuickStats } from "@/components/debt/debt-quick-stats";
import { SalaryBar } from "@/components/debt/salary-bar";
import { MonthSelector } from "@/components/month-selector";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { DeudasLensRoot } from "@/components/mobile/v2/deudas/deudas-lens-root";
import { getDebtFreeCountdown } from "@/actions/debt-countdown";
import { getPersonalDebtsOverview } from "@/actions/personal-debts";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS, MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import { getPreferredCurrency } from "@/actions/profile";
import { getRecentImpactEvents } from "@/actions/impact-events";
import { AccountImpactTimeline } from "@/components/impact/account-impact-timeline";
import { AccountsSection } from "@/components/accounts/accounts-section";
import { computeDebtStats, getCurrentSalaryBreakdown, getMinPayment } from "@zeta/shared";
import { getExchangeRate } from "@/actions/exchange-rate";
import { ExchangeRateNudge } from "@/components/debt/exchange-rate-nudge";
import { toColombiaDateString } from "@/lib/utils/date";
import {
  DebtOverviewSkeleton,
  DebtQuickStatsSkeleton,
  SalaryBarSkeleton,
  DebtAccountsSkeleton,
} from "@/components/debt/debt-skeletons";

// ──────────────────────────────────────────────────────────────────────────────
// Mobile debt section — 3-lens root (Carga / Plan / Cuentas)
// ──────────────────────────────────────────────────────────────────────────────

async function MobileDebtSection({
  currency,
  month,
}: {
  currency: CurrencyCode;
  month: string | undefined;
}) {
  const isCurrentMonth =
    !month || month >= toColombiaDateString(new Date()).slice(0, 7);

  const [
    overview,
    incomeEstimate,
    sourceAccountsResult,
    usdRateResult,
    trend,
    countdown,
    personasResult,
  ] = await Promise.all([
    getDebtOverview(currency, month),
    getEstimatedIncome(currency, month),
    getNonDebtAccounts(),
    currency !== "USD" ? getExchangeRate("USD", currency) : Promise.resolve(null),
    isCurrentMonth ? getDebtTrend(currency) : Promise.resolve(null),
    getDebtFreeCountdown(currency),
    getPersonalDebtsOverview(),
  ]);
  // Below-the-fold, collapsed history — streamed via Suspense inside the lens,
  // never blocks the hero/trend render (perf rule: non-critical → defer).
  const archivedObligationsPromise = getArchivedDebtObligations();
  const sourceAccounts = sourceAccountsResult.success ? sourceAccountsResult.data : [];
  const usdToCopRate = usdRateResult?.rate ?? null;

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

  const personasSummary = personasResult.success
    ? {
        activeCount:
          personasResult.data.iOwe.byPerson.length +
          personasResult.data.owedToMe.byPerson.length,
        iOweTotal: personasResult.data.iOwe.total,
        owedToMeTotal: personasResult.data.owedToMe.total,
        owedToMe: personasResult.data.owedToMe.byPerson.map((p) => ({
          name: p.destinatario_name,
          amount: p.amount,
        })),
        iOwe: personasResult.data.iOwe.byPerson.map((p) => ({
          name: p.destinatario_name,
          amount: p.amount,
        })),
      }
    : null;

  const secondaryCurrencies = overview.debtByCurrency.filter(
    (d) => d.currency !== currency && d.totalDebt > 0
  );
  const exchangeRate =
    usdRateResult && secondaryCurrencies.length > 0
      ? {
          rate: usdRateResult.rate,
          avg30d: usdRateResult.avg30d,
          percentVsAvg: usdRateResult.percentVsAvg,
          from: secondaryCurrencies[0].currency as CurrencyCode,
        }
      : null;

  return (
    <DeudasLensRoot
      stats={stats}
      overview={overview}
      salaryBreakdown={salaryBreakdown}
      trend={trend}
      countdown={countdown}
      personasSummary={personasSummary}
      exchangeRate={exchangeRate}
      currency={currency}
      archivedObligations={archivedObligationsPromise}
      sourceAccounts={sourceAccounts}
      usdToCopRate={usdToCopRate}
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Desktop debt section (unchanged)
// ──────────────────────────────────────────────────────────────────────────────

async function DesktopDebtSection({
  currency,
  month,
}: {
  currency: CurrencyCode;
  month: string | undefined;
}) {
  const [overview, incomeEstimate, exchangeRateResult, sourceAccountsResult] = await Promise.all([
    getDebtOverview(currency, month),
    getEstimatedIncome(currency, month),
    getExchangeRate("USD" as CurrencyCode, currency).catch(() => null),
    getNonDebtAccounts(),
  ]);
  const sourceAccounts = sourceAccountsResult.success ? sourceAccountsResult.data : [];

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

      <ExtraPaymentTrigger
        debtAccounts={overview.accounts}
        sourceAccounts={sourceAccounts}
        currency={currency}
        usdToCopRate={exchangeRateResult?.rate ?? null}
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
// Page
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
    <div className="space-y-3 lg:space-y-8">
      {/* ── Mobile ── */}
      <div className={`lg:hidden space-y-4 ${MOBILE_TAB_BAR_CLEARANCE_CLASS}`}>
        <MobileHeader
          variant="main"
          title="Deudas"
          subtitle={`Lectura en ${currency}`}
        />
        <div className="flex justify-center">
          <Suspense fallback={<div className="h-9 w-40 rounded-md bg-z-surface-2 animate-pulse" />}>
            <MonthSelector />
          </Suspense>
        </div>
        <Suspense
          fallback={
            <div className="space-y-3">
              <DebtOverviewSkeleton />
              <DebtQuickStatsSkeleton />
              <SalaryBarSkeleton />
            </div>
          }
        >
          <MobileDebtSection currency={currency} month={month} />
        </Suspense>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:block space-y-6">
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
              <Suspense fallback={<div className="h-9 w-40 rounded-md bg-z-surface-2 animate-pulse" />}>
                <MonthSelector />
              </Suspense>
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
          <DesktopDebtSection currency={currency} month={month} />
        </Suspense>

        <AccountImpactTimeline events={impactEvents} />

        <AccountsSection />
      </div>
    </div>
  );
}

