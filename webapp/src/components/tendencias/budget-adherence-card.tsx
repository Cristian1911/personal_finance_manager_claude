import type { AdherencePoint } from "@zeta/shared";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { DeltaChip } from "./delta-chip";

export function BudgetAdherenceCard({ adherence }: { adherence: AdherencePoint[] }) {
  if (adherence.length === 0) return null;
  return (
    <div className={`mt-3 ${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-3 text-sm font-semibold">Cumplimiento de presupuesto</p>
      {adherence.slice(0, 6).map((a) => {
        const total = a.monthsWithin + a.monthsExceeded;
        return (
          <div key={a.categoryId} className="flex items-center gap-3 border-t border-white/6 py-2 first:border-t-0">
            <span className="min-w-0 flex-1 truncate text-sm">{a.nameEs}</span>
            <span className="text-[11px] text-z-sage-dark">
              {a.monthsExceeded > 0 ? `excedido ${a.monthsExceeded} de ${total}` : `dentro ${a.monthsWithin} de ${total}`}
            </span>
            {a.momPct !== null && <DeltaChip pct={a.momPct} />}
          </div>
        );
      })}
    </div>
  );
}
