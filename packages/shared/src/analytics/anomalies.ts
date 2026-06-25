import { categorySeries } from "./category-series";
import type { Anomaly, AnalyticsConfig, AnalyticsTx, CategoryTrend } from "./types";

// ponytail: threshold heuristic — max(2.5x trailing-3mo mean, mean+2sigma). Tune the
// constants here if the false-positive rate is wrong; upgrade path is seasonal baselines.
// Pass `series` to reuse an already-computed categorySeries (avoids recomputation).
export function anomalies(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig, series?: readonly CategoryTrend[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const c of series ?? categorySeries(rows, cfg)) {
    for (let i = 0; i < c.monthly.length; i++) {
      const hist = c.monthly.slice(Math.max(0, i - 3), i);
      if (hist.length < 2) continue;
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      if (mean <= 0) continue;
      const variance = hist.reduce((a, b) => a + (b - mean) ** 2, 0) / hist.length;
      const threshold = Math.max(mean * 2.5, mean + 2 * Math.sqrt(variance));
      const value = c.monthly[i];
      if (value > 0 && value >= threshold) {
        out.push({ categoryId: c.categoryId, nameEs: c.nameEs, month: cfg.months[i], amount: value, baseline: mean, multiple: value / mean });
      }
    }
  }
  return out.sort((a, b) => b.multiple - a.multiple);
}
