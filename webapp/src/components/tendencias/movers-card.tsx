import type { Mover } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

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
          <span className="hidden text-[11px] tabular-nums text-z-sage-dark sm:inline">
            {formatCurrency(m.from, currency)} → {formatCurrency(m.to, currency)}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              m.deltaPct > 0 ? "bg-z-expense/12 text-z-expense" : "bg-z-income/10 text-z-income"
            }`}
          >
            {m.deltaPct > 0 ? "▲" : "▼"} {Math.abs(Math.round(m.deltaPct))}%
          </span>
        </div>
      ))}
    </div>
  );
}
