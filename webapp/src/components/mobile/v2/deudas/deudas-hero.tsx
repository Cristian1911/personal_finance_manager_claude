import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { StateChip } from "@/components/mobile/v2/state-chip";
import type { CurrencyCode } from "@/types/domain";

interface DeudasHeroProps {
  totalMonthlyPayment: number;
  monthlyInterest: number;
  currency: CurrencyCode;
}

export function DeudasHero({
  totalMonthlyPayment,
  monthlyInterest,
  currency,
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
    <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
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
    </div>
  );
}
