"use client";

import { useEffect, useState } from "react";
import {
  SEGMENTED_TAB_CLASS,
  SEGMENTED_TAB_ACTIVE_CLASS,
} from "@/lib/constants/styles";
import { DeudasHero } from "./deudas-hero";
import { DebtTrendCard } from "./debt-trend-card";
import { DeudasSalaryBar } from "./deudas-salary-bar";
import { DeudasPlanLens } from "./deudas-plan-lens";
import { DeudasCuentasLens } from "./deudas-cuentas-lens";
import { ExtraPaymentSheet } from "@/components/debt/extra-payment-sheet";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { CurrencyCode } from "@/types/domain";
import type { DebtStats, DebtOverview, MonthlyBreakdown } from "@zeta/shared";
import type { DebtTrendData, ArchivedObligation } from "@/actions/debt";
import type { DebtCountdownData } from "@/actions/debt-countdown";

const LENSES = [
  { id: "carga", label: "Carga" },
  { id: "plan", label: "Plan" },
  { id: "cuentas", label: "Cuentas" },
] as const;

export type DeudasLens = (typeof LENSES)[number]["id"];

const STORAGE_KEY = "zeta:deudas-lens";

export interface PersonasSummary {
  activeCount: number;
  iOweTotal: number;
  owedToMeTotal: number;
  /** Per-person detail for the expandable card (E1). */
  owedToMe: { name: string; amount: number }[];
  iOwe: { name: string; amount: number }[];
}

export interface ExchangeRateInfo {
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  from: CurrencyCode;
}

interface DeudasLensRootProps {
  stats: DebtStats;
  overview: DebtOverview;
  salaryBreakdown: MonthlyBreakdown | null;
  trend: DebtTrendData | null;
  countdown: DebtCountdownData | null;
  personasSummary: PersonasSummary | null;
  exchangeRate: ExchangeRateInfo | null;
  currency: CurrencyCode;
  /** Fully paid, archived obligations — streamed promise, resolved via use() inside Suspense. */
  archivedObligations?: Promise<ArchivedObligation[]>;
  /** Funding accounts for the shared extra-payment sheet. */
  sourceAccounts: {
    id: string;
    name: string;
    current_balance: number;
    currency_code: string;
  }[];
  usdToCopRate: number | null;
}

export function DeudasLensRoot({
  stats,
  overview,
  salaryBreakdown,
  trend,
  countdown,
  personasSummary,
  exchangeRate,
  currency,
  archivedObligations,
  sourceAccounts,
  usdToCopRate,
}: DeudasLensRootProps) {
  // SSR-safe: render "carga" first, then adopt the persisted lens after mount.
  const [lens, setLens] = useState<DeudasLens>("carga");
  // One shared extra-payment sheet for every "Abonar" CTA across the lenses.
  const [extraOpen, setExtraOpen] = useState(false);
  const hasActiveDebt = overview.accounts.some((a) => a.balance > 0);
  const onAbonar = hasActiveDebt ? () => setExtraOpen(true) : undefined;
  useEffect(() => {
    // localStorage can throw in private/sandboxed contexts — never block mount.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "plan" || saved === "cuentas") setLens(saved);
    } catch {
      // non-critical: fall back to the default lens
    }
  }, []);

  const selectLens = (next: DeudasLens) => {
    setLens(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // non-critical: selection just won't persist
    }
  };

  const { activeZone, toggle } = useExpandableZone<string>();

  return (
    <div className="space-y-3">
      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="Vista de deudas"
        className="flex gap-1 rounded-full border border-white/6 bg-white/[0.03] p-1"
      >
        {LENSES.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={lens === l.id}
            onClick={() => selectLens(l.id)}
            className={lens === l.id ? SEGMENTED_TAB_ACTIVE_CLASS : SEGMENTED_TAB_CLASS}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* ── Carga (default): cuánto se quema + tendencia honesta + salario ── */}
      {lens === "carga" && (
        <>
          <DeudasHero
            totalDebt={overview.totalDebt}
            totalMonthlyPayment={stats.totalMonthlyPayment}
            monthlyInterest={overview.monthlyInterestEstimate}
            currency={currency}
            accounts={overview.accounts
              .filter((a) => a.balance > 0)
              .map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type as "CREDIT_CARD" | "LOAN",
                monthlyPayment: a.monthlyPayment ?? 0,
                interestRate: a.interestRate ?? 0,
                balance: a.balance,
                currency: a.currency,
              }))}
            expanded={activeZone === "hero"}
            onToggle={() => toggle("hero")}
          />
          {trend && <DebtTrendCard trend={trend} currency={currency} />}
          {salaryBreakdown && (
            <DeudasSalaryBar breakdown={salaryBreakdown} currency={currency} />
          )}
        </>
      )}

      {/* ── Plan: horizonte + hito + acciones + insights ── */}
      {lens === "plan" && (
        <DeudasPlanLens
          countdown={countdown}
          stats={stats}
          accounts={overview.accounts}
          insights={overview.insights}
          currency={currency}
          onAbonar={onAbonar}
        />
      )}

      {/* ── Cuentas: inventario canónico ── */}
      {lens === "cuentas" && (
        <DeudasCuentasLens
          overview={overview}
          stats={stats}
          personasSummary={personasSummary}
          exchangeRate={exchangeRate}
          currency={currency}
          archived={archivedObligations}
          onAbonar={onAbonar}
        />
      )}

      {/* Single shared sheet — every "Abonar" CTA opens this one instance */}
      {hasActiveDebt && (
        <ExtraPaymentSheet
          debtAccounts={overview.accounts}
          sourceAccounts={sourceAccounts}
          currency={currency}
          usdToCopRate={usdToCopRate}
          open={extraOpen}
          onOpenChange={setExtraOpen}
        />
      )}
    </div>
  );
}
