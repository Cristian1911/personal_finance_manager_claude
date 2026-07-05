/**
 * Auto-link confidence rules for matching a transaction to a pending
 * recurring occurrence — shared so the webapp (`findMatchingOccurrence`) and
 * mobile (`findAndLinkLocalOccurrence`) can never drift apart.
 *
 * Auto-linking has no user in the loop, so the amount tolerance is tiered by
 * signal strength:
 * - ANCHORED (the transaction's destinatario matches the template's
 *   destinatario): the merchant link is the strong signal, so a wide band
 *   absorbs fees, exchange variance, and partial payments.
 * - UNANCHORED: amount proximity alone must be near-exact, so an unrelated
 *   import never silently pays a template's occurrence.
 *
 * Manual "Vincular" flows may use wider windows — a human confirms those.
 */

/** Days on either side of the occurrence date an auto-link will consider. */
export const OCCURRENCE_AUTO_LINK_DAY_WINDOW = 3;

/** Anchored band: |expected − amount| / expected ≤ this. */
export const OCCURRENCE_ANCHORED_TOLERANCE = 0.5;

/** Unanchored band: |expected − amount| ≤ amount × this. */
export const OCCURRENCE_UNANCHORED_TOLERANCE = 0.01;

/**
 * True when `txAmount` is close enough to `expectedAmount` to auto-link,
 * given whether the destinatario anchor holds. Non-positive expected amounts
 * never match (occurrences with no meaningful expected amount).
 */
export function occurrenceAmountMatches(
  expectedAmount: number,
  txAmount: number,
  anchored: boolean
): boolean {
  if (expectedAmount <= 0) return false;
  return anchored
    ? Math.abs(expectedAmount - txAmount) / expectedAmount <=
        OCCURRENCE_ANCHORED_TOLERANCE
    : Math.abs(expectedAmount - txAmount) <=
        txAmount * OCCURRENCE_UNANCHORED_TOLERANCE;
}
