import { differenceInCalendarDays } from "date-fns";
import type { CategorizationSource, TransactionCaptureMethod, TransactionDirection } from "../types/domain";
import { getCaptureTier, isSameTier } from "./capture-hierarchy";

export type ReconciliationCandidate = {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  direction: TransactionDirection;
  transaction_date: string;
  raw_description: string | null;
  merchant_name?: string | null;
  clean_description?: string | null;
  category_id?: string | null;
  categorization_source?: CategorizationSource;
  notes?: string | null;
  reconciled_into_transaction_id?: string | null;
  capture_method?: TransactionCaptureMethod | null;
};

export type ImportTransactionForReconciliation = {
  account_id: string;
  amount: number;
  direction: TransactionDirection;
  transaction_date: string;
  raw_description: string;
  category_id?: string | null;
  notes?: string | null;
  capture_method?: TransactionCaptureMethod | null;
};

export type ReconciliationDecision = "AUTO_MERGE" | "REVIEW" | "NO_MATCH";

export type ReconciliationMatch = {
  candidateId: string;
  score: number;
  decision: ReconciliationDecision;
  daysDiff: number;
  textSimilarity: number;
};

export type RankedReconciliationResult = {
  bestMatch: ReconciliationMatch | null;
  ranked: ReconciliationMatch[];
};

export function normalizeTransactionDescription(...values: Array<string | null | undefined>): string {
  const joined = values.filter(Boolean).join(" ");
  return joined
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(?:pos|compra|debito|credito|pago|trx|transferencia|transaccion|cb|nro|ref|auth)\b/g, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

export function scoreReconciliationCandidate(
  importTx: ImportTransactionForReconciliation,
  candidate: ReconciliationCandidate
): ReconciliationMatch | null {
  if (candidate.reconciled_into_transaction_id) return null;
  if (candidate.account_id !== importTx.account_id) return null;
  if (candidate.direction !== importTx.direction) return null;

  // Amount tolerance: percentage-based (up to 5% of the larger amount)
  // Handles: cents in email vs rounded manual (0.03 on 3.8M), lazy manual rounding (~2000 COP)
  const maxAmount = Math.max(candidate.amount, importTx.amount);
  const amountDiff = Math.abs(candidate.amount - importTx.amount);
  const amountPctDiff = maxAmount > 0 ? amountDiff / maxAmount : amountDiff > 0 ? 1 : 0;
  if (amountPctDiff > 0.05) return null;

  const daysDiff = Math.abs(
    differenceInCalendarDays(
      new Date(importTx.transaction_date),
      new Date(candidate.transaction_date)
    )
  );

  if (daysDiff > 3) return null;

  const sourceText = normalizeTransactionDescription(importTx.raw_description);
  const candidateText = normalizeTransactionDescription(
    candidate.raw_description,
    candidate.merchant_name,
    candidate.clean_description
  );
  const textSimilarity = tokenSimilarity(sourceText, candidateText);

  // Score components (max 1.0):
  //   base:             0.40
  //   amount closeness: 0.15 (exact) → 0.05 (within 2%) → 0 (2-5%)
  //   date proximity:   0.20 (same day) → 0.10 (1-3 days)
  //   text similarity:  0.25 × similarity
  let score = 0.40;

  if (amountPctDiff < 0.001) score += 0.15;
  else if (amountPctDiff < 0.01) score += 0.10;
  else if (amountPctDiff < 0.02) score += 0.05;

  if (daysDiff <= 1) score += 0.20;
  else if (daysDiff <= 3) score += 0.10;

  score += 0.25 * textSimilarity;

  let decision: ReconciliationDecision = "NO_MATCH";
  if (score >= 0.9) decision = "AUTO_MERGE";
  else if (score >= 0.75) decision = "REVIEW";

  return {
    candidateId: candidate.id,
    score: Number(score.toFixed(4)),
    decision,
    daysDiff,
    textSimilarity: Number(textSimilarity.toFixed(4)),
  };
}

export function findReconciliationCandidates(
  importTx: ImportTransactionForReconciliation,
  candidates: ReconciliationCandidate[]
): RankedReconciliationResult {
  const ranked = candidates
    .map((candidate) => scoreReconciliationCandidate(importTx, candidate))
    .filter((value): value is ReconciliationMatch => value !== null)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return { bestMatch: null, ranked: [] };
  }

  const best = ranked[0];
  const second = ranked[1];
  if (best.decision !== "NO_MATCH" && second && best.score - second.score < 0.08) {
    return {
      bestMatch: { ...best, decision: "REVIEW" },
      ranked: [{ ...best, decision: "REVIEW" }, ...ranked.slice(1)],
    };
  }

  return { bestMatch: best, ranked };
}

/**
 * Merges metadata when reconciling two transactions.
 *
 * Uses the capture hierarchy to decide merge direction:
 *   - The higher-authority source wins for capture_method
 *   - User-set enrichments (category, notes) from the lower-authority
 *     source are preserved when the higher-authority source lacks them
 *
 * @param existingTx - The transaction already in the database
 * @param incomingTx - The transaction being imported now
 */
export function mergeTransactionMetadata(
  existingTx: Pick<
    ReconciliationCandidate,
    "category_id" | "categorization_source" | "notes" | "capture_method"
  >,
  incomingTx: {
    category_id?: string | null;
    notes?: string | null;
    capture_method?: TransactionCaptureMethod;
  }
): {
  category_id?: string | null;
  notes?: string | null;
  capture_method: TransactionCaptureMethod;
} {
  const incomingMethod = incomingTx.capture_method ?? "PDF_IMPORT";
  const existingMethod = existingTx.capture_method ?? "MANUAL_FORM";

  // Higher authority (lower tier number) wins for capture_method
  const incomingTier = getCaptureTier(incomingMethod);
  const existingTier = getCaptureTier(existingMethod);
  const winnerMethod = incomingTier <= existingTier ? incomingMethod : existingMethod;

  // For category: preserve user-set category from either side when the other lacks one
  const existingHasUserCategory =
    !!existingTx.category_id &&
    (existingTx.categorization_source === "USER_CREATED" ||
      existingTx.categorization_source === "USER_OVERRIDE");

  const shouldCarryExistingCategory =
    !incomingTx.category_id && existingHasUserCategory;

  return {
    category_id: shouldCarryExistingCategory
      ? existingTx.category_id ?? null
      : incomingTx.category_id ?? null,
    notes: incomingTx.notes ?? existingTx.notes ?? null,
    capture_method: winnerMethod,
  };
}
