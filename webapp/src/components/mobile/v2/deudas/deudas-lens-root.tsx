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
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { CurrencyCode } from "@/types/domain";
import type { DebtStats, DebtOverview, MonthlyBreakdown } from "@zeta/shared";
import type { DebtTrendData } from "@/actions/debt";
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
  extraPaymentTrigger?: React.ReactNode;
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
  extraPaymentTrigger,
}: DeudasLensRootProps) {
  // SSR-safe: render "carga" first, then adopt the persisted lens after mount.
  const [lens, setLens] = useState<DeudasLens>("carga");
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "plan" || saved === "cuentas") setLens(saved);
  }, []);

  const selectLens = (next: DeudasLens) => {
    setLens(next);
    localStorage.setItem(STORAGE_KEY, next);
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
            totalMonthlyPayment={stats.totalMonthlyPayment}
            monthlyInterest={overview.monthlyInterestEstimate}
            currency={currency}
            accounts={overview.accounts.map((a) => ({
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
          insights={overview.insights}
          currency={currency}
          extraPaymentTrigger={extraPaymentTrigger}
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
        />
      )}
    </div>
  );
}
