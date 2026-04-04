"use client";

import type { AttentionSignal } from "@/types/attention";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import { MobileAlertCard } from "./cards/mobile-alert-card";
import { MobileHeroCard, type MobileHeroCardProps } from "./cards/mobile-hero-card";
import { SpendingPaceTile } from "./cards/mobile-spending-pace";
import { BudgetTile, type TopCategory } from "./cards/mobile-budget-ring";
import { MobileUpcomingPayments } from "./cards/mobile-upcoming-payments";
import { MobileRecentTxns } from "./cards/mobile-recent-txns";

export interface MobileDashboardV2Props {
  attentionSignals: AttentionSignal[];
  hero: MobileHeroCardProps;
  burnRateData: BurnRateResponse | null;
  budget: {
    totalTarget: number;
    totalSpent: number;
    progress: number;
    currency: CurrencyCode;
    topCategories: TopCategory[];
  } | null;
  upcomingPayments: Array<{
    id: string;
    name: string;
    dueDate: string;
    amount: number;
    currencyCode: string;
    accountName?: string;
    frequency?: string;
  }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    currency_code: string;
    direction: "INFLOW" | "OUTFLOW";
  }>;
}

export function MobileDashboardV2({
  attentionSignals,
  hero,
  burnRateData,
  budget,
  upcomingPayments,
  recentTransactions,
}: MobileDashboardV2Props) {
  const hasPace = !!burnRateData;
  const hasBudget = !!budget && budget.totalTarget > 0;

  return (
    <div className="space-y-2">
      {/* ① Alert pill */}
      <MobileAlertCard signals={attentionSignals} />

      {/* ② Hero */}
      <MobileHeroCard {...hero} />

      {/* ③ Insight tiles — summary first, no debt-style expanded state */}
      {(hasPace || hasBudget) && (
        <div className="grid grid-cols-2 gap-1.5">
            {hasPace && (
              <SpendingPaceTile data={burnRateData} />
            )}
            {hasBudget && (
              <BudgetTile
                progress={budget.progress}
                totalTarget={budget.totalTarget}
                totalSpent={budget.totalSpent}
                topCategories={budget.topCategories}
              />
            )}
        </div>
      )}

      {/* Section divider */}
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-px flex-1 bg-white/6" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Actividad
        </span>
        <div className="h-px flex-1 bg-white/6" />
      </div>

      {/* ④ Upcoming payments */}
      <MobileUpcomingPayments payments={upcomingPayments} />

      {/* ⑤ Recent transactions */}
      <MobileRecentTxns transactions={recentTransactions} />
    </div>
  );
}
