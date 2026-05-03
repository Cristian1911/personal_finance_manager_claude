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
import { getAccountsWithSparklineData } from "@/actions/charts";
import { getAccounts } from "@/actions/accounts";
import { getRecentTransactions } from "@/actions/transactions";
import { getDashboardConfigWithPurpose } from "@/actions/dashboard-config";
import {
  AccountsOverview,
} from "@/components/dashboard/accounts-overview";
import { DashboardAccountPicker } from "@/components/dashboard/dashboard-account-picker";
import { MonthSelector } from "@/components/month-selector";
import { trackProductEvent } from "@/actions/product-events";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { getLatestSnapshotDates } from "@/actions/statement-snapshots";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DashboardConfigProvider } from "@/components/dashboard/dashboard-config-provider";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { FlujoSection } from "@/components/dashboard/flujo-section";
import { ActividadHeatmap } from "@/components/dashboard/actividad-heatmap";
import {
  AccountsSkeleton,
  HeatmapSkeleton,
  HealthScoreSkeleton,
  HeroZoneSkeleton,
  WidgetsZoneSkeleton,
  MobileZoneSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { HeroZone } from "@/components/dashboard/zones/hero-zone";
import { WidgetsZone } from "@/components/dashboard/zones/widgets-zone";
import { HealthZone } from "@/components/dashboard/zones/health-zone";
import { MobileZone } from "@/components/dashboard/zones/mobile-zone";
import type { HealthMetersData } from "@/actions/health-meters";

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

  const { user } = await getAuthenticatedClient();

  if (!user) return null;

  // Shell fetches — all cached, ~0ms on cache hit
  const [preferredCurrency, allAccountsResult, dashboardConfigData, recentTx] =
    await Promise.all([
      getPreferredCurrency(),
      getAccounts(),
      getDashboardConfigWithPurpose(),
      getRecentTransactions(),
    ]);

  const allAccounts = allAccountsResult.success ? allAccountsResult.data : [];

  // Resolve currency from cached accounts — no extra DB queries
  let currency = preferredCurrency;
  const hasCurrencyAccounts = allAccounts.some(a => a.currency_code === preferredCurrency);
  if (!hasCurrencyAccounts && allAccounts.length > 0) {
    currency = allAccounts[0].currency_code as CurrencyCode;
  }
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

  // Subtitles for sections computed from shell data
  const accountsSubtitle = allAccounts.length > 0
    ? `${allAccounts.length} ${allAccounts.length === 1 ? "cuenta activa" : "cuentas activas"}`
    : "Agrega una cuenta para comenzar";

  const heatmapSubtitle = recentTx.length > 0
    ? "Actividad de los últimos meses"
    : "Sin transacciones registradas";

  return (
    <>
      {/* Mobile dashboard — CSS handles visibility, both zones always render */}
      <div className="lg:hidden">
        <div className="mx-auto w-full max-w-md">
          <Suspense fallback={<MobileZoneSkeleton />}>
            <MobileZone month={month} currency={currency as CurrencyCode} recentTx={recentTx} />
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

            {/* ── Hero + Attention + Action strip + Plan teaser ── */}
            <Suspense fallback={<HeroZoneSkeleton />}>
              <HeroZone month={month} currency={currency as CurrencyCode} monthLabel={monthLabel} />
            </Suspense>

            {/* ── Impact + Pendientes + Deseos ── */}
            <Suspense fallback={<WidgetsZoneSkeleton />}>
              <WidgetsZone />
            </Suspense>

            {/* ── Health Score ── */}
            <Suspense fallback={<HealthScoreSkeleton />}>
              <HealthZone currency={currency as CurrencyCode} month={month} />
            </Suspense>

            {/* ── Cash Flow — tier 2, wrapped in FlujoSection for subtitle ── */}
            <Suspense
              fallback={
                <DashboardSection title="Flujo de caja" section="flujo">
                  <div className="h-[240px] w-full rounded-xl bg-muted animate-pulse" />
                </DashboardSection>
              }
            >
              <FlujoSection month={month} currency={currency} monthLabel={monthLabel} />
            </Suspense>

            {/* ── Activity Heatmap — tier 2 ── */}
            <DashboardSection title="Actividad" section="actividad" subtitle={heatmapSubtitle}>
              <WidgetSlot widgetId="spending-heatmap">
                <Suspense fallback={<HeatmapSkeleton />}>
                  <ActividadHeatmap month={month} currency={currency} />
                </Suspense>
              </WidgetSlot>
            </DashboardSection>

            {/* ── Accounts — mixed tier 1 + tier 2 ── */}
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
