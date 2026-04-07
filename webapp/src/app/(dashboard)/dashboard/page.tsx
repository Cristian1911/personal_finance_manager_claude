// ci: trigger verify-webapp job
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
} from "@/actions/charts";

import { getAccounts } from "@/actions/accounts";
import { getDashboardConfigWithPurpose } from "@/actions/dashboard-config";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DebtFreeBanner } from "@/components/dashboard/debt-free-banner";
import {
  AccountsOverview,
  QuickValueUpdates,
  type QuickValueUpdateAccount,
} from "@/components/dashboard/accounts-overview";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import { DashboardAccountPicker } from "@/components/dashboard/dashboard-account-picker";
import { MonthSelector } from "@/components/month-selector";
import { trackProductEvent } from "@/actions/product-events";
import { InicioRoot } from "@/components/mobile/v2/inicio/inicio-root";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { getBudgetSummary } from "@/actions/budgets";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { AttentionCard } from "@/components/ui/attention-card";
import { getAttentionSnapshot } from "@/actions/attention";
import { getAttentionItems } from "@/actions/attention-items";
import { getRecentImpactEvents } from "@/actions/impact-events";
import { RecentImpactsWidget } from "@/components/impact/recent-impacts-widget";
import { getLatestSnapshotDates } from "@/actions/statement-snapshots";
import { getBurnRate } from "@/actions/burn-rate";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DashboardConfigProvider } from "@/components/dashboard/dashboard-config-provider";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { HealthScoreSection } from "@/components/dashboard/health-score-section";
import { getHealthMeters } from "@/actions/health-meters";
import { get503020Allocation } from "@/actions/allocation";
import { getDebtFreeCountdown } from "@/actions/debt-countdown";
import { FlujoSection } from "@/components/dashboard/flujo-section";
import { PlanTeaserCard } from "@/components/dashboard/plan-teaser-card";
import { ActividadHeatmap } from "@/components/dashboard/actividad-heatmap";
import { getReminders } from "@/actions/reminders";
import { PendientesWidget } from "@/components/reminders/pendientes-widget";
import { getWishlistItemsForDashboard, getActiveNudges as getWishlistNudges } from "@/actions/wishlist";
import { DeseosWidget } from "@/components/dashboard/deseos-widget";
import {
  AccountsSkeleton,
  HeatmapSkeleton,

} from "@/components/dashboard/dashboard-skeletons";
import type { HealthMetersData } from "@/actions/health-meters";
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

  // Fetch currency + transactions + cached accounts + dashboard config in parallel
  const [preferredCurrency, { data: recentTransactions }, allAccountsResult, dashboardConfigData] =
    await Promise.all([
      getPreferredCurrency(),
      supabase
        .from("transactions")
        .select("id, amount, direction, account_id, merchant_name, clean_description, transaction_date, currency_code, categories!category_id(name_es, name)")
        .eq("is_excluded", false)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5)
        .is("reconciled_into_transaction_id", null),
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
            <h1 className="text-2xl font-bold">Inicio</h1>
            <p className="text-muted-foreground">Tu base ya está lista. Falta activar tu flujo.</p>
          </div>
        </div>

        <Card className="border-z-brass/20 bg-[linear-gradient(180deg,rgba(63,70,50,0.18),rgba(18,20,18,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-z-brass" />
              Primeros pasos recomendados
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Link
              href="/import"
              className="rounded-lg border border-white/6 bg-card/70 p-4 transition-colors hover:bg-white/5"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileUp className="h-4 w-4 text-z-brass" />
                Importar extracto PDF
              </div>
              <p className="text-sm text-muted-foreground">
                Carga tus movimientos reales para activar métricas, categorías y alertas.
              </p>
            </Link>
            <Link
              href="/transactions"
              className="rounded-lg border border-white/6 bg-card/70 p-4 transition-colors hover:bg-white/5"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <WalletCards className="h-4 w-4 text-z-brass" />
                Registrar primer movimiento
              </div>
              <p className="text-sm text-muted-foreground">
                Si aún no tienes PDF, crea movimientos manuales para empezar.
              </p>
            </Link>
            <Link
              href="/categorizar"
              className="rounded-lg border border-white/6 bg-card/70 p-4 transition-colors hover:bg-white/5"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Tags className="h-4 w-4 text-z-brass" />
                Definir categorías base
              </div>
              <p className="text-sm text-muted-foreground">
                Etiqueta tus primeras compras para entrenar sugerencias automáticas.
              </p>
            </Link>
            <Link
              href="/categories"
              className="rounded-lg border border-white/6 bg-card/70 p-4 transition-colors hover:bg-white/5"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Landmark className="h-4 w-4 text-z-brass" />
                Crear presupuesto mensual
              </div>
              <p className="text-sm text-muted-foreground">
                Establece límites desde el inicio para detectar desvíos temprano.
              </p>
            </Link>
          </CardContent>
          <CardContent className="pt-0">
            <Link href="/import">
              <Button className="gap-2 bg-z-brass text-z-ink hover:bg-z-brass/90">
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
  const [heroData, healthMetersData, allocationData, debtCountdownData, attentionSnapshot, attentionItemsData, impactEvents, pendingReminders, completedReminders, wishlistDashboard, wishlistNudges, budgetSummary, categoryBudgetResult, burnRateData] = await Promise.all([
    getDashboardHeroData(month, currency),
    getHealthMeters(currency, month),
    get503020Allocation(month, currency),
    getDebtFreeCountdown(currency),
    getAttentionSnapshot(),
    getAttentionItems(),
    getRecentImpactEvents(3),
    getReminders("pending"),
    getReminders("completed"),
    getWishlistItemsForDashboard(),
    getWishlistNudges(),
    getBudgetSummary(month),
    getCategoriesWithBudgetData(month, currency),
    getBurnRate(currency),
  ]);

  const recentCompletedReminders = completedReminders.slice(0, 10);
  const mobileRecentTx = recentTx.map((tx) => ({
    id: tx.id,
    description: tx.merchant_name || tx.clean_description || "Sin descripción",
    amount: tx.amount,
    currency_code: tx.currency_code ?? "COP",
    direction: tx.direction,
  }));

  const mobileLiquidAccounts = allAccounts
    .filter((account) => account.account_type === "CHECKING" || account.account_type === "SAVINGS")
    .map((account) => ({
      id: account.id,
      name: account.name,
      currentBalance: account.current_balance ?? 0,
      currencyCode: account.currency_code as CurrencyCode,
    }));

  const mobileFixedExpenses = heroData.pendingObligations.map((obligation) => ({
    id: obligation.id,
    name: obligation.name,
    amount: obligation.amount,
    currencyCode: obligation.currency_code as CurrencyCode,
  }));

  const firstPayment = heroData.pendingObligations[0];
  const mobileNextPayment = firstPayment
    ? {
        name: firstPayment.name,
        amount: firstPayment.amount,
        dueDate: firstPayment.due_date,
        currencyCode: firstPayment.currency_code as CurrencyCode,
      }
    : null;

  const daysToNextPayment = firstPayment
    ? Math.ceil(
        (new Date(firstPayment.due_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const mobileTotalSpent =
    heroData.totalLiquid - heroData.totalPending - heroData.availableToSpend;

  const categoryBudgetData = categoryBudgetResult.success
    ? categoryBudgetResult.data
    : [];
  const mobileTopCategories = categoryBudgetData
    .filter((category) => category.budget && category.budget > 0 && category.direction === "OUTFLOW")
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, 3)
    .map((category) => ({
      name: category.name_es ?? category.name,
      percentUsed: category.percentUsed,
    }));

  const mobileUpcomingPaymentsV2 = heroData.pendingObligations
    .slice(0, 5)
    .map((obligation) => ({
      id: obligation.id,
      name: obligation.name,
      dueDate: obligation.due_date,
      amount: obligation.amount,
      currencyCode: obligation.currency_code,
    }));

  const quickUpdateAccounts: QuickValueUpdateAccount[] = allAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    accountType: account.account_type,
    currentBalance: account.current_balance ?? 0,
    currencyBalances: account.currency_balances,
    currencyCode: account.currency_code,
    displayOrder: account.display_order,
  }));

  // Subtitles for sections computed from tier 1 data
  const accountsSubtitle = allAccounts.length > 0
    ? `${allAccounts.length} ${allAccounts.length === 1 ? "cuenta activa" : "cuentas activas"}`
    : "Agrega una cuenta para comenzar";

  const heatmapSubtitle = recentTx.length > 0
    ? "Actividad de los últimos meses"
    : "Sin transacciones registradas";


  return (
    <>
      <div className="lg:hidden">
        <MobileHeader variant="main" title="Zeta" />
          <InicioRoot
            hero={{
              availablePerDay: (() => {
                const now = new Date();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const daysRemaining = Math.max(daysInMonth - now.getDate(), 1);
                return heroData.availableToSpend / daysRemaining;
              })(),
              availableTotal: heroData.availableToSpend,
              daysRemaining: (() => {
                const now = new Date();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                return Math.max(daysInMonth - now.getDate(), 1);
              })(),
              currency: currency as CurrencyCode,
              breakdown: {
                totalLiquid: heroData.totalLiquid,
                fixedExpenses: heroData.totalPending,
                alreadySpent: mobileTotalSpent,
              },
              primaryAccount: (() => {
                const primary = allAccounts.find(
                  (a) =>
                    (a.account_type === "SAVINGS" || a.account_type === "CHECKING") &&
                    a.show_in_dashboard
                ) ?? allAccounts.find(
                  (a) => a.account_type === "SAVINGS" || a.account_type === "CHECKING"
                );
                if (!primary) return undefined;
                return {
                  id: primary.id,
                  name: primary.name,
                  currentBalance: primary.current_balance ?? 0,
                  currencyCode: primary.currency_code as CurrencyCode,
                };
              })(),
            }}
            metrics={{
              runwayDays: burnRateData?.discretionary.runwayDays ?? 0,
              daysInMonth: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
              dayOfMonth: new Date().getDate(),
              nextPaymentName: heroData.pendingObligations[0]?.name ?? null,
              nextPaymentDays: heroData.pendingObligations[0]
                ? Math.max(0, Math.ceil((new Date(heroData.pendingObligations[0].due_date).getTime() - Date.now()) / 86_400_000))
                : null,
              nextPaymentAmount: heroData.pendingObligations[0]?.amount ?? null,
              currency: currency as CurrencyCode,
            }}
            attentionItems={attentionItemsData}
            burnRateData={burnRateData}
            totalBudget={budgetSummary.totalTarget}
            recentTransactions={mobileRecentTx}
            currency={currency as CurrencyCode}
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                  Inicio
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">Tu estado financiero de hoy</h1>
                <p className="text-muted-foreground">
                  {monthLabel} · claridad para decidir sin perderte entre métricas
                </p>
              </div>
              <Suspense fallback={<div className="h-9 w-36 rounded-md bg-muted animate-pulse" />}>
                <MonthSelector />
              </Suspense>
            </div>

            {/* ── Hero + Attention — 2/3 hero, 1/3 attention ── */}
            <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
              <DashboardHero
                data={heroData}
                allocationData={allocationData}
                debtFreeBanner={<DebtFreeBanner data={debtCountdownData} />}
              />
              <AttentionCard signals={attentionSnapshot.signals} className="h-fit" />
            </div>

            {/* ── Action strip — balanced columns below hero ── */}
            <div className="grid gap-4 xl:grid-cols-2">
              <WidgetSlot widgetId="upcoming-payments">
                <UpcomingPayments
                  obligations={heroData.pendingObligations}
                  totalPending={heroData.totalPending}
                />
              </WidgetSlot>

              <QuickValueUpdates accounts={quickUpdateAccounts} id="quick-update-values" />
            </div>

            {/* ── Impact + Pendientes ── */}
            <div className="grid gap-4 xl:grid-cols-2">
              <RecentImpactsWidget events={impactEvents} />
              <PendientesWidget reminders={pendingReminders} completedReminders={recentCompletedReminders} />
            </div>

            {/* ── Deseos ── */}
            <DeseosWidget
              items={wishlistDashboard.items}
              totalCount={wishlistDashboard.totalCount}
              readyCount={wishlistDashboard.readyCount}
              nudge={wishlistNudges[0] ?? null}
            />

            {/* ── 2. Health Score — tier 1, primary tier (no section wrapper) ── */}
            <WidgetSlot widgetId="health-score">
              <HealthScoreSection data={healthMetersData} />
            </WidgetSlot>

            {/* ── 3. Cash Flow — tier 2, wrapped in FlujoSection for subtitle ── */}
            <Suspense
              fallback={
                <DashboardSection title="Flujo de caja" section="flujo">
                  <div className="h-[240px] w-full rounded-xl bg-muted animate-pulse" />
                </DashboardSection>
              }
            >
              <FlujoSection month={month} currency={currency} monthLabel={monthLabel} />
            </Suspense>

            <PlanTeaserCard
              allocationData={allocationData}
              debtCountdownData={debtCountdownData}
              currency={currency}
              monthLabel={monthLabel}
            />

            {/* ── 5. Activity Heatmap — tier 2 ── */}
            <DashboardSection title="Actividad" section="actividad" subtitle={heatmapSubtitle}>
              <WidgetSlot widgetId="spending-heatmap">
                <Suspense fallback={<HeatmapSkeleton />}>
                  <ActividadHeatmap month={month} currency={currency} />
                </Suspense>
              </WidgetSlot>
            </DashboardSection>

            {/* ── 6. Accounts — mixed tier 1 + tier 2 ── */}
            <DashboardSection title="Cuentas" section="cuentas" subtitle={accountsSubtitle}>
              <Suspense fallback={<AccountsSkeleton />}>
                <AccountsSection allAccounts={allAccounts} />
              </Suspense>

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
            </DashboardSection>
          </div>
        </DashboardConfigProvider>
      </div>
    </>
  );
}

// Re-export HealthMetersData type used by sub-components that receive it as prop
export type { HealthMetersData };
