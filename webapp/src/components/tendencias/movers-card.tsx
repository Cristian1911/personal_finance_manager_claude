import type { Mover } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";
import { DeltaChip } from "./delta-chip";

export function MoversCard({ movers, currency }: { movers: Mover[]; currency: CurrencyCode }) {
  if (movers.length === 0) {
    return (
      <div className={`${PANEL_SURFACE_CLASS} p-6 text-center text-sm text-z-sage-dark`}>
        Sin cambios destacados en el periodo.
      </div>
    );
  }
  return (
    <div className={`${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-3 text-sm font-semibold">Cambios destacados</p>
      {movers.map((m) => (
        <div key={m.categoryId} className="flex items-center gap-3 border-t border-white/6 py-2 first:border-t-0">
          <span className="size-2.5 shrink-0 rounded" style={{ background: m.color }} />
          <span className="min-w-0 flex-1 truncate text-sm">{m.nameEs}</span>
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-z-sage-dark">
            {formatCurrency(m.from, currency)} → {formatCurrency(m.to, currency)}
          </span>
          <DeltaChip pct={m.deltaPct} />
        </div>
      ))}
    </div>
  );
}
