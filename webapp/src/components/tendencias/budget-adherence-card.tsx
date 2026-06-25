import type { AdherencePoint } from "@zeta/shared";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";

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
            {a.momPct !== null && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  a.momPct > 0 ? "bg-z-expense/12 text-z-expense" : "bg-z-income/10 text-z-income"
                }`}
              >
                {a.momPct > 0 ? "▲" : "▼"} {Math.abs(Math.round(a.momPct))}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
