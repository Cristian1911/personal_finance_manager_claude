import { differenceInCalendarDays, parseISO } from "date-fns";

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

// ─── Debt-account payments (credit card / loan) ──────────────────────────────
//
// A payment to a card made after the statement cut and before the due date
// usually carries that statement's minimum — but not always: it can be a pure
// extra contribution and the minimum still gets paid separately. The amount
// almost never equals the minimum either. So these are NEVER auto-linked; the
// UI asks the user ("¿este abono incluye la cuota del 1 sep?") and links only
// on a yes. These helpers decide when that question is worth asking.

/**
 * Days BEFORE the due date a payment can still plausibly carry the minimum.
 * Colombian card cycles cut ~15–20 days before the due date; 21 keeps a
 * payment made right after the cut inside the window while a payment from
 * the previous cycle (a late payment of the prior minimum) stays out.
 */
export const DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS = 21;

/**
 * True when `txAmount` is at least the occurrence's expected amount (the
 * minimum), within the unanchored tolerance so a rounded payment
 * (219,591 vs 219,591.28) still counts.
 */
export function debtPaymentCoversOccurrence(
  expectedAmount: number,
  txAmount: number,
): boolean {
  if (expectedAmount <= 0 || txAmount <= 0) return false;
  return txAmount >= expectedAmount * (1 - OCCURRENCE_UNANCHORED_TOLERANCE);
}

/**
 * True when a payment dated `txDate` falls where it could carry the occurrence
 * due on `occurrenceDate`: up to DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS before it,
 * or inside the regular ±OCCURRENCE_AUTO_LINK_DAY_WINDOW after it.
 * Both arguments are bare ISO dates (YYYY-MM-DD).
 */
export function isDebtPaymentInCoverWindow(
  occurrenceDate: string,
  txDate: string,
): boolean {
  const daysUntilDue = differenceInCalendarDays(
    parseISO(occurrenceDate),
    parseISO(txDate),
  );
  return (
    daysUntilDue >= -OCCURRENCE_AUTO_LINK_DAY_WINDOW &&
    daysUntilDue <= DEBT_PAYMENT_COVER_LOOKAHEAD_DAYS
  );
}

/**
 * The pending occurrence a debt payment most plausibly carries: the earliest
 * due one inside the cover window whose expected amount the payment covers.
 * Returns null when there is nothing worth asking about.
 */
export function pickCoveredDebtOccurrence<
  T extends { occurrenceDate: string; expectedAmount: number },
>(txDate: string, txAmount: number, candidates: T[]): T | null {
  let best: T | null = null;
  for (const c of candidates) {
    if (!isDebtPaymentInCoverWindow(c.occurrenceDate, txDate)) continue;
    if (!debtPaymentCoversOccurrence(c.expectedAmount, txAmount)) continue;
    if (!best || c.occurrenceDate < best.occurrenceDate) best = c;
  }
  return best;
}
