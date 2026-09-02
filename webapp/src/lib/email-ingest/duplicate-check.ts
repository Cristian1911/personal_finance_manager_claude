import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findReconciliationCandidates,
  type ReconciliationCandidate,
  type ReconciliationMatch,
} from "@zeta/shared";
import { toISODateString } from "@/lib/utils/date";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import type { Database } from "@/types/database";

export type EmailDuplicateCandidateRow = {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  transaction_time: string | null;
  source_pattern: string | null;
  raw_description: string | null;
  merchant_name: string | null;
  clean_description: string | null;
  category_id: string | null;
  categorization_source: ReconciliationCandidate["categorization_source"];
  notes: string | null;
  reconciled_into_transaction_id: string | null;
  capture_method: ReconciliationCandidate["capture_method"];
};

export type EmailDuplicateResult = {
  candidate: EmailDuplicateCandidateRow;
  match: ReconciliationMatch;
};

/**
 * Id of the transaction already carrying this idempotency key, or null. The
 * exact-key check runs before any fuzzy scoring: a webhook redelivery of an
 * email that was already imported must stay a silent skip, never a
 * "posible duplicado" queue row. `idempotency_key` is a plain column, so the
 * filter works through the view for the admin client as well.
 */
export async function findTransactionByIdempotencyKey(params: {
  client: SupabaseClient<Database>;
  userId: string;
  idempotencyKey: string;
}): Promise<string | null> {
  const { data, error } = await params.client
    .from("transactions")
    .select("id")
    .eq("user_id", params.userId)
    .eq("idempotency_key", params.idempotencyKey)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** ±3 days — must match the date tolerance in `scoreReconciliationCandidate`. */
const WINDOW_DAYS = 3;

/**
 * Best existing transaction a parsed bank alert could be a duplicate of, or
 * null. Shared by the review prompt (user session) and the auto-import paths
 * (retry action + webhook with the admin client). Through the admin client
 * the encrypted text columns come back NULL — text similarity then
 * contributes nothing and the decision rests on account, amount, date, time
 * and alert family, which is exactly the evidence a conflict flag needs.
 */
export async function findEmailDuplicateCandidate(params: {
  client: SupabaseClient<Database>;
  userId: string;
  accountId: string;
  parsed: ParsedEmailTransaction;
}): Promise<EmailDuplicateResult | null> {
  const { client, userId, accountId, parsed } = params;

  const txDate = new Date(`${parsed.transaction_date}T12:00:00`);
  const fromDate = new Date(txDate);
  fromDate.setDate(fromDate.getDate() - WINDOW_DAYS);
  const toDate = new Date(txDate);
  toDate.setDate(toDate.getDate() + WINDOW_DAYS);

  // Every capture method is a candidate — the scorer and the idempotency key
  // handle dedup; filtering here would hide true duplicates.
  const { data: candidates, error } = await client
    .from("transactions")
    .select(
      "id, user_id, account_id, amount, direction, transaction_date, transaction_time, source_pattern, raw_description, merchant_name, clean_description, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method",
    )
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .gte("transaction_date", toISODateString(fromDate))
    .lte("transaction_date", toISODateString(toDate))
    .is("reconciled_into_transaction_id", null);

  if (error) throw error;
  if (!candidates || candidates.length === 0) return null;

  const result = findReconciliationCandidates(
    {
      account_id: accountId,
      amount: parsed.amount,
      direction: parsed.direction,
      transaction_date: parsed.transaction_date,
      transaction_time: parsed.transaction_time,
      source_pattern: parsed.pattern_type,
      raw_description: parsed.raw_line,
      capture_method: "EMAIL_IMPORT",
    },
    candidates as ReconciliationCandidate[],
  );

  const best = result.bestMatch;
  if (!best || best.decision === "NO_MATCH") return null;

  const candidate = candidates.find((c) => c.id === best.candidateId);
  if (!candidate) return null;

  return { candidate: candidate as EmailDuplicateCandidateRow, match: best };
}
