"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { StateChip } from "@/components/mobile/v2/state-chip";
import type { CurrencyCode } from "@/types/domain";

interface DebtAccountBreakdown {
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  monthlyPayment: number;
  interestRate: number;
  balance: number;
  currency: string;
}

interface DeudasHeroProps {
  totalMonthlyPayment: number;
  monthlyInterest: number;
  currency: CurrencyCode;
  accounts?: DebtAccountBreakdown[];
  expanded?: boolean;
  onToggle?: () => void;
}

export function DeudasHero({
  totalMonthlyPayment,
  monthlyInterest,
  currency,
  accounts,
  expanded,
  onToggle,
}: DeudasHeroProps) {
  const capital = totalMonthlyPayment - monthlyInterest;
  const capitalPct = totalMonthlyPayment > 0
    ? Math.round((capital / totalMonthlyPayment) * 100)
    : 100;
  const interestPct = 100 - capitalPct;

  // Pressure: >30% interest = aprieta, >20% = atención, else = manejable
  const pressure =
    interestPct > 30 ? "warn" as const
    : interestPct > 20 ? "brass" as const
    : "sage" as const;
  const pressureLabel =
    interestPct > 30 ? "Aprieta"
    : interestPct > 20 ? "Atención"
    : "Manejable";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(PANEL_INSET_CLASS, "w-full p-3.5 text-left")}
      aria-expanded={expanded}
      aria-label="Expandir desglose de cuota mensual"
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
        Cuota mensual
      </p>

      {/* Hero amounts */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <div>
          <span className="text-[32px] font-[680] leading-none tracking-[-0.05em]">
            {formatCurrency(totalMonthlyPayment, currency)}
          </span>
          <span className="ml-1 text-[12px] text-muted-foreground">este mes</span>
        </div>
        <div className="text-right">
          <span className="text-[16px] font-semibold text-z-debt">
            {formatCurrency(monthlyInterest, currency)}
          </span>
          <p className="text-[10px] text-z-debt/70">en intereses</p>
        </div>
      </div>

      {/* Split bar */}
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
        <div
          className="bg-gradient-to-r from-[#f3eee1] to-[rgba(243,238,225,0.7)]"
          style={{ width: `${capitalPct}%` }}
        />
        <div
          className="bg-gradient-to-r from-z-debt/80 to-z-debt/50"
          style={{ width: `${interestPct}%` }}
        />
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {capitalPct}% capital · {interestPct}% costo financiero
        </span>
        <StateChip label={pressureLabel} variant={pressure} />
      </div>

      {/* Expandable breakdown */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-3 transition-opacity duration-150",
              expanded ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {accounts && accounts.length > 0 && (
              <div className={cn(PANEL_INSET_CLASS, "border-white/8 bg-black/20 p-3 space-y-2")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
                  Desglose por cuenta
                </p>
                {accounts.map((acct) => {
                  const isCC = acct.type === "CREDIT_CARD";
                  return (
                    <div key={acct.name} className="flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-z-sage-light">{acct.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {isCC ? "Tarjeta" : "Préstamo"} · {acct.interestRate > 0 ? `${acct.interestRate.toFixed(1)}% EA` : "Sin tasa"}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold text-foreground">
                        {formatCurrency(acct.monthlyPayment, currency)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
