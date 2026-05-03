import type { WishlistItemRow } from "../repositories/wishlist";

export type WishlistNudge = {
  type: "desire_maturity" | "score_transition";
  itemId: string;
  itemName: string;
  message: string;
};

const DAY_MS = 1000 * 60 * 60 * 24;
const PRIORITY: WishlistNudge["type"][] = ["score_transition", "desire_maturity"];

/**
 * Mobile equivalent of webapp `getActiveNudges()`. Computes nudges purely from
 * already-loaded items — no extra DB hit. Mobile only emits the two nudge types
 * derivable from `wishlist_items` columns alone:
 *  - `score_transition`: `ready_at` within 7d AND verdict is green.
 *  - `desire_maturity`: 30+ days old AND green AND score >= 55.
 *
 * `debt_milestone` and `budget_surplus` (webapp) require server-side
 * cross-referencing and are deferred. Returns at most 1 nudge.
 */
export function computeActiveNudges(items: WishlistItemRow[]): WishlistNudge[] {
  const now = Date.now();
  const candidates: WishlistNudge[] = [];

  for (const item of items) {
    if (item.status !== "wishlist" || !item.enriched) continue;

    if (item.last_nudge_dismissed_at) {
      const dismissedAt = new Date(item.last_nudge_dismissed_at).getTime();
      if (Number.isFinite(dismissedAt) && now - dismissedAt < 24 * 60 * 60 * 1000) continue;
    }

    const isGreen =
      item.last_verdict === "BUY" || item.last_verdict === "BUY_WITH_CAUTION";
    const score = item.last_score ?? 0;

    if (item.ready_at) {
      const readyAt = new Date(item.ready_at).getTime();
      const daysSinceReady = (now - readyAt) / DAY_MS;
      if (daysSinceReady <= 7 && isGreen) {
        candidates.push({
          type: "score_transition",
          itemId: item.id,
          itemName: item.name,
          message: `"${item.name}" acaba de pasar a verde. Tu situación financiera permite esta compra.`,
        });
      }
    }

    const createdAt = new Date(item.created_at).getTime();
    const daysSinceCreated = (now - createdAt) / DAY_MS;
    if (daysSinceCreated >= 30 && isGreen && score >= 55) {
      candidates.push({
        type: "desire_maturity",
        itemId: item.id,
        itemName: item.name,
        message: `Llevas más de 30 días queriendo "${item.name}" y tu puntaje es favorable. ¿Es hora de decidir?`,
      });
    }
  }

  candidates.sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));
  return candidates.slice(0, 1);
}
