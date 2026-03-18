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
  getDailyBudgetPace,
  getCategorySpending,
  getMonthlyCashflow,
} from "@/actions/charts";
import { getAccounts } from "@/actions/accounts";
import { getDashboardConfigWithPurpose } from "@/actions/dashboard-config";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import { AccountsOverview } from "@/components/dashboard/accounts-overview";
import { DashboardAccountPicker } from "@/components/dashboard/dashboard-account-picker";
import { BudgetPaceChart } from "@/components/charts/budget-pace-chart";
import { CashFlowViewToggle } from "@/components/charts/cash-flow-view-toggle";
import { WaterfallChart } from "@/components/charts/waterfall-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { DashboardBudgetBar } from "@/components/budget/dashboard-budget-bar";
import { MonthSelector } from "@/components/month-selector";
import { trackProductEvent } from "@/actions/product-events";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import { MobileDashboard } from "@/components/mobile/mobile-dashboard";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { getLatestSnapshotDates } from "@/actions/statement-snapshots";
import { getBurnRate } from "@/actions/burn-rate";
import { BurnRateCard, BurnRateCardEmpty } from "@/components/dashboard/burn-rate-card";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DashboardConfigProvider } from "@/components/dashboard/dashboard-config-provider";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { CashFlowHeroStrip } from "@/components/dashboard/cash-flow-hero-strip";
import { HealthMetersCard } from "@/components/dashboard/health-meters-card";
import { getHealthMeters } from "@/actions/health-meters";

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

/** Placeholder for widgets not yet implemented */
function WidgetPlaceholder({ label }: { label: string }) {
  return (
    <div className="h-64 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
      {label} (pendiente)
    </div>
  );
}

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

  await trackProductEvent({
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

  // Fast data: hero, burn rate, snapshots — renders immediately
  const [heroData, latestSnapshotDates, burnRateData, accountsData, cashflowData, healthMetersData] =
    await Promise.all([
      getDashboardHeroData(month, currency),
      getLatestSnapshotDates(),
      getBurnRate(currency),
      getAccountsWithSparklineData(),
      getMonthlyCashflow(month, currency),
      getHealthMeters(currency, month),
    ]);

  // Cash flow hero strip data — use current month's cashflow
  const currentMonthCashflow = cashflowData[cashflowData.length - 1];
  const cfIncome = currentMonthCashflow?.income ?? 0;
  const cfExpenses = currentMonthCashflow?.expenses ?? 0;
  // Use totalPending as proxy for fixed expenses (already fetched, no extra query needed)
  const cfFixed = heroData.totalPending;
  const cfVariable = Math.max(0, cfExpenses - cfFixed);
  const cfRemaining = cfIncome - cfExpenses;

  // Map data for mobile dashboard
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
        <MobileDashboard
          heroData={mobileHeroData}
          upcomingPayments={mobileUpcomingPayments}
          recentTransactions={mobileRecentTx}
          burnRateData={burnRateData}
        />
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

            {/* ── Hero Section — always visible, no collapse ── */}
            <DashboardHero data={heroData} />
            {/* CashFlowHeroStrip — shows income → fixed → variable → remaining */}
            <WidgetSlot widgetId="hero-flow-strip">
              <CashFlowHeroStrip
                income={cfIncome}
                fixedExpenses={cfFixed}
                variableExpenses={cfVariable}
                remaining={cfRemaining}
                currency={currency}
              />
            </WidgetSlot>

            {/* ── Niveles Section ── */}
            <DashboardSection title="Tus niveles" section="niveles" defaultOpen={true} showToggle={false}>
              <WidgetSlot widgetId="health-meters">
                <HealthMetersCard data={healthMetersData} />
              </WidgetSlot>
            </DashboardSection>

            {/* ── Flujo de Caja Section ── */}
            <DashboardSection title="Flujo de caja" section="flujo">
              {/* WaterfallChart — income → category deductions → net remaining */}
              <WidgetSlot widgetId="waterfall">
                <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
                  <FlujoWaterfall month={month} currency={currency} />
                </Suspense>
              </WidgetSlot>

              {/* BurnRateCard — temporary, will be replaced or deprecated by HealthMetersCard */}
              <WidgetSlot widgetId="burn-rate">
                {burnRateData ? (
                  <BurnRateCard data={burnRateData} />
                ) : (
                  <BurnRateCardEmpty />
                )}
              </WidgetSlot>

              {/* CashFlowViewToggle — line/bar view of 6-month income vs expenses trend */}
              <WidgetSlot widgetId="cashflow-trend">
                <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
                  <FlujoCharts month={month} currency={currency} monthLabel={monthLabel} />
                </Suspense>
              </WidgetSlot>
            </DashboardSection>

            {/* ── Presupuesto Section ── */}
            <Suspense
              fallback={
                <DashboardSection title="Presupuesto" section="presupuesto">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="h-64 rounded-xl bg-muted animate-pulse" />
                    <div className="h-64 rounded-xl bg-muted animate-pulse" />
                  </div>
                </DashboardSection>
              }
            >
              <PresupuestoSection month={month} currency={currency} monthLabel={monthLabel} />
            </Suspense>

            {/* ── Patrimonio y Deuda Section ── */}
            <DashboardSection title="Patrimonio y deuda" section="patrimonio">
              {/* Placeholder: DebtFreeCountdown (Task 17) */}
              <WidgetSlot widgetId="debt-countdown">
                <WidgetPlaceholder label="DebtFreeCountdown" />
              </WidgetSlot>
              {/* Placeholder: DebtProgressWidget (Task 18) */}
              <WidgetSlot widgetId="debt-progress">
                <WidgetPlaceholder label="DebtProgressWidget" />
              </WidgetSlot>
              {/* Placeholder: NetWorthHistoryChart (optional, Task 19) */}
              <WidgetSlot widgetId="net-worth">
                <WidgetPlaceholder label="NetWorthHistoryChart" />
              </WidgetSlot>
            </DashboardSection>

            {/* ── Actividad Section ── */}
            <DashboardSection title="Actividad" section="actividad">
              <WidgetSlot widgetId="upcoming-payments">
                <UpcomingPayments
                  obligations={heroData.pendingObligations}
                  totalPending={heroData.totalPending}
                />
              </WidgetSlot>

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

              {/* Recent Transactions */}
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

              {/* Placeholder: SpendingHeatmap (optional, Task 20) */}
              <WidgetSlot widgetId="spending-heatmap">
                <WidgetPlaceholder label="SpendingHeatmap" />
              </WidgetSlot>
            </DashboardSection>
          </div>
        </DashboardConfigProvider>
      </div>
    </>
  );
}

