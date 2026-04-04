"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AttentionSignal } from "@/types/attention";
import type { BurnRateResponse } from "@/actions/burn-rate";
import type { CurrencyCode } from "@/types/domain";
import { MobileAlertCard } from "./cards/mobile-alert-card";
import { MobileHeroCard, type MobileHeroCardProps } from "./cards/mobile-hero-card";
import { SpendingPaceTile, SpendingPaceDetail } from "./cards/mobile-spending-pace";
import { BudgetTile, BudgetDetail, type TopCategory } from "./cards/mobile-budget-ring";
import { MobileUpcomingPayments } from "./cards/mobile-upcoming-payments";
import { MobileRecentTxns } from "./cards/mobile-recent-txns";

type InsightPanel = "pace" | "budget" | null;

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
  const [activePanel, setActivePanel] = useState<InsightPanel>(null);

  const hasPace = !!burnRateData;
  const hasBudget = !!budget && budget.totalTarget > 0;

  function togglePanel(panel: InsightPanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  return (
    <div className="space-y-2">
      {/* ① Alert pill */}
      <MobileAlertCard signals={attentionSignals} />

      {/* ② Hero */}
      <MobileHeroCard {...hero} />

      {/* ③ Insight tiles — side by side, detail expands full-width below */}
      {(hasPace || hasBudget) && (
        <div>
          {/* Tile row */}
          <div className="flex gap-1.5">
            {hasPace && (
              <div className="flex-1">
                <SpendingPaceTile
                  data={burnRateData}
                  active={activePanel === "pace"}
                  onClick={() => togglePanel("pace")}
                />
              </div>
            )}
            {hasBudget && (
              <div className="flex-1">
                <BudgetTile
                  progress={budget.progress}
                  active={activePanel === "budget"}
                  onClick={() => togglePanel("budget")}
                />
              </div>
            )}
          </div>

          {/* Expanded detail — full width below tiles */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: activePanel ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className={cn(
                "mt-2 transition-opacity duration-150",
                activePanel ? "opacity-100 delay-75" : "opacity-0"
              )}>
                {activePanel === "pace" && burnRateData && (
                  <SpendingPaceDetail data={burnRateData} />
                )}
                {activePanel === "budget" && budget && (
                  <BudgetDetail topCategories={budget.topCategories} />
                )}
              </div>
            </div>
          </div>
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
