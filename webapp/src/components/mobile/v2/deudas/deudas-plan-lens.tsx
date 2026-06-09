"use client";

import Link from "next/link";
import { Banknote, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { DebtStats, DebtInsight } from "@zeta/shared";
import type { DebtCountdownData } from "@/actions/debt-countdown";

const INSIGHT_COLOR: Record<DebtInsight["type"], string> = {
  warning: "border-z-alert/25 text-z-alert",
  info: "border-z-brass/25 text-z-brass",
  success: "border-z-income/25 text-z-income",
};

interface DeudasPlanLensProps {
  countdown: DebtCountdownData | null;
  stats: DebtStats;
  insights: DebtInsight[];
  currency: CurrencyCode;
  extraPaymentTrigger?: React.ReactNode;
}

export function DeudasPlanLens({
  countdown,
  stats,
  insights,
  currency,
  extraPaymentTrigger,
}: DeudasPlanLensProps) {
  const closestLoan = stats.loans.remainingMonths;
  const closestProgress = closestLoan
    ? stats.loans.progressList.find((p) => p.accountName === closestLoan.accountName)
    : null;
  const closestPayment = closestLoan
    ? stats.loans.payments.find((p) => p.accountName === closestLoan.accountName)
    : null;

  const chipClass =
    "inline-flex items-center gap-2 rounded-full border border-white/6 bg-white/[0.03] px-3 py-1.5 text-xs transition-colors";

  return (
    <div className="space-y-3">
      {/* Horizon hero */}
      <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
          Libre de deudas
        </p>
        {countdown ? (
          <>
            <p className="mt-2 text-[28px] font-[680] capitalize leading-none tracking-[-0.04em] text-z-brass">
              {formatMonthLabel(parseMonth(countdown.projectedDate))}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {countdown.monthsToFree} meses al ritmo actual
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-z-brass/80"
                style={{ width: `${countdown.progressPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {countdown.progressPercent.toFixed(0)}% del camino recorrido
            </p>
            {countdown.extraPaymentScenario && (
              <p className="mt-2 text-[10px] text-z-income">
                Con {formatCurrency(countdown.extraPaymentScenario.extraAmount, currency)} extra/mes
                terminarías {countdown.extraPaymentScenario.monthsSaved} meses antes
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Completa cuotas mínimas en tus cuentas para proyectar tu fecha.
          </p>
        )}
      </div>

      {/* Próximo hito */}
      {closestLoan && (
        <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
            Próximo hito
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-z-sage-light">
                {closestLoan.accountName}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {closestProgress ? `${closestProgress.percentage.toFixed(0)}% pagado` : ""}
                {closestPayment
                  ? ` · ${formatCurrency(closestPayment.amount, currency)}/mes`
                  : ""}
              </p>
            </div>
            <MilestoneRing months={closestLoan.months} />
          </div>
        </div>
      )}

      {/* Action row — Plata extra + Simular live here */}
      <div className="flex flex-wrap gap-2 px-1">
        {extraPaymentTrigger && (
          <div className={chipClass}>
            <Banknote className="size-3.5 text-z-brass" />
            {extraPaymentTrigger}
          </div>
        )}
        <Link href="/deudas/planificador" className={`${chipClass} active:bg-white/[0.06]`}>
          <Calculator className="size-3.5 text-z-brass" />
          <span>Simular pagos</span>
        </Link>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={cn(
                PANEL_INSET_CLASS,
                "border p-3",
                INSIGHT_COLOR[insight.type]
              )}
            >
              <p className="text-xs font-semibold">{insight.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {insight.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneRing({ months }: { months: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  // Visual cue only: fewer months remaining = fuller ring (capped at 36 months).
  const fillPct = Math.max(0, Math.min(1, 1 - months / 36));
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          className="stroke-z-income"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fillPct)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-z-income">
        {months}m
      </div>
    </div>
  );
}
