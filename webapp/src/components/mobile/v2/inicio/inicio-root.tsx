"use client";

import { InicioHero } from "./inicio-hero";
import { InicioMetricsGrid } from "./inicio-metrics-grid";
import { InicioDiscovery } from "./inicio-discovery";
import { InicioActivity } from "./inicio-activity";
import { InicioAttention } from "./inicio-attention";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import { useLiveDashboard } from "@/hooks/use-live-metrics";
import type { LiveDashboardData } from "@/actions/live-dashboard";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";

export interface InicioRootProps {
  hero: {
    availablePerDay: number;
    availableTotal: number;
    daysRemaining: number;
    currency: CurrencyCode;
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
  burnRateData: BurnRateResponse | null;
  totalBudget: number;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    currency_code: string;
    direction: "INFLOW" | "OUTFLOW";
  }>;
  currency: CurrencyCode;
}

export function InicioRoot({
  hero,
  metrics,
  attentionItems,
  burnRateData,
  totalBudget,
  recentTransactions,
  currency,
}: InicioRootProps) {
  const { activeZone, toggle } = useExpandableZone<string>();

  // Live refresh: one server call corrects hero + metrics + attention
  const live = useLiveDashboard(
    {
      hero: {
        availablePerDay: hero.availablePerDay,
        availableTotal: hero.availableTotal,
        daysRemaining: hero.daysRemaining,
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

  return (
    <div className="space-y-2">
      <InicioHero
        availablePerDay={live.hero.availablePerDay}
        availableTotal={live.hero.availableTotal}
        daysRemaining={live.hero.daysRemaining}
        currency={hero.currency}
        breakdown={live.hero.breakdown}
        primaryAccount={hero.primaryAccount}
        expanded={activeZone === "hero"}
        onToggle={() => toggle("hero")}
      />

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

      <InicioAttention
        overdueReminders={live.attention.overdueReminders}
        upcomingPayments={live.attention.upcomingPayments}
        pendingEmails={live.attention.pendingEmails}
        currency={currency}
        expanded={activeZone}
        onToggle={toggle}
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
