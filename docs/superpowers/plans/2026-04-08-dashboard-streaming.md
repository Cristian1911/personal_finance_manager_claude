# Streaming Zones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the dashboard and plan pages' monolithic `Promise.all` fetches into Suspense-wrapped async zones that stream independently, so page shells render near-instantly while data-heavy sections load progressively.

**Architecture:** Each page becomes a thin shell that fetches only routing-critical data. New async server components ("zones") each fetch their own data and stream via `<Suspense>`. Mobile and desktop get separate zones so they stream independently. All queries use `"use cache"`, so any "duplicate" calls between zones cost ~0ms (cache hits).

**Tech Stack:** Next.js 15 App Router streaming, React Suspense, existing cached server actions. No new dependencies.

**Scope:** Dashboard (14 blocked queries → 4 zones) + Plan/resumen (3 blocked queries → 2 zones). Categorizar was evaluated but skipped — all 6 queries feed both stats and inbox (can't render one without the other), and `dynamic()` imports already lazy-load the inbox JS.

**Current problems:**
- **Dashboard:** 14-query `Promise.all` — nothing renders until all resolve (~200ms+)
- **Plan/resumen:** 3 heavy queries (`getPlanPageData`, `getCategoriesByRhythm`, `getPlanTimelineData`) block all section rendering

**After:** Page shells render immediately with skeletons. Hero zones stream first (~50ms). Secondary sections stream as their data resolves.

---

## File Structure

### New Files — Dashboard
- `webapp/src/components/dashboard/zones/hero-zone.tsx` — Async server component: hero + attention + action strip + plan teaser
- `webapp/src/components/dashboard/zones/widgets-zone.tsx` — Async server component: impact events + reminders + wishlist
- `webapp/src/components/dashboard/zones/health-zone.tsx` — Async server component: health score meters
- `webapp/src/components/dashboard/zones/mobile-zone.tsx` — Async server component: full mobile dashboard (InicioRoot)

### New Files — Plan
- `webapp/src/components/plan/zones/plan-resumen-zone.tsx` — Async server component: hero + budget/debt grid + scenarios (desktop)
- `webapp/src/components/plan/zones/plan-mobile-zone.tsx` — Async server component: mobile PlanRoot with timeline

### Modified Files
- `webapp/src/app/(dashboard)/dashboard/page.tsx` — Strip mega Promise.all, replace with Suspense-wrapped zones
- `webapp/src/app/(dashboard)/plan/page.tsx` — Move resumen content to streamed zones
- `webapp/src/components/dashboard/dashboard-skeletons.tsx` — Add HeroZoneSkeleton, WidgetsZoneSkeleton, MobileZoneSkeleton

---

## Data Dependency Graph

```
SHELL (page.tsx — renders immediately):
  getPreferredCurrency() → currency
  getAccounts() → allAccounts
  getDashboardConfigWithPurpose() → config
  recentTransactionsQuery → recentTx
  
  Renders: Header, MonthSelector, StarterMode check, RecentTx card

HERO ZONE (priority 1 — streams first):
  getDashboardHeroData(month, currency) → heroData
  get503020Allocation(month, currency) → allocationData
  getDebtFreeCountdown(currency) → debtCountdownData
  getAttentionSnapshot() → attentionSnapshot
  
  Renders: DashboardHero, AttentionCard, UpcomingPayments, QuickValueUpdates, PlanTeaserCard

WIDGETS ZONE (independent):
  getRecentImpactEvents(3) → impactEvents
  getReminders("pending") → pendingReminders
  getReminders("completed") → completedReminders
  getWishlistItemsForDashboard() → wishlistDashboard
  getWishlistNudges() → wishlistNudges
  
  Renders: RecentImpactsWidget, PendientesWidget, DeseosWidget

HEALTH ZONE (independent):
  getHealthMeters(currency, month) → healthMetersData
  
  Renders: HealthScoreSection (wrapped in WidgetSlot)

MOBILE ZONE (independent, renders on <1024px):
  getDashboardHeroData(month, currency)
  getBurnRate(currency)
  getAttentionItems()
  getBudgetSummary(month)
  getCategoriesWithBudgetData(month, currency)
  
  Renders: MobileHeader + InicioRoot

ALREADY SUSPENSED (no changes):
  FlujoSection, ActividadHeatmap, AccountsSection
```

---

### Task 1: Add zone skeleton components

**Files:**
- Modify: `webapp/src/components/dashboard/dashboard-skeletons.tsx`

- [ ] **Step 1: Add HeroZoneSkeleton, WidgetsZoneSkeleton, and MobileZoneSkeleton**

Append to `webapp/src/components/dashboard/dashboard-skeletons.tsx`:

```tsx
/** Hero zone — hero card + attention + action strip placeholder */
export function HeroZoneSkeleton() {
  return (
    <div className="space-y-4">
      {/* Hero + Attention 2-col grid */}
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="h-[280px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="h-[280px] rounded-xl bg-z-surface-2 animate-pulse" />
      </div>
      {/* Action strip 2-col grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-[200px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="h-[200px] rounded-xl bg-z-surface-2 animate-pulse" />
      </div>
    </div>
  );
}

/** Widgets zone — impact + pendientes + deseos placeholder */
export function WidgetsZoneSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-[180px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="h-[180px] rounded-xl bg-z-surface-2 animate-pulse" />
      </div>
      <div className="h-[140px] rounded-xl bg-z-surface-2 animate-pulse" />
    </div>
  );
}

/** Mobile dashboard — full screen placeholder */
export function MobileZoneSkeleton() {
  return (
    <div className="space-y-4 px-1">
      <div className="h-[200px] rounded-2xl bg-z-surface-2 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[80px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="h-[80px] rounded-xl bg-z-surface-2 animate-pulse" />
      </div>
      <div className="h-[120px] rounded-xl bg-z-surface-2 animate-pulse" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/dashboard/dashboard-skeletons.tsx
git commit -m "feat: add zone skeleton components for dashboard streaming"
```

---

### Task 2: Create HeroZone async component

**Files:**
- Create: `webapp/src/components/dashboard/zones/hero-zone.tsx`

This is the highest-priority zone — it answers "Am I on track?" and should stream first.

- [ ] **Step 1: Create the hero zone component**

```tsx
// webapp/src/components/dashboard/zones/hero-zone.tsx
import { getDashboardHeroData } from "@/actions/charts";
import { get503020Allocation } from "@/actions/allocation";
import { getDebtFreeCountdown } from "@/actions/debt-countdown";
import { getAttentionSnapshot } from "@/actions/attention";
import { getAccounts } from "@/actions/accounts";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DebtFreeBanner } from "@/components/dashboard/debt-free-banner";
import { AttentionCard } from "@/components/ui/attention-card";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import {
  QuickValueUpdates,
  type QuickValueUpdateAccount,
} from "@/components/dashboard/accounts-overview";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { PlanTeaserCard } from "@/components/dashboard/plan-teaser-card";
import type { CurrencyCode } from "@/types/domain";

interface HeroZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
}

export async function HeroZone({ month, currency, monthLabel }: HeroZoneProps) {
  const [heroData, allocationData, debtCountdownData, attentionSnapshot, accountsResult] =
    await Promise.all([
      getDashboardHeroData(month, currency),
      get503020Allocation(month, currency),
      getDebtFreeCountdown(currency),
      getAttentionSnapshot(),
      getAccounts(),
    ]);

  const allAccounts = accountsResult.success ? accountsResult.data : [];

  const quickUpdateAccounts: QuickValueUpdateAccount[] = allAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    accountType: account.account_type,
    currentBalance: account.current_balance ?? 0,
    currencyBalances: account.currency_balances,
    currencyCode: account.currency_code,
    displayOrder: account.display_order,
  }));

  return (
    <>
      {/* Hero + Attention — 2/3 hero, 1/3 attention */}
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <DashboardHero
          data={heroData}
          allocationData={allocationData}
          debtFreeBanner={<DebtFreeBanner data={debtCountdownData} />}
        />
        <AttentionCard signals={attentionSnapshot.signals} className="h-fit" />
      </div>

      {/* Action strip — balanced columns below hero */}
      <div className="grid gap-4 xl:grid-cols-2">
        <WidgetSlot widgetId="upcoming-payments">
          <UpcomingPayments
            obligations={heroData.pendingObligations}
            totalPending={heroData.totalPending}
          />
        </WidgetSlot>

        <QuickValueUpdates accounts={quickUpdateAccounts} id="quick-update-values" />
      </div>

      <PlanTeaserCard
        allocationData={allocationData}
        debtCountdownData={debtCountdownData}
        currency={currency}
        monthLabel={monthLabel}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/dashboard/zones/hero-zone.tsx
git commit -m "feat: extract HeroZone async component for dashboard streaming"
```

---

### Task 3: Create WidgetsZone async component

**Files:**
- Create: `webapp/src/components/dashboard/zones/widgets-zone.tsx`

- [ ] **Step 1: Create the widgets zone component**

```tsx
// webapp/src/components/dashboard/zones/widgets-zone.tsx
import { getRecentImpactEvents } from "@/actions/impact-events";
import { getReminders } from "@/actions/reminders";
import {
  getWishlistItemsForDashboard,
  getActiveNudges as getWishlistNudges,
} from "@/actions/wishlist";
import { RecentImpactsWidget } from "@/components/impact/recent-impacts-widget";
import { PendientesWidget } from "@/components/reminders/pendientes-widget";
import { DeseosWidget } from "@/components/dashboard/deseos-widget";

export async function WidgetsZone() {
  const [impactEvents, pendingReminders, completedReminders, wishlistDashboard, wishlistNudges] =
    await Promise.all([
      getRecentImpactEvents(3),
      getReminders("pending"),
      getReminders("completed"),
      getWishlistItemsForDashboard(),
      getWishlistNudges(),
    ]);

  const recentCompletedReminders = completedReminders.slice(0, 10);

  return (
    <>
      {/* Impact + Pendientes */}
      <div className="grid gap-4 xl:grid-cols-2">
        <RecentImpactsWidget events={impactEvents} />
        <PendientesWidget
          reminders={pendingReminders}
          completedReminders={recentCompletedReminders}
        />
      </div>

      {/* Deseos */}
      <DeseosWidget
        items={wishlistDashboard.items}
        totalCount={wishlistDashboard.totalCount}
        readyCount={wishlistDashboard.readyCount}
        nudge={wishlistNudges[0] ?? null}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/dashboard/zones/widgets-zone.tsx
git commit -m "feat: extract WidgetsZone async component for dashboard streaming"
```

---

### Task 4: Create HealthZone async component

**Files:**
- Create: `webapp/src/components/dashboard/zones/health-zone.tsx`

- [ ] **Step 1: Create the health zone component**

```tsx
// webapp/src/components/dashboard/zones/health-zone.tsx
import { getHealthMeters } from "@/actions/health-meters";
import { HealthScoreSection } from "@/components/dashboard/health-score-section";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import type { CurrencyCode } from "@/types/domain";

interface HealthZoneProps {
  currency: CurrencyCode;
  month: string | undefined;
}

export async function HealthZone({ currency, month }: HealthZoneProps) {
  const healthMetersData = await getHealthMeters(currency, month);

  return (
    <WidgetSlot widgetId="health-score">
      <HealthScoreSection data={healthMetersData} />
    </WidgetSlot>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/dashboard/zones/health-zone.tsx
git commit -m "feat: extract HealthZone async component for dashboard streaming"
```

---

### Task 5: Create MobileZone async component

**Files:**
- Create: `webapp/src/components/dashboard/zones/mobile-zone.tsx`

This is the most complex zone — it computes several derived values from fetched data before passing to `InicioRoot`.

- [ ] **Step 1: Create the mobile zone component**

```tsx
// webapp/src/components/dashboard/zones/mobile-zone.tsx
import { getDashboardHeroData } from "@/actions/charts";
import { getAttentionItems } from "@/actions/attention-items";
import { getBurnRate } from "@/actions/burn-rate";
import { getBudgetSummary } from "@/actions/budgets";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getAccounts } from "@/actions/accounts";
import { InicioRoot } from "@/components/mobile/v2/inicio/inicio-root";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import type { CurrencyCode } from "@/types/domain";

interface MobileZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  recentTx: Array<{
    id: string;
    amount: number;
    direction: "INFLOW" | "OUTFLOW";
    merchant_name?: string | null;
    clean_description?: string | null;
    currency_code?: string;
  }>;
}

export async function MobileZone({ month, currency, recentTx }: MobileZoneProps) {
  const [heroData, attentionItemsData, burnRateData, budgetSummary, categoryBudgetResult, accountsResult] =
    await Promise.all([
      getDashboardHeroData(month, currency),
      getAttentionItems(),
      getBurnRate(currency),
      getBudgetSummary(month),
      getCategoriesWithBudgetData(month, currency),
      getAccounts(),
    ]);

  const allAccounts = accountsResult.success ? accountsResult.data : [];

  const mobileRecentTx = recentTx.map((tx) => ({
    id: tx.id,
    description: tx.merchant_name || tx.clean_description || "Sin descripción",
    amount: tx.amount,
    currency_code: tx.currency_code ?? "COP",
    direction: tx.direction,
  }));

  const mobileTotalSpent =
    heroData.totalLiquid - heroData.totalPending - heroData.availableToSpend;

  const categoryBudgetData = categoryBudgetResult.success
    ? categoryBudgetResult.data
    : [];

  return (
    <>
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
          currency,
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
          currency,
        }}
        attentionItems={attentionItemsData}
        burnRateData={burnRateData}
        totalBudget={budgetSummary.totalTarget}
        recentTransactions={mobileRecentTx}
        currency={currency}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/dashboard/zones/mobile-zone.tsx
git commit -m "feat: extract MobileZone async component for dashboard streaming"
```

---

### Task 6: Rewrite dashboard page to use Suspense zones

**Files:**
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

This is the core change. The page becomes a thin shell that renders skeletons + Suspense boundaries.

- [ ] **Step 1: Replace the imports section**

Remove imports that moved to zone components. Keep only what the shell needs. Replace the import block (lines 1-77) with:

```tsx
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
import { getAccounts } from "@/actions/accounts";
import { getDashboardConfigWithPurpose } from "@/actions/dashboard-config";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DashboardConfigProvider } from "@/components/dashboard/dashboard-config-provider";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { MonthSelector } from "@/components/month-selector";
import { trackProductEvent } from "@/actions/product-events";
import dynamic from "next/dynamic";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

// Zone components — each is an async server component with its own data fetching
import { HeroZone } from "@/components/dashboard/zones/hero-zone";
import { WidgetsZone } from "@/components/dashboard/zones/widgets-zone";
import { HealthZone } from "@/components/dashboard/zones/health-zone";
import { MobileZone } from "@/components/dashboard/zones/mobile-zone";

// Skeletons for streaming fallbacks
import {
  AccountsSkeleton,
  HeatmapSkeleton,
  HeroZoneSkeleton,
  WidgetsZoneSkeleton,
  HealthScoreSkeleton,
  MobileZoneSkeleton,
} from "@/components/dashboard/dashboard-skeletons";

// Tier 2 async components — already Suspensed
import {
  AccountsOverview,
  QuickValueUpdates,
  type QuickValueUpdateAccount,
} from "@/components/dashboard/accounts-overview";
import { DashboardAccountPicker } from "@/components/dashboard/dashboard-account-picker";
import { getAccountsWithSparklineData } from "@/actions/charts";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { getLatestSnapshotDates } from "@/actions/statement-snapshots";
import { FlujoSection } from "@/components/dashboard/flujo-section";
import { ActividadHeatmap } from "@/components/dashboard/actividad-heatmap";

import type { HealthMetersData } from "@/actions/health-meters";
```

Note: Keep the `AccountsSection` async component definition that's already in the file (lines 96-130) — it stays as-is since it's already Suspensed.

- [ ] **Step 2: Replace the DashboardTransactionRow type and AccountsSection (keep as-is)**

Keep the `DashboardTransactionRow` type and `AccountsSection` async component exactly as they are (lines 80-130).

- [ ] **Step 3: Rewrite the page function — shell fetches only**

Replace the page function (from `export default async function DashboardPage` through the end) with:

```tsx
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

  // ── Shell: minimal data for routing + layout ──
  const [preferredCurrency, allAccountsResult, dashboardConfigData] =
    await Promise.all([
      getPreferredCurrency(),
      getAccounts(),
      getDashboardConfigWithPurpose(),
    ]);

  const allAccounts = allAccountsResult.success ? allAccountsResult.data : [];
  const accountIdsForFilter = allAccounts.map((a) => a.id);

  // Fetch recent transactions filtered by demo mode accounts
  let recentTransactionsQuery = supabase
    .from("transactions")
    .select("id, amount, direction, account_id, merchant_name, clean_description, transaction_date, currency_code, categories!category_id(name_es, name)")
    .eq("is_excluded", false)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5)
    .is("reconciled_into_transaction_id", null);

  if (accountIdsForFilter.length > 0) {
    recentTransactionsQuery = recentTransactionsQuery.in("account_id", accountIdsForFilter);
  }

  const { data: recentTransactions } = await recentTransactionsQuery;

  // Resolve currency from cached accounts
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

  // ── Subtitle computed from shell data ──
  const accountsSubtitle = allAccounts.length > 0
    ? `${allAccounts.length} ${allAccounts.length === 1 ? "cuenta activa" : "cuentas activas"}`
    : "Agrega una cuenta para comenzar";

  const heatmapSubtitle = recentTx.length > 0
    ? "Actividad de los últimos meses"
    : "Sin transacciones registradas";

  return (
    <>
      {/* ── Mobile: streams as one unit ── */}
      <div className="lg:hidden">
        <Suspense fallback={<MobileZoneSkeleton />}>
          <MobileZone month={month} currency={currency as CurrencyCode} recentTx={recentTx} />
        </Suspense>
      </div>

      {/* ── Desktop: section-based streaming ── */}
      <div className="hidden lg:block">
        <DashboardConfigProvider
          serverConfig={dashboardConfigData.config}
          appPurpose={dashboardConfigData.appPurpose}
        >
          <div className="space-y-6">
            {/* Header — renders immediately from shell data */}
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

            {/* ── Hero zone: hero + attention + action strip + plan teaser ── */}
            <Suspense fallback={<HeroZoneSkeleton />}>
              <HeroZone month={month} currency={currency as CurrencyCode} monthLabel={monthLabel} />
            </Suspense>

            {/* ── Widgets zone: impact + pendientes + deseos ── */}
            <Suspense fallback={<WidgetsZoneSkeleton />}>
              <WidgetsZone />
            </Suspense>

            {/* ── Health score zone ── */}
            <Suspense fallback={<HealthScoreSkeleton />}>
              <HealthZone currency={currency as CurrencyCode} month={month} />
            </Suspense>

            {/* ── Flujo — already async/Suspensed ── */}
            <Suspense
              fallback={
                <DashboardSection title="Flujo de caja" section="flujo">
                  <div className="h-[240px] w-full rounded-xl bg-muted animate-pulse" />
                </DashboardSection>
              }
            >
              <FlujoSection month={month} currency={currency} monthLabel={monthLabel} />
            </Suspense>

            {/* ── Heatmap — already async/Suspensed ── */}
            <DashboardSection title="Actividad" section="actividad" subtitle={heatmapSubtitle}>
              <WidgetSlot widgetId="spending-heatmap">
                <Suspense fallback={<HeatmapSkeleton />}>
                  <ActividadHeatmap month={month} currency={currency} />
                </Suspense>
              </WidgetSlot>
            </DashboardSection>

            {/* ── Accounts — already async/Suspensed ── */}
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
```

- [ ] **Step 4: Verify build passes**

Run: `cd webapp && pnpm build 2>&1 | tail -10`
Expected: clean build

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: rewrite dashboard page with Suspense streaming zones"
```

---

### Task 7: Build verification and cleanup

- [ ] **Step 1: Full build from repo root**

Run: `pnpm install && pnpm build`
Expected: clean build, no type errors

- [ ] **Step 2: Verify no unused imports**

Check that the page file doesn't import anything only used by zone components. The build will catch type errors, but unused imports should be cleaned up manually.

Run: `cd webapp && pnpm build 2>&1 | grep -i "unused\|never read"` (or rely on TypeScript strict mode catching these)

- [ ] **Step 3: Commit any cleanup**

```bash
git add -A
git commit -m "fix: clean up unused imports after dashboard streaming refactor"
```

---

## Design Notes

### Why zones instead of per-component Suspense?

Per-component Suspense (one boundary per widget) would cause excessive layout shift — 10+ independent areas popping in at slightly different times. Zones group related widgets that the user expects to see together, reducing visual churn to 3-4 smooth transitions.

### Why mobile is a separate zone?

Mobile's `InicioRoot` is a single client component that needs data from multiple "desktop zones" (hero + burnRate + attention + budget). Rather than restructuring `InicioRoot` to accept streamed data, we give it one async wrapper that fetches everything it needs. The "duplicate" calls (e.g., `getDashboardHeroData` called by both HeroZone and MobileZone) hit the cache and cost ~0ms.

### Rendering flow after this change

```
0ms     Shell renders: header, MonthSelector, skeletons for all zones
~50ms   HeroZone streams in (hero + attention + action strip)
~60ms   HealthZone streams in (health score meters)
~70ms   WidgetsZone streams in (impact + pendientes + deseos)
~80ms   FlujoSection streams in (already Suspensed)
~90ms   MobileZone streams in (complete mobile dashboard)
~100ms  Heatmap, Accounts stream in (already Suspensed)
```

vs. current:
```
0ms     Blank screen
~200ms  EVERYTHING renders at once
```

### What stays the same

- All existing `"use cache"` + `cacheTag()` patterns — no changes
- `revalidateTag()` invalidation — zones re-fetch fresh data on next render
- `DashboardConfigProvider` context — wraps all desktop zones, `WidgetSlot` works as before
- `AccountsSection` async component (already in page.tsx) — untouched
- FlujoSection, ActividadHeatmap — already async/Suspensed, untouched

### Why not Categorizar?

Evaluated and skipped. The page has 6 queries in a `Promise.all`, but:
1. The stat cards (header) need the **counts** from the full data — can't render stats before data arrives
2. The inbox components use `dynamic()` imports — JS bundle is already lazy-loaded
3. Categories and tagGroups are cached (~0ms via AppDataProvider warming)
4. Net result: streaming would only save the time difference between the fastest and slowest of 4 page-specific queries — minimal visual benefit

---

## Part 2: Plan Page Streaming

### Plan page data dependency graph

```
SHELL (renders immediately):
  getPreferredCurrency() → currency
  getWishlistItemsForDashboard() → wishlistSummary (for tab badge)
  getActivePeriod() → activePeriod (for tab badge)
  
  Renders: Header + SectionEyebrow + PlanTabNav + MonthSelector

PLAN RESUMEN ZONE (desktop, streams — only when activeTab === "resumen"):
  getPlanPageData(month, currency) → planData
  getCategoriesByRhythm(month, currency) → rhythmData
  
  Renders: PlanHero + PlanBudgetToggle + PlanDebtSection + PlanRecurringSection + PlanScenarioPreview

PLAN MOBILE ZONE (mobile, streams — only when activeTab === "resumen"):
  getPlanPageData(month, currency) → planData
  getPlanTimelineData(month, currency) → timelineData
  
  Renders: PlanRoot

TAB CONTENT (already Suspensed, no change):
  PlanTabPresupuesto, PlanTabPeriodo, PlanTabRecurrentes, PlanTabDeseos
```

---

### Task 8: Create PlanResumenZone async component

**Files:**
- Create: `webapp/src/components/plan/zones/plan-resumen-zone.tsx`

- [ ] **Step 1: Create the resumen zone component**

```tsx
// webapp/src/components/plan/zones/plan-resumen-zone.tsx
import { getPlanPageData } from "@/actions/plan";
import { getCategoriesByRhythm } from "@/actions/categories";
import { PlanHero } from "@/components/plan/plan-hero";
import { PlanBudgetSection } from "@/components/plan/plan-budget-section";
import { PlanBudgetToggle } from "@/components/plan/plan-budget-toggle";
import { PlanDebtSection } from "@/components/plan/plan-debt-section";
import { PlanRecurringSection } from "@/components/plan/plan-recurring-section";
import { PlanScenarioPreview } from "@/components/plan/plan-scenario-preview";
import { PlanTabNav, type PlanTab } from "@/components/plan/plan-tab-nav";
import type { CurrencyCode } from "@/types/domain";

interface PlanResumenZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
  activeTab: PlanTab;
}

