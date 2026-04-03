// webapp/src/components/mobile/mobile-dashboard-v2.tsx
"use client";

import type { AttentionSignal } from "@/types/attention";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import { MobileAlertCard } from "./cards/mobile-alert-card";
import {
  MobileHeroCard,
  type MobileHeroCardProps,
} from "./cards/mobile-hero-card";
import { MobileSpendingPace } from "./cards/mobile-spending-pace";
import { MobileBudgetRing } from "./cards/mobile-budget-ring";
import { MobileUpcomingPayments } from "./cards/mobile-upcoming-payments";
import { MobileRecentTxns } from "./cards/mobile-recent-txns";

interface TopCategory {
  name: string;
  percentUsed: number;
}

export interface MobileDashboardV2Props {
  // Alert
  attentionSignals: AttentionSignal[];
  // Hero
  hero: MobileHeroCardProps;
  // Upcoming payments
  upcomingPayments: Array<{
    id: string;
    name: string;
    dueDate: string;
    amount: number;
    currencyCode: string;
    accountName?: string;
    frequency?: string;
  }>;
  // Recent transactions
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    currency_code: string;
    direction: "INFLOW" | "OUTFLOW";
  }>;
  // Budget
  budget: {
    totalTarget: number;
    totalSpent: number;
    progress: number;
    currency: CurrencyCode;
    topCategories: TopCategory[];
  } | null;
}

export function MobileDashboardV2({
  attentionSignals,
  hero,
  upcomingPayments,
  recentTransactions,
  budget,
}: MobileDashboardV2Props) {
  return (
    <div className="space-y-3">
      {/* ① Alert — conditional, hidden when empty */}
      <MobileAlertCard signals={attentionSignals} />

      {/* ② Hero — disponible para gastar */}
      <MobileHeroCard {...hero} />

      {/* ③ Spending pace — injected via Suspense slot from page.tsx */}
      {/* (not rendered here — see page.tsx integration) */}

      {/* ④ Budget ring */}
      {budget && (
        <MobileBudgetRing
          totalTarget={budget.totalTarget}
          totalSpent={budget.totalSpent}
          progress={budget.progress}
          currency={budget.currency}
          topCategories={budget.topCategories}
        />
      )}

      {/* ⑤ Upcoming payments */}
      <MobileUpcomingPayments payments={upcomingPayments} />

      {/* ⑥ Recent transactions — below the fold */}
      <MobileRecentTxns transactions={recentTransactions} />
    </div>
  );
}
