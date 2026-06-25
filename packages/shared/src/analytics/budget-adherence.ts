import { categorySeries } from "./category-series";
import type { AdherencePoint, AnalyticsConfig, AnalyticsTx, CategoryTrend } from "./types";

// Pass `series` to reuse an already-computed categorySeries (avoids recomputation).
export function budgetAdherenceSeries(
  rows: readonly AnalyticsTx[],
  cfg: AnalyticsConfig,
  series?: readonly CategoryTrend[],
): AdherencePoint[] {
  const out: AdherencePoint[] = [];
  for (const c of series ?? categorySeries(rows, cfg)) {
    const target = cfg.categoryMeta.get(c.categoryId)?.budgetTarget ?? null;
    if (target === null || target <= 0) continue;
    let within = 0;
    let exceeded = 0;
    for (const m of c.monthly) {
      if (m > target) exceeded++;
      else within++;
    }
    out.push({ categoryId: c.categoryId, nameEs: c.nameEs, target, monthsWithin: within, monthsExceeded: exceeded, momPct: c.momPct });
  }
  return out.sort((a, b) => b.monthsExceeded - a.monthsExceeded);
}
