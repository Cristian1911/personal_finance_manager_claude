"use client";

import type { AttentionSignal } from "@/types/attention";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import { MobileAlertCard } from "./cards/mobile-alert-card";
import { MobileHeroCard, type MobileHeroCardProps } from "./cards/mobile-hero-card";
import { MobileSpendingPaceTile } from "./cards/mobile-spending-pace";
import { MobileBudgetTile, type TopCategory } from "./cards/mobile-budget-ring";
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

      {/* ③ Insight tiles — side by side */}
      {(hasPace || hasBudget) && (
        <div className="flex gap-1.5">
          {hasPace && (
            <div className="flex-1">
              <MobileSpendingPaceTile data={burnRateData} />
            </div>
          )}
          {hasBudget && (
            <div className="flex-1">
              <MobileBudgetTile
                totalTarget={budget.totalTarget}
                totalSpent={budget.totalSpent}
                progress={budget.progress}
                topCategories={budget.topCategories}
              />
            </div>
          )}
        </div>
      )}

      {/* Section divider */}
      <div className="flex items-center gap-2 py-0.5">
        <div className="h-px flex-1 bg-white/4" />
        <span className="text-[7px] font-semibold uppercase tracking-[0.2em] text-[#3a3a3a]">
          Actividad
        </span>
        <div className="h-px flex-1 bg-white/4" />
      </div>

      {/* ④ Upcoming payments */}
      <MobileUpcomingPayments payments={upcomingPayments} />

      {/* ⑤ Recent transactions */}
      <MobileRecentTxns transactions={recentTransactions} />
    </div>
  );
}
