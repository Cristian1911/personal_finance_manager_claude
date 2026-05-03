import type {
  PurchaseFundingType,
  PurchaseUrgency,
} from "@zeta/shared";
import {
  getActiveWishlistItems,
  getWishlistItemById,
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

const GREEN_VERDICTS = new Set<string>(["BUY", "BUY_WITH_CAUTION"]);

/**
 * Score one item against a snapshot, persist the fresh score (skip when
 * unchanged), and return the merged result. Shared between the bulk
 * `getWishlistItemsWithFreshScores` and single-item `rescoreWishlistItem`
 * paths so the persist + ready_at transition logic lives in one place.
 */
async function applyScore(
  item: WishlistItemWithCategory,
  snapshot: FinancialSnapshot,
  userId: string
): Promise<ScoredWishlistItem | null> {
  if (!item.urgency || !item.funding_type) return null;

  const result = scoreWishlistItemWithSnapshot({
    amount: item.amount,
    urgency: item.urgency as PurchaseUrgency,
    fundingType: item.funding_type as PurchaseFundingType,
    installments: item.installments,
    accountId: item.account_id,
    snapshot,
  });
  if (!result) return null;

  const wasGreen = GREEN_VERDICTS.has(item.last_verdict ?? "");
  const isGreen = GREEN_VERDICTS.has(result.verdict);
  const newReadyAt =
    isGreen && !wasGreen && !item.ready_at ? new Date().toISOString() : null;

  // Skip the write when nothing changed — saves a SQLite UPDATE + sync_queue
  // INSERT per item on the typical "open Deseos, nothing changed" focus.
  const scoreUnchanged =
    result.score === item.last_score &&
    result.verdict === item.last_verdict &&
    !newReadyAt;

  if (!scoreUnchanged) {
    try {
      await persistWishlistScore({
        id: item.id,
        user_id: userId,
        last_score: result.score,
        last_verdict: result.verdict,
        ready_at: newReadyAt,
      });
    } catch (err) {
      console.warn("[wishlist] persistScore failed:", err);
    }
  }

  return {
    ...item,
    last_score: result.score,
    last_verdict: result.verdict,
    ready_at: newReadyAt ?? item.ready_at,
    freshScore: result.score,
    freshVerdict: result.verdict,
    scoreError: false,
  };
}

/**
 * Mobile equivalent of webapp `getWishlistItemsWithFreshScores`.
 *
 * Fetches active items from SQLite, builds the financial snapshot once, scores
 * every enriched item, and persists fresh scores back to the local DB. Items
 * missing enrichment fall through with their cached `last_score`.
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
  }

  return Promise.all(
    items.map(async (item): Promise<ScoredWishlistItem> => {
      if (!snapshot || !item.enriched) {
        return {
          ...item,
          freshScore: item.last_score,
          freshVerdict: item.last_verdict,
          scoreError: false,
        };
      }
      try {
        const scored = await applyScore(item, snapshot, params.user_id);
        return (
          scored ?? {
            ...item,
            freshScore: item.last_score,
            freshVerdict: item.last_verdict,
            scoreError: false,
          }
        );
      } catch (err) {
        console.warn("[wishlist] score failed for item:", item.id, err);
        return {
          ...item,
          freshScore: item.last_score,
          freshVerdict: item.last_verdict,
          scoreError: true,
        };
      }
    })
  );
}

/** Re-score a single item — used after enrichment or manual retry. */
export async function rescoreWishlistItem(params: {
  id: string;
  user_id: string;
}): Promise<void> {
  const item = await getWishlistItemById(params.id, params.user_id);
  if (!item || !item.enriched) return;

  let snapshot: FinancialSnapshot;
  try {
    snapshot = await getFinancialSnapshot(toLocalMonthString());
  } catch {
    return;
  }

  await applyScore(item, snapshot, params.user_id);
}
