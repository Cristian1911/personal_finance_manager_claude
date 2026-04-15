import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDebtOverview } from "@/actions/debt";
import { getEstimatedIncome } from "@/actions/income";
import { getNonDebtAccounts } from "@/actions/extra-payment";
import { ExtraPaymentTrigger } from "@/components/debt/extra-payment-trigger";
import { DebtHeroCard } from "@/components/debt/debt-hero-card";
import { DebtAccountCard } from "@/components/debt/debt-account-card";
import { DebtQuickStats } from "@/components/debt/debt-quick-stats";
import { SalaryBar } from "@/components/debt/salary-bar";
import { MonthSelector } from "@/components/month-selector";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { DeudasRoot } from "@/components/mobile/v2/deudas/deudas-root";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import { getPreferredCurrency } from "@/actions/profile";
import { getRecentImpactEvents } from "@/actions/impact-events";
import { AccountImpactTimeline } from "@/components/impact/account-impact-timeline";
import { AccountsSection } from "@/components/accounts/accounts-section";
import { computeDebtStats, getCurrentSalaryBreakdown, getMinPayment } from "@zeta/shared";
import { getExchangeRate } from "@/actions/exchange-rate";
import { ExchangeRateNudge } from "@/components/debt/exchange-rate-nudge";
import { formatCurrency } from "@/lib/utils/currency";
import {
  DebtOverviewSkeleton,
  DebtQuickStatsSkeleton,
  SalaryBarSkeleton,
  DebtAccountsSkeleton,
} from "@/components/debt/debt-skeletons";

// ──────────────────────────────────────────────────────────────────────────────
// Mobile debt section — uses new DeudasRoot
// ──────────────────────────────────────────────────────────────────────────────

async function MobileDebtSection({
  currency,
  month,
}: {
  currency: CurrencyCode;
  month: string | undefined;
}) {
  const [overview, incomeEstimate, sourceAccountsResult, usdRateResult] = await Promise.all([
    getDebtOverview(currency),
    getEstimatedIncome(currency, month),
    getNonDebtAccounts(),
    currency !== "USD" ? getExchangeRate("USD", currency) : Promise.resolve(null),
  ]);
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

  return (
    <>
      <DeudasRoot
        stats={stats}
        overview={overview}
        salaryBreakdown={salaryBreakdown}
        currency={currency}
        extraPaymentTrigger={
          <ExtraPaymentTrigger
            debtAccounts={overview.accounts}
            sourceAccounts={sourceAccounts}
            currency={currency}
            usdToCopRate={usdToCopRate}
            variant="compact"
          />
        }
      />
    </>
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
    getDebtOverview(currency),
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
      <div className="lg:hidden space-y-4">
        <div className="flex justify-center">
          <Suspense fallback={<div className="h-9 w-40 rounded-md bg-z-surface-2 animate-pulse" />}>
            <MonthSelector compact />
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
        <AccountsSection />
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
              <Suspense>
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

// ──────────────────────────────────────────────────────────────────────────────
// Mobile utilization ring — smaller, inline variant
// ──────────────────────────────────────────────────────────────────────────────

function UtilizationRingMobile({
  percentage,
  color,
}: {
  percentage: number;
  color: string;
}) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percentage / 100);

  return (
    <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
        style={{ color }}
      >
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}