export async function PlanResumenZone({
  month,
  currency,
  monthLabel,
  activeTab,
}: PlanResumenZoneProps) {
  const [planData, rhythmResult] = await Promise.all([
    getPlanPageData(month, currency),
    getCategoriesByRhythm(month, currency),
  ]);

  const rhythmData = rhythmResult?.success ? rhythmResult.data : [];

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
        <PlanHero
          summary={planData.heroSummary}
          currency={planData.currency}
          monthLabel={monthLabel}
          incomeEstimate={planData.incomeEstimate}
        />
        <div className="space-y-3 rounded-2xl border border-white/6 bg-z-surface-2/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Módulos del plan
          </p>
          <PlanTabNav activeTab={activeTab} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <PlanBudgetToggle
          domainView={<PlanBudgetSection budget={planData.budget} currency={planData.currency} />}
          rhythmGroups={rhythmData}
          currency={planData.currency}
        />
        <div className="space-y-6">
          <PlanDebtSection debt={planData.debt} currency={planData.currency} />
          <PlanRecurringSection recurring={planData.recurring} currency={planData.currency} />
        </div>
      </div>

      <PlanScenarioPreview scenarios={planData.scenarios} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/plan/zones/plan-resumen-zone.tsx
git commit -m "feat: extract PlanResumenZone async component for plan streaming"
```

---

### Task 9: Create PlanMobileZone async component

**Files:**
- Create: `webapp/src/components/plan/zones/plan-mobile-zone.tsx`

- [ ] **Step 1: Create the mobile zone component**

```tsx
// webapp/src/components/plan/zones/plan-mobile-zone.tsx
import { getPlanPageData } from "@/actions/plan";
import { getPlanTimelineData } from "@/actions/plan-timeline";
import { PlanRoot } from "@/components/mobile/v2/plan/plan-root";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

interface PlanMobileZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
  periodoSummary: {
    hasActive: boolean;
    percentAssigned: number;
    unassignedCount: number;
  } | null;
  wishlistCount: number;
}

