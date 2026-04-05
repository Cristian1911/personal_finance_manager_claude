"use client";

import type { AttentionSignal } from "@/types/attention";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import { MobileAlertCard } from "./cards/mobile-alert-card";
import { MobileHeroCard, type MobileHeroCardProps } from "./cards/mobile-hero-card";
import { SpendingPaceTile } from "./cards/mobile-spending-pace";
import { BudgetTile, type TopCategory } from "./cards/mobile-budget-ring";
import { BurndownExpandable } from "@/components/dashboard/burndown-expandable";
import { InicioDiscoveryRail } from "@/components/dashboard/inicio-discovery-rail";
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
  recentTransactions,
}: MobileDashboardV2Props) {
  const hasPace = !!burnRateData;
  const hasBudget = !!budget && budget.totalTarget > 0;
  const hasUrgentFocus =
    attentionSignals.some((s) => s.priority === "action") ||
    (!!burnRateData && burnRateData.discretionary.runwayDays < 10);

  const hasCriticalCategories =
    !!budget &&
    budget.topCategories.some((c) => c.percentUsed >= 90);

  return (
    <div className="space-y-2">
      {/* 1. Focus alert — only when there are pending actions */}
      <MobileAlertCard signals={attentionSignals} />

      {/* 2. Hero — "Disponible para gastar" as primary question */}
      <MobileHeroCard {...hero} />

      {/* 3. Two metrics above fold — spending pace + budget */}
      {(hasPace || hasBudget) && (
        <div className="grid grid-cols-2 gap-1.5">
          {hasPace && <SpendingPaceTile data={burnRateData} />}
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

      {/* 4. Burndown — expandable chart with context-specific actions */}
      {hasPace && (
        <BurndownExpandable
          data={burnRateData}
          hasCriticalCategories={hasCriticalCategories}
        />
      )}

      {/* 5. Discovery rail — compressed when focus is urgent */}
      <InicioDiscoveryRail compressed={hasUrgentFocus} />

      {/* 6. Recent activity — preview only */}
      {recentTransactions.length > 0 && (
        <>
          <div className="flex items-center gap-2 py-0.5">
            <div className="h-px flex-1 bg-white/6" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Actividad reciente
            </span>
            <div className="h-px flex-1 bg-white/6" />
          </div>
          <MobileRecentTxns transactions={recentTransactions} />
        </>
      )}
    </div>
  );
}
