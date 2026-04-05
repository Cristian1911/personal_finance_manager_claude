import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { StateChip } from "@/components/mobile/v2/state-chip";
import type { CurrencyCode } from "@/types/domain";
import type { DebtStats } from "@zeta/shared";

interface DeudasFocusProps {
  stats: DebtStats;
  currency: CurrencyCode;
}

export function DeudasFocus({ stats, currency }: DeudasFocusProps) {
  const dominant = stats.highestPayment;
  if (!dominant || dominant.amount <= 0) return null;

  const pct = stats.totalMonthlyPayment > 0
    ? Math.round((dominant.amount / stats.totalMonthlyPayment) * 100)
    : 0;

  return (
    <div className={cn(PANEL_INSET_CLASS, "p-3.5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold">La deuda que domina el mes</p>
          <div className="mt-2 rounded-xl border border-z-alert/20 bg-z-alert/[0.06] px-3 py-2.5">
            <strong className="text-[12px] font-semibold">{dominant.accountName}</strong>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {pct}% de tu cuota · mayor impacto si abonas más
            </p>
          </div>
        </div>
        <StateChip label="Ahora" variant="warn" className="mt-1 shrink-0" />
      </div>
    </div>
  );
}
