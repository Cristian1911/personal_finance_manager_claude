import type { AnalyticsConfig, AnalyticsTx, FixedVariable } from "./types";

export function fixedVsVariable(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): FixedVariable {
  const idx = new Map(cfg.months.map((m, i) => [m, i]));
  let fixed = 0;
  let variable = 0;
  const variableSeries = new Array(cfg.months.length).fill(0);
  for (const t of rows) {
    if (t.direction !== "OUTFLOW") continue;
    const mi = idx.get(t.date.slice(0, 7));
    if (mi === undefined) continue;
    if (t.expenseType === "fixed") {
      fixed += t.amount;
    } else {
      variable += t.amount;
      variableSeries[mi] += t.amount;
    }
  }
  const prev = variableSeries[variableSeries.length - 2] ?? 0;
  const last = variableSeries[variableSeries.length - 1] ?? 0;
  return { fixed, variable, variableMoM: prev === 0 ? null : ((last - prev) / prev) * 100, variableSeries };
}
