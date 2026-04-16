"use client";

import { InicioHero } from "./inicio-hero";
import { InicioMetricsGrid } from "./inicio-metrics-grid";
import { InicioDiscovery } from "./inicio-discovery";
import { InicioActivity } from "./inicio-activity";
import { InicioAttentionTimeline } from "./inicio-attention-timeline";
import { InicioStarter } from "./inicio-starter";
import { InicioImportStrip } from "./inicio-import-strip";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { useLiveDashboard } from "@/hooks/use-live-metrics";
import type { LiveDashboardData } from "@/actions/live-dashboard";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import type { UpcomingIncomeItem } from "./timeline-model";

export interface InicioRootProps {
  hero: {
    availablePerDay: number;
    availableTotal: number;
    daysRemaining: number;
    currency: CurrencyCode;
    // Pay-cycle fields (optional for backward compatibility)
    nextIncomeDate?: string | null;
    nextIncomeAmount?: number;
    nextIncomeName?: string | null;
    incomeConfigured?: boolean;
    breakdown?: {
      totalLiquid: number;
      fixedExpenses: number;
      alreadySpent: number;
    };
    primaryAccount?: {
      id: string;
      name: string;
      currentBalance: number;
      currencyCode: CurrencyCode;
    };
  };
  metrics: {
    daysInMonth: number;
    dayOfMonth: number;
    spentToday: number;
    spentYesterday: number;
    avgLast7: number;
    currency: CurrencyCode;
  };
  attentionItems: {
    overdueReminders: LiveDashboardData["attention"]["overdueReminders"];
    upcomingPayments: LiveDashboardData["attention"]["upcomingPayments"];
    pendingEmails: LiveDashboardData["attention"]["pendingEmails"];
  };
  upcomingIncome: UpcomingIncomeItem[];
  burnRateData: BurnRateResponse | null;
  totalBudget: number;
  starterMode: boolean;
  daysSinceImport: number;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    currency_code: string;
    direction: "INFLOW" | "OUTFLOW";
    account_id: string;
    account_name: string;
    account_color: string | null;
    category_name: string | null;
    category_icon: string | null;
    recurrence_group_id: string | null;
    tags: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  }>;
  currency: CurrencyCode;
}

export function InicioRoot({
  hero,
  metrics,
  attentionItems,
  upcomingIncome,
  burnRateData,
  totalBudget,
  starterMode,
  daysSinceImport,
  recentTransactions,
  currency,
}: InicioRootProps) {
  const { activeZone, toggle } = useExpandableZone<string>();

  // Must be called before any conditional return (Rules of Hooks)
  const live = useLiveDashboard(
    {
      hero: {
        availablePerDay: hero.availablePerDay,
        availableTotal: hero.availableTotal,
        daysRemaining: hero.daysRemaining,
        nextIncomeDate: hero.nextIncomeDate ?? null,
        nextIncomeAmount: hero.nextIncomeAmount ?? 0,
        nextIncomeName: hero.nextIncomeName ?? null,
        incomeConfigured: hero.incomeConfigured ?? false,
        breakdown: hero.breakdown ?? { totalLiquid: 0, fixedExpenses: 0, alreadySpent: 0 },
      },
      metrics: {
        spentToday: metrics.spentToday,
        spentYesterday: metrics.spentYesterday,
        avgLast7: metrics.avgLast7,
      },
      attention: attentionItems,
    },
    currency,
  );

  if (starterMode) {
    return (
      <div className="space-y-2">
        <InicioStarter />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <InicioHero
        availablePerDay={live.hero.availablePerDay}
        availableTotal={live.hero.availableTotal}
        daysRemaining={live.hero.daysRemaining}
        currency={hero.currency}
        nextIncomeDate={live.hero.nextIncomeDate ?? hero.nextIncomeDate ?? null}
        nextIncomeAmount={live.hero.nextIncomeAmount ?? hero.nextIncomeAmount ?? 0}
        nextIncomeName={live.hero.nextIncomeName ?? hero.nextIncomeName ?? null}
        incomeConfigured={live.hero.incomeConfigured ?? hero.incomeConfigured ?? false}
        breakdown={live.hero.breakdown}
        primaryAccount={hero.primaryAccount}
        expanded={activeZone === "hero"}
        onToggle={() => toggle("hero")}
      />

      <InicioImportStrip daysSinceImport={daysSinceImport} />

      <InicioMetricsGrid
        daysInMonth={metrics.daysInMonth}
        dayOfMonth={metrics.dayOfMonth}
        spentToday={live.metrics.spentToday}
        spentYesterday={live.metrics.spentYesterday}
        avgLast7={live.metrics.avgLast7}
        currency={metrics.currency}
        burnRateData={burnRateData}
        totalBudget={totalBudget}
        expanded={activeZone}
        onToggle={toggle}
      />

      <InicioAttentionTimeline
        overdueReminders={live.attention.overdueReminders}
        upcomingPayments={live.attention.upcomingPayments}
        pendingEmails={live.attention.pendingEmails}
        upcomingIncome={upcomingIncome}
      />

      <InicioDiscovery
        expanded={activeZone}
        onToggle={toggle}
        currency={currency}
      />

      <InicioActivity transactions={recentTransactions} />
    </div>
  );
}
