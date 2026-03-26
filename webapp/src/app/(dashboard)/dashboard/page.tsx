import { connection } from "next/server";
import { Suspense } from "react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { getPreferredCurrency } from "@/actions/profile";
import type { CurrencyCode } from "@/types/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import {
  formatDate,
  parseMonth,
  formatMonthLabel,
} from "@/lib/utils/date";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  FileUp,
  Landmark,
  Sparkles,
  Tags,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { Button } from "@/components/ui/button";
import {
  getDashboardHeroData,
  getAccountsWithSparklineData,
  getMonthlyCashflow,
} from "@/actions/charts";
import dynamic from "next/dynamic";
import { getAccounts } from "@/actions/accounts";
import { getDashboardConfigWithPurpose } from "@/actions/dashboard-config";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import { AccountsOverview } from "@/components/dashboard/accounts-overview";
import { DashboardAccountPicker } from "@/components/dashboard/dashboard-account-picker";
import { MonthSelector } from "@/components/month-selector";
import { trackProductEvent } from "@/actions/product-events";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import { MobileDashboard } from "@/components/mobile/mobile-dashboard";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { getLatestSnapshotDates } from "@/actions/statement-snapshots";
import { getBurnRate } from "@/actions/burn-rate";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DashboardConfigProvider } from "@/components/dashboard/dashboard-config-provider";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { CashFlowHeroStrip } from "@/components/dashboard/cash-flow-hero-strip";
import { HealthMetersCard } from "@/components/dashboard/health-meters-card";
import { getHealthMeters } from "@/actions/health-meters";
import { get503020Allocation } from "@/actions/allocation";
import { getDebtFreeCountdown } from "@/actions/debt-countdown";
import { FlujoWaterfall } from "@/components/dashboard/flujo-waterfall";
import { FlujoCharts } from "@/components/dashboard/flujo-charts";
import { PresupuestoSection } from "@/components/dashboard/presupuesto-section";
import { PatrimonioSection } from "@/components/dashboard/patrimonio-section";
import { ActividadHeatmap } from "@/components/dashboard/actividad-heatmap";
import { AllocationBars5030 } from "@/components/budget/allocation-bars-5030";
import { DebtFreeCountdown } from "@/components/debt/debt-free-countdown";
import {
  BurnRateSkeleton,
  AccountsSkeleton,
  FlujoWaterfallSkeleton,
  FlujoChartsSkeleton,
  PresupuestoSkeleton,
  PatrimonioSkeleton,
  HeatmapSkeleton,
  UpcomingPaymentsSkeleton,
  CashFlowHeroStripSkeleton,
  MobileBurnRateSkeleton,
  MobileAllocationSkeleton,
  MobileDebtSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import type { HealthMetersData } from "@/actions/health-meters";

// ── Dynamic imports — chart JS is NOT in the initial bundle ──────────────────

// Server Component pages cannot use ssr: false — chart components are already "use client"
// so recharts DOM APIs never run server-side. Dynamic imports here achieve code splitting.
const NetWorthHistoryChart = dynamic(
  () => import("@/components/charts/net-worth-history-chart").then((m) => ({ default: m.NetWorthHistoryChart })),
  { loading: () => <div className="h-[300px] w-full rounded-xl bg-muted animate-pulse" /> }
);

const BudgetPaceChart = dynamic(
  () => import("@/components/charts/budget-pace-chart").then((m) => ({ default: m.BudgetPaceChart })),
  { loading: () => <div className="h-[240px] w-full rounded-xl bg-muted animate-pulse" /> }
);

const CashFlowViewToggle = dynamic(
  () => import("@/components/charts/cash-flow-view-toggle").then((m) => ({ default: m.CashFlowViewToggle })),
  {
    loading: () => (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
          <div className="flex gap-1">
            <div className="h-7 w-16 rounded bg-muted animate-pulse" />
            <div className="h-7 w-16 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-[280px] w-full rounded-xl bg-muted animate-pulse" />
      </div>
    ),
  }
);

const CategoryDonut = dynamic(
  () => import("@/components/charts/category-donut").then((m) => ({ default: m.CategoryDonut })),
  { loading: () => <div className="h-[280px] w-full rounded-xl bg-muted animate-pulse" /> }
);

const BurnRateCard = dynamic(
  () => import("@/components/dashboard/burn-rate-card").then((m) => ({ default: m.BurnRateCard })),
  { loading: () => <div className="h-40 w-full rounded-xl bg-muted animate-pulse" /> }
);

const BurnRateCardEmpty = dynamic(
  () => import("@/components/dashboard/burn-rate-card").then((m) => ({ default: m.BurnRateCardEmpty })),
  { loading: () => <div className="h-40 w-full rounded-xl bg-muted animate-pulse" /> }
);

// ── Types ────────────────────────────────────────────────────────────────────

type DashboardTransactionRow = {
  id: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
  merchant_name?: string | null;
  clean_description?: string | null;
  transaction_date?: string;
  currency_code?: string;
  categories?: { name_es: string | null; name: string } | null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Tier 2 async Server Components — desktop
// ──────────────────────────────────────────────────────────────────────────────

async function BurnRateSection({ currency }: { currency: CurrencyCode }) {
  const burnRateData = await getBurnRate(currency);
  return burnRateData ? <BurnRateCard data={burnRateData} /> : <BurnRateCardEmpty />;
}

async function CashFlowHeroStripSection({
  month,
  currency,
  totalPending,
}: {
  month: string | undefined;
  currency: CurrencyCode;
  totalPending: number;
}) {
  const cashflowData = await getMonthlyCashflow(month, currency);
  const currentMonthCashflow = cashflowData[cashflowData.length - 1];
  const cfIncome = currentMonthCashflow?.income ?? 0;
  const cfExpenses = currentMonthCashflow?.expenses ?? 0;
  const cfFixed = totalPending;
  const cfVariable = Math.max(0, cfExpenses - cfFixed);
  const cfRemaining = cfIncome - cfExpenses;
  return (
    <CashFlowHeroStrip
      income={cfIncome}
      fixedExpenses={cfFixed}
      variableExpenses={cfVariable}
      remaining={cfRemaining}
      currency={currency}
    />
  );
}

async function AccountsSection({
  allAccounts,
}: {
  allAccounts: { id: string; name: string; show_in_dashboard: boolean; account_type: string; updated_at: string | null }[];
}) {
  const [accountsData, latestSnapshotDates] = await Promise.all([
    getAccountsWithSparklineData(),
    getLatestSnapshotDates(),
  ]);
  return (
    <>
      <AccountsOverview
        data={accountsData}
        picker={
          <DashboardAccountPicker
            accounts={allAccounts.map((a) => ({
              id: a.id,
              name: a.name,
              show_in_dashboard: a.show_in_dashboard,
            }))}
          />
        }
      />
      <DashboardAlerts
        accounts={allAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          account_type: a.account_type,
          updated_at: a.updated_at,
        }))}
        latestSnapshotDates={latestSnapshotDates}
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tier 2 async Server Components — mobile
// ──────────────────────────────────────────────────────────────────────────────

async function MobileBurnRateSection({ currency }: { currency: CurrencyCode }) {
  const burnRateData = await getBurnRate(currency);
  return burnRateData ? <BurnRateCard data={burnRateData} /> : <BurnRateCardEmpty />;
}

async function MobileAllocationSection({
  month,
  currency,
}: {
  month: string | undefined;
  currency: CurrencyCode;
}) {
  const allocationData = await get503020Allocation(month, currency);
  if (!allocationData) return null;
  return (
    <DashboardSection
      title="Presupuesto"
      section="presupuesto"
      defaultOpen={false}
      showToggle={false}
      summaryText={`${Math.round(allocationData.needs.percent + allocationData.wants.percent)}% gastado`}
    >
      <AllocationBars5030 data={allocationData} />
    </DashboardSection>
  );
}

async function MobileDebtSection({ currency }: { currency: CurrencyCode }) {
  const debtCountdownData = await getDebtFreeCountdown(currency);
  if (!debtCountdownData) return null;
  return (
    <DashboardSection
      title="Deuda"
      section="patrimonio"
      defaultOpen={false}
      showToggle={false}
      summaryText={`${debtCountdownData.monthsToFree} meses para libre`}
    >
      <DebtFreeCountdown data={debtCountdownData} />
    </DashboardSection>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;
  const target = parseMonth(month);
  const monthLabel = formatMonthLabel(target);

  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return null;

  // Await currency first (it's server-cached, ~0ms after first call)
  const preferredCurrency = await getPreferredCurrency();

  // Fetch transactions + cached accounts + dashboard config in parallel
  const [{ data: recentTransactions }, allAccountsResult, dashboardConfigData] =
    await Promise.all([
      executeVisibleTransactionQuery(() =>
        supabase
          .from("transactions")
          .select("*, categories!category_id(name_es, name)")
          .eq("is_excluded", false)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5)
      ),
      getAccounts(),
      getDashboardConfigWithPurpose(),
    ]);

  const allAccounts = allAccountsResult.success ? allAccountsResult.data : [];

  // Resolve currency from cached accounts — no extra DB queries
  let currency = preferredCurrency;
  const hasCurrencyAccounts = allAccounts.some(a => a.currency_code === preferredCurrency);
  if (!hasCurrencyAccounts && allAccounts.length > 0) {
    currency = allAccounts[0].currency_code as CurrencyCode;
  }

  const recentTx = (recentTransactions ?? []) as DashboardTransactionRow[];
  const hasAccounts = allAccounts.length > 0;
  const starterMode = hasAccounts && recentTx.length === 0;

  void trackProductEvent({
    event_name: "dashboard_viewed",
    flow: "dashboard",
    step: "main",
    entry_point: "direct",
    success: true,
    metadata: {
      starter_mode: starterMode,
      month: monthLabel,
    },
  });

  if (starterMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Tu base ya está lista. Falta activar tu flujo.</p>
          </div>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Primeros pasos recomendados
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Link
              href="/import"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileUp className="h-4 w-4 text-primary" />
                Importar extracto PDF
              </div>
              <p className="text-sm text-muted-foreground">
                Carga tus movimientos reales para activar métricas, categorías y alertas.
              </p>
            </Link>
            <Link
              href="/transactions"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <WalletCards className="h-4 w-4 text-primary" />
                Registrar primer movimiento
              </div>
              <p className="text-sm text-muted-foreground">
                Si aún no tienes PDF, crea movimientos manuales para empezar.
              </p>
            </Link>
            <Link
              href="/categorizar"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Tags className="h-4 w-4 text-primary" />
                Definir categorías base
              </div>
              <p className="text-sm text-muted-foreground">
                Etiqueta tus primeras compras para entrenar sugerencias automáticas.
              </p>
            </Link>
            <Link
              href="/categories"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Landmark className="h-4 w-4 text-primary" />
                Crear presupuesto mensual
              </div>
              <p className="text-sm text-muted-foreground">
                Establece límites desde el inicio para detectar desvíos temprano.
              </p>
            </Link>
          </CardContent>
          <CardContent className="pt-0">
            <Link href="/import">
              <Button className="gap-2">
                Empezar ahora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Tier 1: hero + health meters — rendered immediately ──
  const [heroData, healthMetersData] = await Promise.all([
    getDashboardHeroData(month, currency),
    getHealthMeters(currency, month),
  ]);

  // Map data for mobile dashboard (tier 1 props only)
  const mobileHeroData = {
    availableToSpend: heroData.availableToSpend,
    totalBalance: heroData.totalLiquid,
    pendingFixed: heroData.totalPending,
    currency: heroData.currency,
  };

  const mobileUpcomingPayments = heroData.pendingObligations.slice(0, 5).map((o) => ({
    id: o.id,
    name: o.name,
    dueDate: o.due_date,
    amount: o.amount,
    currencyCode: o.currency_code,
  }));

  const mobileRecentTx = recentTx.map((tx) => ({
    id: tx.id,
    description: tx.merchant_name || tx.clean_description || "Sin descripción",
    amount: tx.amount,
    currency_code: tx.currency_code ?? "COP",
    direction: tx.direction,
    date: tx.transaction_date ?? "",
    category_name: tx.categories?.name_es ?? tx.categories?.name ?? undefined,
  }));

  return (
    <>
      {/* Mobile dashboard */}
      <div className="lg:hidden">
        <div className="space-y-5">
          {/* Tier 1: hero + health (renders immediately) */}
          <MobileDashboard
            heroData={mobileHeroData}
            upcomingPayments={mobileUpcomingPayments}
            recentTransactions={mobileRecentTx}
            healthMetersData={healthMetersData}
          />
          {/* Tier 2: burn rate, allocation, debt (streams in) */}
          <Suspense fallback={<MobileBurnRateSkeleton />}>
            <MobileBurnRateSection currency={currency} />
          </Suspense>
          <Suspense fallback={<MobileAllocationSkeleton />}>
            <MobileAllocationSection month={month} currency={currency} />
          </Suspense>
          <Suspense fallback={<MobileDebtSkeleton />}>
            <MobileDebtSection currency={currency} />
          </Suspense>
        </div>
      </div>

      {/* Desktop dashboard — section-based layout */}
      <div className="hidden lg:block">
        <DashboardConfigProvider
          serverConfig={dashboardConfigData.config}
          appPurpose={dashboardConfigData.appPurpose}
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Tu centro de comando financiero</p>
              </div>
              <Suspense fallback={<div className="h-9 w-36 rounded-md bg-muted animate-pulse" />}>
                <MonthSelector />
              </Suspense>
            </div>

            {/* ── Hero Section — tier 1: always visible, no collapse ── */}
            <DashboardHero data={heroData} />

            {/* CashFlowHeroStrip — tier 2: streams in with skeleton */}
            <WidgetSlot widgetId="hero-flow-strip">
              <Suspense fallback={<CashFlowHeroStripSkeleton />}>
                <CashFlowHeroStripSection
                  month={month}
                  currency={currency}
                  totalPending={heroData.totalPending}
                />
              </Suspense>
            </WidgetSlot>

            {/* ── Niveles Section — tier 1: health meters render immediately ── */}
            <DashboardSection title="Tus niveles" section="niveles" defaultOpen={true} showToggle={false}>
              <WidgetSlot widgetId="health-meters">
                <HealthMetersCard data={healthMetersData} />
              </WidgetSlot>
            </DashboardSection>

            {/* ── Flujo de Caja Section ── */}
            <DashboardSection title="Flujo de caja" section="flujo">
              {/* WaterfallChart — tier 2 */}
              <WidgetSlot widgetId="waterfall">
                <Suspense fallback={<FlujoWaterfallSkeleton />}>
                  <FlujoWaterfall month={month} currency={currency} />
                </Suspense>
              </WidgetSlot>

              {/* BurnRateCard — tier 2 */}
              <WidgetSlot widgetId="burn-rate">
                <Suspense fallback={<BurnRateSkeleton />}>
                  <BurnRateSection currency={currency} />
                </Suspense>
              </WidgetSlot>

              {/* CashFlowViewToggle — tier 2 */}
              <WidgetSlot widgetId="cashflow-trend">
                <Suspense fallback={<FlujoChartsSkeleton />}>
                  <FlujoCharts month={month} currency={currency} monthLabel={monthLabel} />
                </Suspense>
              </WidgetSlot>
            </DashboardSection>

            {/* ── Presupuesto Section — tier 2 ── */}
            <Suspense
              fallback={
                <DashboardSection title="Presupuesto" section="presupuesto">
                  <PresupuestoSkeleton />
                </DashboardSection>
              }
            >
              <PresupuestoSection month={month} currency={currency} monthLabel={monthLabel} healthMetersData={healthMetersData} />
            </Suspense>

            {/* ── Patrimonio y Deuda Section — tier 2 ── */}
            <Suspense
              fallback={
                <DashboardSection title="Patrimonio y deuda" section="patrimonio">
                  <PatrimonioSkeleton />
                </DashboardSection>
              }
            >
              <PatrimonioSection currency={currency} month={month} healthMetersData={healthMetersData} />
            </Suspense>

            {/* ── Actividad Section ── */}
            <DashboardSection title="Actividad" section="actividad">
              {/* Upcoming Payments — tier 1 data (from heroData) */}
              <WidgetSlot widgetId="upcoming-payments">
                <UpcomingPayments
                  obligations={heroData.pendingObligations}
                  totalPending={heroData.totalPending}
                />
              </WidgetSlot>

              {/* Accounts + Alerts — tier 2 */}
              <Suspense fallback={<AccountsSkeleton />}>
                <AccountsSection allAccounts={allAccounts} />
              </Suspense>

              {/* Recent Transactions — tier 1 data (already fetched) */}
              <WidgetSlot widgetId="recent-tx">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Últimas transacciones</CardTitle>
                    <Link
                      href="/transactions"
                      className="text-sm text-primary hover:underline"
                    >
                      Ver todas
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {recentTx.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay transacciones aún.{" "}
                        <Link
                          href="/transactions"
                          className="text-primary hover:underline"
                        >
                          Registrar una
                        </Link>
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {recentTx.map((tx) => (
                          <PrefetchLink
                            key={tx.id}
                            href={`/transactions/${tx.id}`}
                            className="flex items-center justify-between hover:bg-muted rounded-md px-2 py-1 -mx-2 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {tx.direction === "INFLOW" ? (
                                <ArrowDownLeft className="h-4 w-4 text-z-income" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-z-expense" />
                              )}
                              <div>
                                <p className="text-sm font-medium">
                                  {tx.merchant_name ||
                                    tx.clean_description ||
                                    "Sin descripción"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {tx.transaction_date ? formatDate(tx.transaction_date) : "Sin fecha"}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-sm font-medium ${tx.direction === "INFLOW" ? "text-z-income" : ""}`}
                            >
                              {tx.direction === "INFLOW" ? "+" : "-"}
                              {formatCurrency(tx.amount, tx.currency_code as Parameters<typeof formatCurrency>[1])}
                            </span>
                          </PrefetchLink>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </WidgetSlot>

              {/* Spending Heatmap — tier 2 */}
              <WidgetSlot widgetId="spending-heatmap">
                <Suspense fallback={<HeatmapSkeleton />}>
                  <ActividadHeatmap month={month} currency={currency} />
                </Suspense>
              </WidgetSlot>
            </DashboardSection>
          </div>
        </DashboardConfigProvider>
      </div>
    </>
  );
}

// Re-export HealthMetersData type used by sub-components that receive it as prop
export type { HealthMetersData };
