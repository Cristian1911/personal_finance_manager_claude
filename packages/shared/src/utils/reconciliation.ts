import { differenceInCalendarDays } from "date-fns";
import type { CategorizationSource, TransactionCaptureMethod, TransactionDirection } from "../types/domain";

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
};

export type ImportTransactionForReconciliation = {
  account_id: string;
  amount: number;
  direction: TransactionDirection;
  transaction_date: string;
  raw_description: string;
  category_id?: string | null;
  notes?: string | null;
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
  if (Math.abs(candidate.amount - importTx.amount) > 0.0001) return null;

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

  let score = 0.55;
  if (daysDiff <= 1) score += 0.2;
  else if (daysDiff <= 3) score += 0.1;
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

export function mergeTransactionMetadata(
  manualTx: Pick<
    ReconciliationCandidate,
    "category_id" | "categorization_source" | "notes"
  >,
  pdfTx: {
    category_id?: string | null;
    notes?: string | null;
    capture_method?: TransactionCaptureMethod;
  }
): {
  category_id?: string | null;
  notes?: string | null;
  capture_method: TransactionCaptureMethod;
} {
  const shouldCarryCategory =
    !pdfTx.category_id &&
    !!manualTx.category_id &&
    (manualTx.categorization_source === "USER_CREATED" ||
      manualTx.categorization_source === "USER_OVERRIDE");

  return {
    category_id: shouldCarryCategory ? manualTx.category_id ?? null : pdfTx.category_id ?? null,
    notes: pdfTx.notes ?? manualTx.notes ?? null,
    capture_method: "PDF_IMPORT",
  };
}
