"use client";

import { InicioHero } from "./inicio-hero";
import { InicioMetricsGrid } from "./inicio-metrics-grid";
import { InicioFocus } from "./inicio-focus";
// Burndown is now inside InicioMetricsGrid as expanded view of Ritmo chip
import { InicioDiscovery } from "./inicio-discovery";
import { InicioActivity } from "./inicio-activity";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { AttentionSignal } from "@/types/attention";
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
  };
  metrics: {
    runwayDays: number;
    daysInMonth: number;
    dayOfMonth: number;
    nextIncomeName: string | null;
    nextIncomeDays: number | null;
    nextIncomeAmount: number | null;
    currency: CurrencyCode;
  };
  signals: AttentionSignal[];
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
  signals,
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

      <InicioFocus signals={signals} />

      <InicioDiscovery
        expanded={activeZone}
        onToggle={toggle}
      />

      <InicioActivity transactions={recentTransactions} />
    </div>
  );
}
