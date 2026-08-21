/**
 * Transfer legs in a transaction feed.
 *
 * A transfer is two rows sharing a `transfer_group_id` — money leaving one
 * account and landing in another. Rendered as two independent rows they read as
 * a spend and an income that never happened, so every feed collapses a pair into
 * a single row.
 *
 * Two rules keep that honest:
 *
 * 1. **The anchor is always a row of this page.** A pair renders as its on-page
 *    leg (`tx`) plus counterpart data — never the other way round. The row's
 *    date, its link, its tags and every action therefore belong to a transaction
 *    the user is actually looking at.
 * 2. **A pair is emitted once.** Legs can sit up to 3 days apart, so pairing runs
 *    over the whole slice and the caller buckets the result afterwards; pairing
 *    per day group would emit the same pair under each date.
 *
 * A leg whose partner isn't available still renders on its own, just without the
 * misleading +/− treatment.
 */

export interface TransferLeg {
  id: string;
  direction: "INFLOW" | "OUTFLOW";
  transfer_group_id: string | null;
}

export type TransferFeedItem<T extends TransferLeg, L extends TransferLeg = T> =
  /** A normal transaction, or a transfer leg whose partner isn't available. */
  | { kind: "single"; tx: T }
  /** A transfer: `tx` is on this page, `counterpart` may come from `extraLegs`. */
  | { kind: "pair"; tx: T; counterpart: T | L };

/**
 * Collapses transfer pairs in `txs`, preserving feed order: the pair takes the
 * position of its on-page leg.
 *
 * A group only collapses when exactly one OUTFLOW and one INFLOW are available.
 * A malformed group (both legs same direction, a third leg) degrades to singles
 * rather than guessing.
 */
export function groupTransferPairs<T extends TransferLeg, L extends TransferLeg = T>(
  txs: T[],
  /**
   * Legs fetched only to complete pairs the slice cut in half (see
   * `getTransferLegs`). They supply the counterpart half of a row and never
   * become rows of their own — they aren't part of this page.
   */
  extraLegs: L[] = [],
): TransferFeedItem<T, L>[] {
  const onPage = new Map<string, T[]>();
  for (const tx of txs) {
    if (!tx.transfer_group_id) continue;
    const legs = onPage.get(tx.transfer_group_id);
    if (legs) legs.push(tx);
    else onPage.set(tx.transfer_group_id, [tx]);
  }

  const onPageIds = new Set(txs.map((t) => t.id));
  const offPage = new Map<string, L[]>();
  for (const leg of extraLegs) {
    if (!leg.transfer_group_id || onPageIds.has(leg.id)) continue;
    // Only complete groups the page actually shows — never introduce a new one.
    if (!onPage.has(leg.transfer_group_id)) continue;
    const legs = offPage.get(leg.transfer_group_id);
    if (legs) legs.push(leg);
    else offPage.set(leg.transfer_group_id, [leg]);
  }

  const items: TransferFeedItem<T, L>[] = [];
  const consumed = new Set<string>();

  for (const tx of txs) {
    if (consumed.has(tx.id)) continue;
    if (!tx.transfer_group_id) {
      items.push({ kind: "single", tx });
      continue;
    }

    const sameGroup = onPage.get(tx.transfer_group_id) ?? [];
    const opposite = tx.direction === "OUTFLOW" ? "INFLOW" : "OUTFLOW";

    // Prefer a partner that is already on the page — pairing it here also stops
    // it from rendering a second row of its own.
    const onPagePartners = sameGroup.filter((l) => l.direction === opposite);
    if (sameGroup.length === 2 && onPagePartners.length === 1) {
      consumed.add(tx.id);
      consumed.add(onPagePartners[0].id);
      items.push({ kind: "pair", tx, counterpart: onPagePartners[0] });
      continue;
    }

    // Otherwise complete it from the extra legs, but only if this group has a
    // single leg here and a single opposite leg there — anything else is
    // ambiguous and stays as a plain row.
    const offPagePartners = (offPage.get(tx.transfer_group_id) ?? []).filter(
      (l) => l.direction === opposite,
    );
    if (sameGroup.length === 1 && offPagePartners.length === 1) {
      consumed.add(tx.id);
      items.push({ kind: "pair", tx, counterpart: offPagePartners[0] });
      continue;
    }

    items.push({ kind: "single", tx });
  }

  return items;
}
