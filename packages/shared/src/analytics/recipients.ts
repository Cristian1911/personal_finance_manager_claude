import type { AnalyticsConfig, AnalyticsTx, RecipientRank } from "./types";

const NONE = "__none__";

export function topRecipients(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig, limit = 5): RecipientRank[] {
  const monthSet = new Set(cfg.months);
  const lastMonth = cfg.months[cfg.months.length - 1];
  const prevMonth = cfg.months[cfg.months.length - 2];
  const agg = new Map<string, { total: number; count: number; last: number; prev: number }>();
  let grand = 0;
  for (const t of rows) {
    if (t.direction !== "OUTFLOW") continue;
    const m = t.date.slice(0, 7);
    if (!monthSet.has(m)) continue;
    const key = t.destinatarioId ?? NONE;
    let e = agg.get(key);
    if (!e) {
      e = { total: 0, count: 0, last: 0, prev: 0 };
      agg.set(key, e);
    }
    e.total += t.amount;
    e.count += 1;
    grand += t.amount;
    if (m === lastMonth) e.last += t.amount;
    else if (m === prevMonth) e.prev += t.amount;
  }
  return [...agg.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, limit)
    .map(([key, e]) => {
      const meta = key === NONE ? undefined : cfg.destinatarioMeta.get(key);
      return {
        destinatarioId: key === NONE ? null : key,
        name: meta?.name ?? "Sin asignar",
        color: meta?.color ?? "#938C7E",
        total: e.total,
        count: e.count,
        momPct: e.prev === 0 ? null : ((e.last - e.prev) / e.prev) * 100,
        share: grand === 0 ? 0 : e.total / grand,
      };
    });
}

// ponytail: cap the full recipient payload at 150 by spend. Beyond that the
// search/expand UI is unusable and the RSC payload bloats; nobody scrolls a
// 600-merchant list. Search + drilldown operate within this ceiling.
// Trade-off: all N capped recipients ship in the RSC payload so client-side
// search needs no second fetch; raising this cap meaningfully grows the payload
// — paginate / lazy-fetch instead if it must grow.
export const RECIPIENT_FULL_CEILING = 150;

/** Full ranked recipient list (capped at RECIPIENT_FULL_CEILING) for the
 *  interactive "¿A dónde va?" accordion — search + per-row drilldown. */
export function allRecipients(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): RecipientRank[] {
  return topRecipients(rows, cfg, RECIPIENT_FULL_CEILING);
}
