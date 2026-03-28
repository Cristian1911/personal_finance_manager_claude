import { connection } from "next/server";
import { Suspense } from "react";
import { getDebtOverview } from "@/actions/debt";
import { getEstimatedIncome } from "@/actions/income";
import { DebtHeroCard } from "@/components/debt/debt-hero-card";
import dynamic from "next/dynamic";

// Server Component — chart component is already "use client", no ssr: false needed
const UtilizationGauge = dynamic(
  () => import("@/components/debt/utilization-gauge").then((m) => ({ default: m.UtilizationGauge })),
  { loading: () => <div className="h-[200px] w-full rounded-xl bg-muted animate-pulse" /> }
);
import { InterestCostCard } from "@/components/debt/interest-cost-card";
import { DebtAccountCard } from "@/components/debt/debt-account-card";
import { DebtInsights } from "@/components/debt/debt-insights";
import { SalaryBar } from "@/components/debt/salary-bar";
import { MonthSelector } from "@/components/month-selector";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { PageHero, HeroPill, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { ArrowRight, Calculator, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { CurrencyCode } from "@/types/domain";
import { getPreferredCurrency } from "@/actions/profile";
import { getCurrentSalaryBreakdown, getMinPayment } from "@zeta/shared";
import { getExchangeRate } from "@/actions/exchange-rate";
import { ExchangeRateNudge } from "@/components/debt/exchange-rate-nudge";
import {
  DebtOverviewSkeleton,
  DebtInsightsSkeleton,
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
  // Fetch all debt data in parallel — same as the original Promise.all
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

  // Use pre-fetched exchange rate only if there are secondary currency debts
  const exchangeRate = secondaryCurrencies.length > 0 ? exchangeRateResult : null;

  // Salary breakdown — only if income is detected
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

  return (
    <>
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

      {/* Exchange rate nudge */}
      {exchangeRate && secondaryCurrencies.length > 0 && (
        <ExchangeRateNudge
          rate={exchangeRate.rate}
          avg30d={exchangeRate.avg30d}
          percentVsAvg={exchangeRate.percentVsAvg}
          from={secondaryCurrencies[0].currency as CurrencyCode}
          to={currency}
        />
      )}

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
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Page export — tier 1: headers render instantly, tier 2 streams in with skeleton
// ──────────────────────────────────────────────────────────────────────────────

export default async function DeudasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const { month } = await searchParams;
  // getPreferredCurrency is server-cached (~0ms after first call)
  const currency = await getPreferredCurrency();

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Tier 1: headers render instantly — no data fetching blocked */}
      <MobilePageHeader title="Deudas" backHref="/plan">
        <Suspense>
          <MonthSelector />
        </Suspense>
      </MobilePageHeader>
      <PageHero
        variant="brass"
        pills={<><HeroPill>Detalle del plan</HeroPill><HeroAccentPill>Presión financiera</HeroAccentPill></>}
        title="La capa donde decides cómo reducir la presión sin perder margen"
        description="Esta vista existe para entender costo, utilización y orden de ataque. Si aquí hay fricción, el resto del plan se vuelve frágil."
        actions={<>
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/deudas/planificador">
              Planificador de pagos
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className={GHOST_BUTTON_CLASS}
          >
            <Link href="/plan">Volver a Plan</Link>
          </Button>
          <div className="hidden lg:block">
            <Suspense>
              <MonthSelector />
            </Suspense>
          </div>
        </>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Moneda de lectura"
            value={currency}
            description="Base usada para concentrar la lectura principal de deuda."
          />
          <StatCard
            label={<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark"><Calculator className="size-4 text-z-brass" />Siguiente capa</div>}
            value={<span className="text-sm font-medium text-z-white">Planificador</span>}
            description="Cuando ya entiendes la presión, aquí conviertes eso en escenarios comparables."
          />
          <StatCard
            label="Qué ver primero"
            value={<span className="text-sm font-medium text-z-white">Utilización, interés y pago mínimo</span>}
            description="Ese orden da la señal más rápida sobre dónde estás perdiendo aire."
          />
          <StatCard
            label={<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark"><ShieldCheck className="size-4 text-z-brass" />Cómo usar esta vista</div>}
            value=""
            description="Lee la presión aquí y baja al planificador solo cuando necesites comparar trayectorias."
          />
        </div>
      </PageHero>

      {/* Tier 2: all debt data streams in with content-shaped skeleton */}
      <Suspense
        fallback={
          <div className="space-y-6">
            <DebtOverviewSkeleton />
            <DebtInsightsSkeleton />
            <SalaryBarSkeleton />
            <DebtAccountsSkeleton />
          </div>
        }
      >
        <DebtOverviewSection currency={currency} month={month} />
      </Suspense>
    </div>
  );
}