/** Async sub-component for WaterfallChart — wrapped in Suspense */
async function FlujoWaterfall({
  month,
  currency,
}: {
  month: string | undefined;
  currency: CurrencyCode;
}) {
  const [cashflowData, categoryData] = await Promise.all([
    getMonthlyCashflow(month, currency),
    getCategorySpending(month, currency),
  ]);

  const current = cashflowData[cashflowData.length - 1];
  const income = current?.income ?? 0;
  const net = current?.net ?? 0;
  const categories = categoryData.map((c) => ({ name: c.name, amount: c.amount }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Flujo del mes</CardTitle>
        <p className="text-xs text-muted-foreground">Ingresos → Gastos → Neto</p>
      </CardHeader>
      <CardContent>
        <WaterfallChart income={income} categories={categories} net={net} currency={currency} />
      </CardContent>
    </Card>
  );
}

/** Async sub-component for Flujo de Caja charts — wrapped in Suspense */
async function FlujoCharts({
  month,
  currency,
  monthLabel,
}: {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
}) {
  const cashflowData = await getMonthlyCashflow(month, currency);

  return <CashFlowViewToggle data={cashflowData} monthLabel={monthLabel} />;
}

/** Async sub-component for Presupuesto section — wrapped in Suspense */
async function PresupuestoSection({
  month,
  currency,
  monthLabel,
}: {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
}) {
  const [budgetPaceData, categoryData] = await Promise.all([
    getDailyBudgetPace(month, currency),
    getCategorySpending(month, currency),
  ]);

  return (
    <DashboardSection title="Presupuesto" section="presupuesto">
      <WidgetSlot widgetId="budget-pulse">
        <BudgetPaceChart
          data={budgetPaceData.data}
          totalBudget={budgetPaceData.totalBudget}
          totalSpent={budgetPaceData.totalSpent}
          monthLabel={monthLabel}
        />
      </WidgetSlot>

      {/* Placeholder: AllocationBars5030 (Task 15) */}
      <WidgetSlot widgetId="allocation-5030">
        <WidgetPlaceholder label="AllocationBars5030" />
      </WidgetSlot>

      {/* CategoryDonut — top spending categories as donut with legend */}
      <WidgetSlot widgetId="category-donut">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={categoryData} currency={currency} />
          </CardContent>
        </Card>
      </WidgetSlot>

      <WidgetSlot widgetId="budget-bar">
        <DashboardBudgetBar data={categoryData} monthLabel={monthLabel} />
      </WidgetSlot>
    </DashboardSection>
  );
}