export async function PlanMobileZone({
  month,
  currency,
  monthLabel,
  periodoSummary,
  wishlistCount,
}: PlanMobileZoneProps) {
  const [planData, timelineData] = await Promise.all([
    getPlanPageData(month, currency),
    getPlanTimelineData(month, currency),
  ]);

  const now = new Date();
  const planDayOfMonth = now.getDate();
  const planDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <PlanRoot
      planData={planData}
      timelineData={timelineData}
      currency={planData.currency}
      monthLabel={monthLabel}
      dayOfMonth={planDayOfMonth}
      daysInMonth={planDaysInMonth}
      periodoSummary={periodoSummary}
      wishlistCount={wishlistCount}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/plan/zones/plan-mobile-zone.tsx
git commit -m "feat: extract PlanMobileZone async component for plan streaming"
```

---

### Task 10: Rewrite plan page to use Suspense zones

**Files:**
- Modify: `webapp/src/app/(dashboard)/plan/page.tsx`

- [ ] **Step 1: Replace the full plan page content**

```tsx
import { connection } from "next/server";
import { Suspense } from "react";
import { getWishlistItemsForDashboard } from "@/actions/wishlist";
import { MonthSelector } from "@/components/month-selector";
import { PlanTabNav, type PlanTab } from "@/components/plan/plan-tab-nav";
import { PlanTabPresupuesto } from "@/components/plan/tabs/plan-tab-presupuesto";
import { PlanTabPeriodo } from "@/components/plan/tabs/plan-tab-periodo";
import { PlanTabRecurrentes } from "@/components/plan/tabs/plan-tab-recurrentes";
import { PlanTabDeseos } from "@/components/plan/tabs/plan-tab-deseos";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { getPreferredCurrency } from "@/actions/profile";
import { getActivePeriod } from "@/actions/cashflow-planner";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";
import { PlanResumenZone } from "@/components/plan/zones/plan-resumen-zone";
import { PlanMobileZone } from "@/components/plan/zones/plan-mobile-zone";
import type { CurrencyCode } from "@/types/domain";

const VALID_TABS: PlanTab[] = ["resumen", "presupuesto", "periodo", "recurrentes", "deseos"];

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const month = params.month;
  const rawTab = params.tab;
  const activeTab: PlanTab = VALID_TABS.includes(rawTab as PlanTab)
    ? (rawTab as PlanTab)
    : "resumen";

  const monthLabel = formatMonthLabel(parseMonth(month));

  // Shell: lightweight data for header + tab nav badges
  const [currency, wishlistSummary, activePeriodResult] = await Promise.all([
    getPreferredCurrency(),
    getWishlistItemsForDashboard(),
    getActivePeriod(),
  ]);

  const isResumen = activeTab === "resumen";

  const activePeriod = activePeriodResult.success ? activePeriodResult.data : null;
  const periodoSummary = activePeriod
    ? {
        hasActive: true,
        percentAssigned: activePeriod.total_expenses > 0
          ? Math.round((activePeriod.total_assigned / activePeriod.total_expenses) * 100)
          : 0,
        unassignedCount: activePeriod.unassigned_expenses.length,
      }
    : null;

  // Tab content for non-resumen tabs (already Suspensed)
  const tabContent = (() => {
    switch (activeTab) {
      case "presupuesto":
        return <PlanTabPresupuesto month={month} currency={currency} />;
      case "periodo":
        return <PlanTabPeriodo />;
      case "recurrentes":
        return <PlanTabRecurrentes />;
      case "deseos":
        return <PlanTabDeseos />;
      default:
        return null;
    }
  })();

  // Skeleton for resumen zones
  const resumenSkeleton = (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
        <div className="h-[280px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="h-[280px] rounded-xl bg-z-surface-2 animate-pulse" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="h-[300px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="space-y-6">
          <div className="h-[140px] rounded-xl bg-z-surface-2 animate-pulse" />
          <div className="h-[140px] rounded-xl bg-z-surface-2 animate-pulse" />
        </div>
      </div>
      <div className="h-[200px] rounded-xl bg-z-surface-2 animate-pulse" />
    </div>
  );

  const mobileSkeleton = (
    <div className="space-y-4">
      <div className="h-[200px] rounded-2xl bg-z-surface-2 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[80px] rounded-xl bg-z-surface-2 animate-pulse" />
        <div className="h-[80px] rounded-xl bg-z-surface-2 animate-pulse" />
      </div>
      <div className="h-[160px] rounded-xl bg-z-surface-2 animate-pulse" />
    </div>
  );

  return (
    <div className={PAGE_STACK_CLASS}>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        {isResumen ? (
          <Suspense fallback={mobileSkeleton}>
            <PlanMobileZone
              month={month}
              currency={currency as CurrencyCode}
              monthLabel={monthLabel}
              periodoSummary={periodoSummary}
              wishlistCount={wishlistSummary?.totalCount ?? 0}
            />
          </Suspense>
        ) : (
          tabContent && (
            <div className="mt-4">
              <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
                {tabContent}
              </Suspense>
            </div>
          )
        )}
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:block space-y-6">
        {/* Header — renders immediately from shell data */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <SectionEyebrow>Plan</SectionEyebrow>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Tu capa estratégica</h1>
              <p className="text-muted-foreground">
                {monthLabel} · reúne presupuesto, deuda, obligaciones y escenarios en una sola decisión
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PlanTabNav activeTab={activeTab} />
            <Suspense fallback={<div className="h-9 w-40 rounded-md bg-muted animate-pulse" />}>
              <MonthSelector />
            </Suspense>
          </div>
        </div>

        {/* Resumen content — streams via zone */}
        {isResumen && (
          <Suspense fallback={resumenSkeleton}>
            <PlanResumenZone
              month={month}
              currency={currency as CurrencyCode}
              monthLabel={monthLabel}
              activeTab={activeTab}
            />
          </Suspense>
        )}

        {/* Tab content — already Suspensed */}
        {tabContent && (
          <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
            {tabContent}
          </Suspense>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build 2>&1 | tail -10`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/plan/page.tsx
git commit -m "feat: rewrite plan page with Suspense streaming zones"
```

---

### Task 11: Final build verification

- [ ] **Step 1: Full build from repo root**

Run: `pnpm install && pnpm build`
Expected: clean build, no type errors

- [ ] **Step 2: Commit any cleanup**

```bash
git add -A
git commit -m "fix: clean up unused imports after streaming refactor"
```

---

## Plan Page Rendering Flow After

```
0ms     Shell renders: header, SectionEyebrow, PlanTabNav, MonthSelector, skeletons
~80ms   PlanResumenZone streams in (hero + budget + debt + recurring + scenarios)
~80ms   PlanMobileZone streams in (PlanRoot with timeline)
```

vs. current:
```
0ms     Blank (waiting for shell + conditional Promise.all)
~150ms  Everything renders at once
```

For non-resumen tabs, nothing changes — they already use Suspense and conditional data fetching.
