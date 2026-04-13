import type { TransactionCaptureMethod } from "../types/domain";

/**
 * Capture Method Authority Hierarchy
 *
 * Defines a trust/authority ranking for transaction sources.
 * Lower tier number = higher authority.
 *
 * Tier 1 — Bank-verified (structured PDF statements with metadata):
 *   PDF_IMPORT: Full statement parse with balances, credit limits, dates
 *
 * Tier 2 — Semi-structured (machine-extracted, partial metadata):
 *   EMAIL_IMPORT: Parsed from notification emails
 *   EMAIL_PDF_IMPORT: PDF attached to email, parsed automatically
 *   OCR_BATCH: Batch OCR from screenshots
 *   OCR_SINGLE: Single transaction OCR
 *
 * Tier 3 — User-entered (no bank verification):
 *   MANUAL_FORM: Typed via full form
 *   TEXT_QUICK_CAPTURE: Short text / voice / Telegram
 *
 * Rules:
 *   - Reconciliation fetches ALL existing transactions (no capture_method filter)
 *   - Higher authority always wins merge direction (keeps its raw_description, amount)
 *   - Lower authority's user enrichments are preserved (USER_CREATED category, notes)
 *   - Same tier + high score → AUTO_MERGE; idempotency key handles actual dedup
 *   - Balance updates: highest available authority for an account sets the balance
 */

const CAPTURE_TIER: Record<TransactionCaptureMethod, 1 | 2 | 3> = {
  PDF_IMPORT: 1,
  EMAIL_PDF_IMPORT: 2,
  EMAIL_IMPORT: 2,
  OCR_BATCH: 2,
  OCR_SINGLE: 2,
  TEXT_QUICK_CAPTURE: 3,
  MANUAL_FORM: 3,
};

export type CaptureTier = 1 | 2 | 3;

export function getCaptureTier(method: TransactionCaptureMethod): CaptureTier {
  return CAPTURE_TIER[method] ?? 3;
}

/**
 * Returns true if `incoming` has strictly higher authority than `existing`.
 */
export function isHigherAuthority(
  incoming: TransactionCaptureMethod,
  existing: TransactionCaptureMethod
): boolean {
  return getCaptureTier(incoming) < getCaptureTier(existing);
}

/**
 * Returns true if both methods are in the same authority tier.
 */
export function isSameTier(
  a: TransactionCaptureMethod,
  b: TransactionCaptureMethod
): boolean {
  return getCaptureTier(a) === getCaptureTier(b);
}

/**
 * Given an incoming and existing capture method, returns the one that should
 * "win" for data fields (raw_description, amount, capture_method on the
 * surviving transaction). The other side's user enrichments (category, notes)
 * are preserved separately by mergeTransactionMetadata.
 */
export function resolveAuthorityWinner(
  incoming: TransactionCaptureMethod,
  existing: TransactionCaptureMethod
): "incoming" | "existing" {
  const incomingTier = getCaptureTier(incoming);
  const existingTier = getCaptureTier(existing);
  // Lower tier number = higher authority; ties go to incoming (newer data)
  return incomingTier <= existingTier ? "incoming" : "existing";
}
