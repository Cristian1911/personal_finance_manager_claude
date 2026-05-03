import type { PurchaseDecisionResult } from "@zeta/shared";
import {
  getActiveWishlistItems,
  persistWishlistScore,
  type WishlistItemWithCategory,
} from "../repositories/wishlist";
import { toLocalMonthString } from "../utils/date";
import {
  getFinancialSnapshot,
  scoreWishlistItemWithSnapshot,
  type FinancialSnapshot,
} from "./purchase-decision";

export type ScoredWishlistItem = WishlistItemWithCategory & {
  freshScore: number | null;
  freshVerdict: string | null;
  scoreError: boolean;
};

/**
 * Mobile equivalent of webapp `getWishlistItemsWithFreshScores`.
 *
 * Fetches active items from SQLite, builds the financial snapshot once, scores
 * every enriched item, and persists fresh scores back to the local DB (with
 * sync queue entries). Items missing enrichment fall through with their cached
 * `last_score`.
 *
 * Persistence is best-effort — if the local update fails, the in-memory result
 * is still returned so the UI can render.
 */
export async function getWishlistItemsWithFreshScores(params: {
  user_id: string;
}): Promise<ScoredWishlistItem[]> {
  const items = await getActiveWishlistItems();

  let snapshot: FinancialSnapshot | null = null;
  try {
    snapshot = await getFinancialSnapshot(toLocalMonthString());
  } catch (err) {
    console.warn("[wishlist] snapshot failed:", err);
    snapshot = null;
  }

  const scored = await Promise.all(
    items.map(async (item) => {
      if (!snapshot || !item.enriched || !item.urgency || !item.funding_type) {
        return {
          ...item,
          freshScore: item.last_score,
          freshVerdict: item.last_verdict,
          scoreError: false,
        } satisfies ScoredWishlistItem;
      }

      try {
        const result = scoreWishlistItemWithSnapshot({
          amount: item.amount,
          urgency: item.urgency as Parameters<
            typeof scoreWishlistItemWithSnapshot
          >[0]["urgency"],
          fundingType: item.funding_type as Parameters<
            typeof scoreWishlistItemWithSnapshot
          >[0]["fundingType"],
          installments: item.installments,
          accountId: item.account_id,
          snapshot,
        });

        if (!result) {
          return {
            ...item,
            freshScore: item.last_score,
            freshVerdict: item.last_verdict,
            scoreError: false,
          } satisfies ScoredWishlistItem;
        }

        const wasGreen =
          item.last_verdict === "BUY" || item.last_verdict === "BUY_WITH_CAUTION";
        const isGreen =
          result.verdict === "BUY" || result.verdict === "BUY_WITH_CAUTION";
        const newReadyAt =
          isGreen && !wasGreen && !item.ready_at ? new Date().toISOString() : null;

        try {
          await persistWishlistScore({
            id: item.id,
            user_id: params.user_id,
            last_score: result.score,
            last_verdict: result.verdict,
            ready_at: newReadyAt,
          });
        } catch (err) {
          console.warn("[wishlist] persistScore failed:", err);
        }

        return {
          ...item,
          last_score: result.score,
          last_verdict: result.verdict,
          ready_at: newReadyAt ?? item.ready_at,
          freshScore: result.score,
          freshVerdict: result.verdict,
          scoreError: false,
        } satisfies ScoredWishlistItem;
      } catch (err) {
        console.warn("[wishlist] score failed for item:", item.id, err);
        return {
          ...item,
          freshScore: item.last_score,
          freshVerdict: item.last_verdict,
          scoreError: true,
        } satisfies ScoredWishlistItem;
      }
    })
  );

  return scored;
}

/** Re-score a single item — used after enrichment or manual retry. */
export async function rescoreWishlistItem(params: {
  id: string;
  user_id: string;
}): Promise<PurchaseDecisionResult | null> {
  const items = await getActiveWishlistItems();
  const item = items.find((i) => i.id === params.id);
  if (!item || !item.enriched || !item.urgency || !item.funding_type) return null;

  let snapshot: FinancialSnapshot;
  try {
    snapshot = await getFinancialSnapshot(toLocalMonthString());
  } catch {
    return null;
  }

  const result = scoreWishlistItemWithSnapshot({
    amount: item.amount,
    urgency: item.urgency as Parameters<
      typeof scoreWishlistItemWithSnapshot
    >[0]["urgency"],
    fundingType: item.funding_type as Parameters<
      typeof scoreWishlistItemWithSnapshot
    >[0]["fundingType"],
    installments: item.installments,
    accountId: item.account_id,
    snapshot,
  });
  if (!result) return null;

  const wasGreen =
    item.last_verdict === "BUY" || item.last_verdict === "BUY_WITH_CAUTION";
  const isGreen =
    result.verdict === "BUY" || result.verdict === "BUY_WITH_CAUTION";
  const newReadyAt =
    isGreen && !wasGreen && !item.ready_at ? new Date().toISOString() : null;

  try {
    await persistWishlistScore({
      id: item.id,
      user_id: params.user_id,
      last_score: result.score,
      last_verdict: result.verdict,
      ready_at: newReadyAt,
    });
  } catch (err) {
    console.warn("[wishlist] persistScore failed:", err);
  }

  return result;
}
