"use client";

import { InicioHero } from "./inicio-hero";
import { InicioMetricsGrid } from "./inicio-metrics-grid";
// Burndown is now inside InicioMetricsGrid as expanded view of Ritmo chip
import { InicioDiscovery } from "./inicio-discovery";
import { InicioActivity } from "./inicio-activity";
import { InicioAttention } from "./inicio-attention";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";
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
    overdueReminders: AttentionOverdueReminder[];
    upcomingPayments: AttentionUpcomingPayment[];
    pendingEmails: AttentionPendingEmail[];
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
  // Page-level accordion: only one section expanded at a time
  const { activeZone, toggle } = useExpandableZone<string>();

  return (
    <div className="space-y-2">
      <InicioHero
        {...hero}
        expanded={activeZone === "hero"}
        onToggle={() => toggle("hero")}
      />

      <InicioMetricsGrid
        {...metrics}
        burnRateData={burnRateData}
        totalBudget={totalBudget}
        expanded={activeZone}
        onToggle={toggle}
      />

      <InicioAttention
        overdueReminders={attentionItems.overdueReminders}
        upcomingPayments={attentionItems.upcomingPayments}
        pendingEmails={attentionItems.pendingEmails}
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
