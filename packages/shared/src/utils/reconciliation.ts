import { differenceInCalendarDays } from "date-fns";
import type { CategorizationSource, TransactionCaptureMethod, TransactionDirection } from "../types/domain";
import { resolveAuthorityWinner } from "./capture-hierarchy";

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

/**
 * Long digit runs (≥6) surviving normalization are reference entities —
 * destination account numbers, reference ids. Card masks (4 digits), times
 * ("18 51") and thousand-separated amounts ("30 000") all tokenize shorter,
 * so they never qualify.
 */
function extractRefTokens(normalized: string): Set<string> {
  return new Set(normalized.match(/\b\d{6,}\b/g) ?? []);
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
  // Containment-based: if the shorter side is fully present in the longer
  // side, similarity = 1. Cross-source pairs (e.g. terse PDF "AMAZON.COM"
  // vs verbose email "Compraste COP180.865 en AMAZON.COM con tu T.Cred…")
  // would otherwise be diluted by the longer side's noise tokens.
  return overlap / Math.min(aTokens.size, bTokens.size);
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

  // Conflicting reference entities: when BOTH texts carry reference numbers
  // (destination accounts, refs) and share NONE, they describe different
  // counterparties. Without this, two same-day transfers from the same
  // account to different destinations score as duplicates — the bank
  // template ("Transferiste … desde tu cuenta … a la cuenta …") supplies
  // nearly all the tokens. The penalty drops template-only pairs below the
  // REVIEW threshold, while exact-amount high-similarity pairs still surface
  // as REVIEW (a prompt, not a silent auto-merge).
  //
  // Scoped to HIGH text similarity on purpose: that's the template-driven
  // failure mode. Cross-source pairs for the SAME transaction (terse PDF row
  // with an authorization/batch number vs verbose email with the destination
  // account) have low similarity and carry different KINDS of numbers that
  // never overlap — penalizing those would silently hide true duplicates.
  // Latent trap to keep in mind: if a future parser ever prints the shared
  // SOURCE account unmasked (≥6 digits) on both sides, the sets would
  // overlap and defeat the guard — today every template masks it to 4.
  const sourceRefs = extractRefTokens(sourceText);
  const candidateRefs = extractRefTokens(candidateText);
  const refConflict =
    textSimilarity >= 0.5 &&
    sourceRefs.size > 0 &&
    candidateRefs.size > 0 &&
    ![...sourceRefs].some((ref) => candidateRefs.has(ref));
  if (refConflict) score -= 0.15;

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

/** Higher-authority capture_method wins; lower authority's user-set enrichments are preserved. */
export function mergeTransactionMetadata(
  existingTx: Pick<
    ReconciliationCandidate,
    "category_id" | "categorization_source" | "notes" | "capture_method"
  >,
  incomingTx: {
    category_id?: string | null;
    categorization_source?: CategorizationSource;
    notes?: string | null;
    capture_method?: TransactionCaptureMethod;
  }
): {
  category_id?: string | null;
  notes?: string | null;
  capture_method: TransactionCaptureMethod;
} {
  const incomingMethod = incomingTx.capture_method ?? "MANUAL_FORM";
  const existingMethod = existingTx.capture_method ?? "MANUAL_FORM";
  const winner = resolveAuthorityWinner(incomingMethod, existingMethod);
  const winnerMethod = winner === "incoming" ? incomingMethod : existingMethod;

  const existingHasUserCategory =
    !!existingTx.category_id &&
    (existingTx.categorization_source === "USER_CREATED" ||
      existingTx.categorization_source === "USER_OVERRIDE");

  const incomingHasUserCategory =
    !!incomingTx.category_id &&
    (incomingTx.categorization_source === "USER_CREATED" ||
      incomingTx.categorization_source === "USER_OVERRIDE");

  // User-set categories are always preserved over system-generated ones.
  // When both sides have user-set categories, authority hierarchy breaks the tie.
  const shouldCarryExistingCategory =
    existingHasUserCategory &&
    (!incomingHasUserCategory || winner === "existing");

  return {
    category_id: shouldCarryExistingCategory
      ? existingTx.category_id ?? null
      : incomingTx.category_id ?? null,
    notes: incomingTx.notes ?? existingTx.notes ?? null,
    capture_method: winnerMethod,
  };
}
