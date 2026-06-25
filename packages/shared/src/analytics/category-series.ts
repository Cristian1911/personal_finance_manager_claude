import type { AnalyticsConfig, AnalyticsTx, CategoryTrend, Mover } from "./types";

export function categorySeries(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): CategoryTrend[] {
  const monthIndex = new Map(cfg.months.map((m, i) => [m, i]));
  const byCat = new Map<string, number[]>();
  for (const t of rows) {
    if (t.direction !== "OUTFLOW" || t.categoryId == null) continue;
    const mi = monthIndex.get(t.date.slice(0, 7));
    if (mi === undefined) continue;
    let arr = byCat.get(t.categoryId);
    if (!arr) {
      arr = new Array(cfg.months.length).fill(0);
      byCat.set(t.categoryId, arr);
    }
    arr[mi] += t.amount;
  }
  const out: CategoryTrend[] = [];
  for (const [categoryId, monthly] of byCat) {
    const meta = cfg.categoryMeta.get(categoryId);
    const total = monthly.reduce((a, b) => a + b, 0);
    const prev = monthly[monthly.length - 2] ?? 0;
    const last = monthly[monthly.length - 1] ?? 0;
    const momPct = prev === 0 ? null : ((last - prev) / prev) * 100;
    out.push({
      categoryId,
      nameEs: meta?.nameEs ?? "Sin categoría",
      color: meta?.color ?? "#768053",
      monthly,
      total,
      momPct,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

export function movers(series: readonly CategoryTrend[], limit = 4): Mover[] {
  return series
    .filter((c) => c.momPct !== null && c.monthly.length >= 2)
    .map((c) => ({
      categoryId: c.categoryId,
      nameEs: c.nameEs,
      color: c.color,
      from: c.monthly[c.monthly.length - 2],
      to: c.monthly[c.monthly.length - 1],
      deltaPct: c.momPct as number,
    }))
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, limit);
}
