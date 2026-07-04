"use client";

import { cn } from "@/lib/utils";
import { Verdict } from "@/components/ui/verdict";
import { formatCurrency } from "@/lib/utils/currency";
import { deriveDebtVerdict } from "@/lib/utils/debt-verdict";
import { PANEL_INSET_CLASS, MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

interface DebtAccountBreakdown {
  id: string;
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  monthlyPayment: number;
  interestRate: number;
  balance: number;
  currency: string;
}

interface DeudasHeroProps {
  totalDebt: number;
  totalMonthlyPayment: number;
  monthlyInterest: number;
  currency: CurrencyCode;
  accounts?: DebtAccountBreakdown[];
  expanded?: boolean;
  onToggle?: () => void;
}

export function DeudasHero({
  totalDebt,
  totalMonthlyPayment,
  monthlyInterest,
  currency,
  accounts,
  expanded,
  onToggle,
}: DeudasHeroProps) {
  const capital = totalMonthlyPayment - monthlyInterest;
  const { state: verdictState, delta: verdictDelta, detail: verdictDetail } =
    deriveDebtVerdict({ totalDebt, totalMonthlyPayment, monthlyInterest, currency });
  // Clamp: negative amortization (interest > cuota) would yield a negative
  // capital share and a >100% interest bar.
  const capitalPct = totalMonthlyPayment > 0
    ? Math.max(0, Math.min(100, Math.round((capital / totalMonthlyPayment) * 100)))
    : 100;
  const interestPct = 100 - capitalPct;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(PANEL_INSET_CLASS, "block w-full p-3.5 text-left")}
      aria-expanded={expanded}
      aria-label="Expandir desglose de cuota mensual"
    >
      <p className={MOBILE_EYEBROW_CLASS}>
        Cuota mensual
      </p>

      {/* Hero amounts */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <div>
          <span className="text-[32px] font-[680] leading-none tracking-[-0.05em] tabular-nums">
            {formatCurrency(totalMonthlyPayment, currency)}
          </span>
          <span className="ml-1 text-[12px] text-muted-foreground">este mes</span>
        </div>
        <div className="text-right">
          <span className="text-[16px] font-semibold text-z-debt tabular-nums">
            {formatCurrency(monthlyInterest, currency)}
          </span>
          <p className="text-[10px] text-z-debt/70">en intereses</p>
        </div>
      </div>

      {/* Verdict — derived from the same capital-vs-interest trend as the
          desktop DebtHeroCard (see deriveDebtVerdict), never hardcoded: a
          negative-amortization month (interest > cuota) must show
          te-pasaste, not a false vas-bien. */}
      <div className="mt-2">
        <Verdict state={verdictState} delta={verdictDelta} detail={verdictDetail} />
      </div>

      {/* Split bar */}
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
        <div
          className="bg-gradient-to-r from-z-white/95 to-z-white/70"
          style={{ width: `${capitalPct}%` }}
        />
        <div
          className="bg-gradient-to-r from-z-debt/80 to-z-debt/50"
          style={{ width: `${interestPct}%` }}
        />
      </div>

      {/* Footer */}
      <div className="mt-2">
        <span className="text-[10px] text-muted-foreground">
          {capitalPct}% capital · {interestPct}% costo financiero
        </span>
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
              <div className={cn(PANEL_INSET_CLASS, "bg-black/20 p-3 space-y-2")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
                  Desglose por cuenta
                </p>
                {accounts.map((acct) => {
                  const isCC = acct.type === "CREDIT_CARD";
                  return (
                    <div key={acct.id} className="flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-z-sage-light">{acct.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {isCC ? "Tarjeta" : "Préstamo"} · {acct.interestRate > 0 ? `${acct.interestRate.toFixed(1)}% EA` : "Sin tasa"}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold text-foreground tabular-nums">
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
