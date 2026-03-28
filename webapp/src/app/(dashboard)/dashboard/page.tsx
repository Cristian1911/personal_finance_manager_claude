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
  CalendarClock,
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
import dynamic from "next/dynamic";
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
import { MobileDashboard } from "@/components/mobile/mobile-dashboard";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
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
import {
  AccountsSkeleton,
  HeatmapSkeleton,
  MobileBurnRateSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import type { HealthMetersData } from "@/actions/health-meters";
import type { AllocationData } from "@/actions/allocation";
import type { DebtCountdownData } from "@/actions/debt-countdown";

// ── Dynamic imports — used by mobile burn rate section ───────────────────────

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
        .select("*, categories!category_id(name_es, name)")
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
  const [heroData, healthMetersData, allocationData, debtCountdownData] = await Promise.all([
    getDashboardHeroData(month, currency),
    getHealthMeters(currency, month),
    get503020Allocation(month, currency),
    getDebtFreeCountdown(currency),
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

  const desktopAttention = heroData.pendingObligations.length > 0
    ? {
        eyebrow: "Atención hoy",
        title: `${heroData.pendingObligations.length} ${heroData.pendingObligations.length === 1 ? "frente abierto" : "frentes abiertos"} que pueden mover tu margen`,
        body: `Hay ${heroData.pendingObligations.length} ${heroData.pendingObligations.length === 1 ? "pago pendiente" : "pagos pendientes"} por ${formatCurrency(heroData.totalPending, currency)}. Revísalos antes de comprometer más gasto este mes.`,
        href: "/recurrentes",
        cta: "Revisar pagos",
      }
    : heroData.freshness !== "fresh"
      ? {
          eyebrow: "Mantener al día",
          title: "Tu base necesita una revisión corta antes de decidir",
          body: "Actualiza saldos o importa un extracto para que el resto del dashboard vuelva a representar tu margen real.",
          href: "#quick-update-values",
          cta: "Actualizar valores",
        }
      : {
          eyebrow: "Siguiente paso",
          title: "Tu foto está estable y lista para decidir",
          body: "Usa este momento para revisar movimientos recientes, ajustar presupuesto o cerrar tareas operativas desde Más.",
          href: "/transactions",
          cta: "Ver movimientos",
        };

  return (
    <>
      {/* Mobile dashboard */}
      <div className="lg:hidden">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Inicio
              </p>
              <div>
                <h1 className="text-2xl font-semibold">Tu estado financiero de hoy</h1>
                <p className="text-sm text-muted-foreground">
                  Claridad para decidir sin perderte entre métricas
                </p>
              </div>
            </div>
            <div className="rounded-full border border-white/6 bg-z-surface-2 px-3 py-1 text-xs text-muted-foreground">
              {monthLabel}
            </div>
          </div>
          {/* Tier 1: hero + health (renders immediately) */}
          <MobileDashboard
            heroData={mobileHeroData}
            upcomingPayments={mobileUpcomingPayments}
            recentTransactions={mobileRecentTx}
            quickUpdateAccounts={quickUpdateAccounts}
            healthMetersData={healthMetersData}
          />
          {/* Tier 2: burn rate, allocation, debt (streams in) */}
          <Suspense fallback={<MobileBurnRateSkeleton />}>
            <MobileBurnRateSection currency={currency} />
          </Suspense>
          <PlanTeaserCard
            allocationData={allocationData}
            debtCountdownData={debtCountdownData}
            currency={currency}
            monthLabel={monthLabel}
            variant="mobile"
          />
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

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
              <div className="space-y-6">
                {/* ── Hero Section — tier 1: always visible, no collapse ── */}
                <DashboardHero
                  data={heroData}
                  allocationData={allocationData}
                  debtFreeBanner={<DebtFreeBanner data={debtCountdownData} />}
                />
              </div>

              <div className="space-y-4">
                <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <CardHeader className="space-y-2 pb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                      {desktopAttention.eyebrow}
                    </p>
                    <CardTitle className="text-xl leading-tight">
                      {desktopAttention.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {desktopAttention.body}
                    </p>
                    <Button
                      asChild
                      className="w-full justify-between bg-z-brass text-z-ink hover:bg-z-brass/90"
                    >
                      <Link href={desktopAttention.href}>
                        {desktopAttention.cta}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <WidgetSlot widgetId="upcoming-payments">
                  <UpcomingPayments
                    obligations={heroData.pendingObligations}
                    totalPending={heroData.totalPending}
                  />
                </WidgetSlot>

                <QuickValueUpdates accounts={quickUpdateAccounts} id="quick-update-values" />
              </div>
            </div>

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
