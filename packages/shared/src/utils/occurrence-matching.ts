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

// ─── Manual "Vincular" ranking ───────────────────────────────────────────────
//
// The link pickers (occurrence → transaction, transaction → occurrence) rank
// candidates for a human to confirm. Date and amount alone let an unrelated
// same-week charge outrank last cycle's charge from the very merchant the
// template tracks, so merchant identity is a first-class signal here:
// destinatario anchor > destinatario rule hit > merchant-name token overlap.

/** Days after which date proximity contributes nothing to the rank. */
export const OCCURRENCE_RANK_DAY_HORIZON = 30;

export const OCCURRENCE_RANK_WEIGHTS = {
  date: 0.4,
  amount: 0.3,
  identity: 0.3,
} as const;

export interface OccurrenceCandidateSignals {
  /** Calendar days between the transaction date and the occurrence date. */
  dayDiff: number;
  /** The occurrence's expected amount (the reference). */
  expectedAmount: number;
  /** The transaction's amount. */
  amount: number;
  /** Merchant identity signal in [0, 1] — see `occurrenceIdentityScore`. */
  identity: number;
}

/**
 * Composite rank in [0, 1] for a link-picker candidate. Deterministic and
 * shared so webapp and mobile pickers order the same rows the same way.
 */
export function scoreOccurrenceCandidate(
  signals: OccurrenceCandidateSignals
): number {
  const dateScore = Math.max(
    0,
    1 - Math.abs(signals.dayDiff) / OCCURRENCE_RANK_DAY_HORIZON
  );
  const amountScore =
    signals.expectedAmount > 0
      ? Math.max(
          0,
          1 -
            Math.abs(signals.amount - signals.expectedAmount) /
              signals.expectedAmount
        )
      : 0;
  const identity = Math.min(1, Math.max(0, signals.identity));
  return (
    dateScore * OCCURRENCE_RANK_WEIGHTS.date +
    amountScore * OCCURRENCE_RANK_WEIGHTS.amount +
    identity * OCCURRENCE_RANK_WEIGHTS.identity
  );
}

/** Whole calendar days between two YYYY-MM-DD dates (Colombia has no DST). */
export function calendarDayDiff(a: string, b: string): number {
  const ms =
    Date.parse(`${a}T12:00:00`) - Date.parse(`${b}T12:00:00`);
  return Math.abs(Math.round(ms / 86_400_000));
}

const IDENTITY_NOISE_TOKENS = new Set([
  "SUC", "SUCURSAL", "OFC", "OFICINA", "PAG", "PAGO", "COMPRA", "COMPRAS",
  "DISPONIBLE", "REVERSO", "SUB", "SUBSCRIPTION", "SUSCRIPCION",
  "TRANSFERENCIA", "TRANSF", "ABONO", "CUOTA", "COP", "USD",
]);

/**
 * Tokens that identify a merchant: upper-cased, punctuation split ("ANTHROPIC*"
 * → "ANTHROPIC", "claude.ai" → "CLAUDE" + "AI"), numeric / short / generic
 * payment words dropped.
 */
export function merchantIdentityTokens(text: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  for (const raw of text.toUpperCase().split(/[^A-Z0-9ÁÉÍÓÚÑ]+/)) {
    const token = raw.trim();
    if (token.length < 3) continue;
    if (/^\d+$/.test(token)) continue;
    if (IDENTITY_NOISE_TOKENS.has(token)) continue;
    out.add(token);
  }
  return out;
}

/**
 * Overlap between two merchant strings in [0, 1]: shared identity tokens over
 * the smaller token set, so "Claude La Maria" vs "ANTHROPIC* CLAUDE SUB"
 * scores 0.5 (CLAUDE shared; LA/SUB dropped) instead of 0.
 */
export function merchantNameSimilarity(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const ta = merchantIdentityTokens(a);
  const tb = merchantIdentityTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

export interface IdentityRule {
  pattern: string;
  match_type: "contains" | "exact";
}

export interface OccurrenceIdentityInput {
  /** The transaction's destinatario (null when unassigned). */
  txDestinatarioId: string | null | undefined;
  /** The template's destinatario anchor (null when not anchored). */
  templateDestinatarioId: string | null | undefined;
  /**
   * Every text the transaction carries (raw bank descriptor, merchant name,
   * cleaned description). Rules are tested against each one separately — an
   * `exact` pattern must equal one field, not their concatenation — while the
   * name overlap looks at all of them together.
   */
  txDescription: string | string[] | null | undefined;
  /** Template merchant name (falls back to description upstream). */
  templateName: string | null | undefined;
  /** Detection rules of the template's destinatario, when anchored. */
  templateRules?: IdentityRule[];
}

/**
 * Merchant identity signal in [0, 1]:
 * - 1.0 — same destinatario, or the transaction text hits one of the
 *   template destinatario's detection patterns (the tx just wasn't assigned).
 * - 0.0 — both sides carry a destinatario and they differ (a known other
 *   merchant is evidence against the link).
 * - otherwise the merchant-name token overlap.
 */
export function occurrenceIdentityScore(input: OccurrenceIdentityInput): number {
  const { txDestinatarioId, templateDestinatarioId } = input;
  if (txDestinatarioId && templateDestinatarioId) {
    if (txDestinatarioId === templateDestinatarioId) return 1;
    return 0;
  }
  const texts = (Array.isArray(input.txDescription)
    ? input.txDescription
    : [input.txDescription]
  )
    .map((t) => (t ?? "").toLowerCase().trim())
    .filter((t) => t.length > 0);
  if (texts.length > 0 && templateDestinatarioId && input.templateRules?.length) {
    for (const rule of input.templateRules) {
      const pattern = rule.pattern.toLowerCase().trim();
      if (!pattern) continue;
      const hit = texts.some((text) =>
        rule.match_type === "exact" ? text === pattern : text.includes(pattern)
      );
      if (hit) return 1;
    }
  }
  return merchantNameSimilarity(texts.join(" "), input.templateName);
}
