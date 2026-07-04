"use client";

import { Card } from "@/components/ui/card";
import { Verdict } from "@/components/ui/verdict";
import { formatCurrency } from "@/lib/utils/currency";
import { deriveDebtVerdict } from "@/lib/utils/debt-verdict";
import { Landmark, Flame } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";
import type { DebtByCurrency } from "@zeta/shared";

interface DebtHeroCardProps {
  totalDebt: number;
  totalMonthlyPayment: number;
  monthlyInterest: number;
  secondaryCurrencies?: DebtByCurrency[];
  currency: CurrencyCode;
}

export function DebtHeroCard({
  totalDebt,
  totalMonthlyPayment,
  monthlyInterest,
  secondaryCurrencies,
  currency,
}: DebtHeroCardProps) {
  const {
    state: verdictState,
    delta: verdictDelta,
    detail: verdictDetail,
  } = deriveDebtVerdict({ totalDebt, totalMonthlyPayment, monthlyInterest, currency });

  return (
    <Card className="rounded-2xl p-3">
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
        {/* Left: Debt + Monthly Payment */}
        <div className="rounded-xl border border-z-expense/15 bg-gradient-to-br from-z-expense/8 to-z-expense/4 p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-z-expense/10">
              <Landmark className="h-7 w-7 text-z-expense" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Deuda total</p>
              <p className="text-2xl sm:text-3xl font-bold truncate">
                {formatCurrency(totalDebt, currency)}
              </p>
              {secondaryCurrencies && secondaryCurrencies.length > 0 && (
                <div className="flex gap-2 mt-1">
                  {secondaryCurrencies.map((d) => (
                    <p key={d.currency} className="text-sm text-muted-foreground">
                      + {formatCurrency(d.totalDebt, d.currency as CurrencyCode)}
                    </p>
                  ))}
                </div>
              )}
              <Verdict
                className="mt-2"
                state={verdictState}
                delta={verdictDelta}
                detail={verdictDetail}
              />
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Pagas al mes</p>
              <p className="text-xl sm:text-2xl font-bold">
                {formatCurrency(totalMonthlyPayment, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Interest Banner */}
        <div className="rounded-xl border border-z-expense/25 bg-gradient-to-br from-z-expense/12 to-z-expense/6 p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-z-expense/15">
              <Flame className="h-4 w-4 text-z-expense" />
            </div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Intereses / mes
            </p>
          </div>
          <p className="text-2xl font-bold text-z-expense">
            {formatCurrency(monthlyInterest, currency)}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Dinero que no reduce tu deuda
          </p>
        </div>
      </div>
    </Card>
  );
}
