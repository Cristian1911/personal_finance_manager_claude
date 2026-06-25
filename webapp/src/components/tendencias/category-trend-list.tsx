import type { CategoryTrend } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points, 1);
  const w = 56;
  const h = 18;
  const d = points
    .map((p, i) => `${(i / Math.max(points.length - 1, 1)) * w},${h - (p / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function CategoryTrendList({ categories, currency }: { categories: CategoryTrend[]; currency: CurrencyCode }) {
  if (categories.length === 0) {
    return (
      <div className={`${PANEL_SURFACE_CLASS} p-6 text-center text-sm text-z-sage-dark`}>
        Sin gastos categorizados en el periodo.
      </div>
    );
  }
  return (
    <div className={`${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-3 text-sm font-semibold">Gasto por categoría</p>
      {categories.slice(0, 8).map((c) => (
        <div key={c.categoryId} className="flex items-center gap-3 border-t border-white/6 py-2 first:border-t-0">
          <span className="size-2.5 shrink-0 rounded" style={{ background: c.color }} />
          <span className="min-w-0 flex-1 truncate text-sm">{c.nameEs}</span>
          <Sparkline points={c.monthly} color={c.color} />
          <span className="text-sm font-semibold tabular-nums">{formatCurrency(c.total, currency)}</span>
          {c.momPct !== null && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                c.momPct > 0 ? "bg-z-expense/12 text-z-expense" : c.momPct < 0 ? "bg-z-income/10 text-z-income" : "text-z-sage-dark"
              }`}
            >
              {c.momPct > 0 ? "▲" : c.momPct < 0 ? "▼" : "~"} {Math.abs(Math.round(c.momPct))}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
