import type { TransactionCaptureMethod } from "../types/domain";

// Lower tier number = higher authority.
// See CLAUDE.md "Capture Method Hierarchy" for full rules.
const CAPTURE_TIER = {
  PDF_IMPORT: 1,
  EMAIL_PDF_IMPORT: 1,
  EMAIL_IMPORT: 2,
  OCR_BATCH: 2,
  OCR_SINGLE: 2,
  TEXT_QUICK_CAPTURE: 3,
  MANUAL_FORM: 3,
} as const satisfies Record<TransactionCaptureMethod, 1 | 2 | 3>;

export type CaptureTier = 1 | 2 | 3;

export function getCaptureTier(method: TransactionCaptureMethod): CaptureTier {
  return CAPTURE_TIER[method];
}

/**
 * Only tier-1 (bank-verified statement) sources may set account balances,
 * credit limits and statement snapshots directly. Lower tiers update balances
 * per-transaction via applyAccountBalanceDelta.
 */
export function isBankVerifiedCapture(method: TransactionCaptureMethod): boolean {
  return getCaptureTier(method) === 1;
}

/**
 * Given an incoming and existing capture method, returns which side should
 * "win" for data fields on the surviving transaction. Ties go to incoming
 * (newer data).
 */
export function resolveAuthorityWinner(
  incoming: TransactionCaptureMethod,
  existing: TransactionCaptureMethod
): "incoming" | "existing" {
  return getCaptureTier(incoming) <= getCaptureTier(existing)
    ? "incoming"
    : "existing";
}
