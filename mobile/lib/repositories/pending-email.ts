import { supabase } from "../supabase";
import {
  autoCategorize,
  applyAccountBalanceDelta,
  findReconciliationCandidates,
  mergeTransactionMetadata,
  prepareDestinatarioRules,
  matchDestinatario,
  type ReconciliationCandidate,
  type TransactionDirection,
} from "@zeta/shared";
import { computeIdempotencyKey } from "./ledger-helpers";
import { getDestinatarioRulesForMatching } from "./destinatarios";

/**
 * Email-import queue — mobile parity with the webapp's "Pendientes por correo"
 * surface (webapp `PendingEmailTransactions` + `actions/email-ingest.ts`).
 *
 * `pending_email_transactions` is a REMOTE-only table (it is NOT in the local
 * SQLite sync set — email ingestion is inherently online). So unlike the rest
 * of the mobile data layer, these functions talk directly to Supabase and
 * mirror the webapp Server Actions almost 1:1 — the lowest-drift way to keep
 * cross-platform behavior aligned. After a successful approve/dismiss the
 * caller runs `syncAll()` so the newly-inserted transaction + updated account
 * balance get pulled down into local SQLite (Movimientos/Inicio refresh).
 *
 * KNOWN PARITY GAP: the webapp's approve also runs `linkTransactionToOccurrence`,
 * which (a) marks a matching `recurring_occurrences` row paid, (b) creates the
 * debt-account companion INFLOW leg for debt-payment occurrences, and (c) swaps
 * any pre-existing phantom occurrence. Mobile omits all three because mobile's
 * OTHER transaction-creation paths (createTransaction, PDF import) don't link
 * occurrences either — adding it only here would diverge from the app-wide
 * mobile convention. Consequence: approving an email that pays a recurring debt
 * obligation won't mark the occurrence paid or move the debt account's balance
 * until the webapp later reconciles it. Resolve app-wide (mobile occurrence
 * linking) rather than special-casing this path.
 *
 * Defense-in-depth: every query filters on `user_id` explicitly even though RLS
 * already enforces it, matching the project-wide policy.
 */

// ── Types (ported from webapp `lib/parsers/bancolombia-email.ts`) ────────────

export type EmailCardType = "T.Deb" | "T.Cred" | "Cta" | "producto";

export interface ParsedEmailTransaction {
  direction: TransactionDirection;
  amount: number;
  currency: "COP";
  merchant: string | null;
  destination: string | null;
  card_last4: string;
  card_type: EmailCardType;
  transaction_date: string;
  transaction_time: string;
  raw_line: string;
  pattern_type: string;
}

export type PendingEmailRow = {
  id: string;
  email_ingest_id: string;
  suggested_account_id: string | null;
  idempotency_key: string;
  parsed_data: ParsedEmailTransaction;
  created_at: string;
};

export type ReconciliationCandidatePreview = {
  id: string;
  raw_description: string | null;
  merchant_name: string | null;
  transaction_date: string;
  amount: number;
  direction: string;
  category_id: string | null;
  score: number;
};

type EmailMatchCandidate = {
  id: string;
  debit_card_mask: string | null;
  mask: string | null;
  account_type: string;
};

type ApproveResult = { success: boolean; error?: string };

// ── Pure helpers (ported from webapp account-mask + account-matching) ─────────

/** Strip non-digits and keep the last 4, matching webapp `normalizeAccountMaskSuffix`. */
function normalizeMaskSuffix(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function maskSuffixMatches(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = normalizeMaskSuffix(left);
  const b = normalizeMaskSuffix(right);
  return !!a && a === b;
}

const ACCOUNT_TYPE_PREFERENCES: Record<EmailCardType, string[]> = {
  "T.Cred": ["CREDIT_CARD"],
  "T.Deb": ["SAVINGS", "CHECKING"],
  Cta: ["SAVINGS", "CHECKING"],
  producto: ["SAVINGS", "CHECKING"],
};

/** Mirror of webapp `resolveSuggestedEmailAccountId` — picks the account whose
 * mask matches the parsed card_last4, preferring the right account type. */
function resolveSuggestedEmailAccountId(
  accounts: EmailMatchCandidate[],
  parsed: ParsedEmailTransaction,
  defaultAccountId: string | null
): string | null {
  const defaultAccount =
    defaultAccountId == null
      ? null
      : accounts.find((a) => a.id === defaultAccountId) ?? null;
  const last4 = normalizeMaskSuffix(parsed.card_last4);
  if (!last4) return defaultAccount?.id ?? null;

  const exact = accounts.filter((account) => {
    if (!ACCOUNT_TYPE_PREFERENCES[parsed.card_type].includes(account.account_type)) {
      return false;
    }
    return parsed.card_type === "T.Deb"
      ? maskSuffixMatches(account.debit_card_mask, last4)
      : maskSuffixMatches(account.mask, last4);
  });

  if (exact.length === 0) return defaultAccount?.id ?? null;
  if (exact.length === 1) return exact[0].id;
  return exact.find((a) => a.id === defaultAccount?.id)?.id ?? null;
}

/** Bancolombia emails carry "HH:mm" — Postgres TIME wants "HH:mm:ss". */
function normalizeEmailTime(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  return `${m[1]}:${m[2]}:${m[3] ?? "00"}`;
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ── Count (kept from the original module) ─────────────────────────────────────

/**
 * Count of `pending_email_transactions` with `status = 'pending'` for the
 * current user. Used by the "Por resolver" tile on Inicio. Returns 0 on auth
 * or network failure so the dashboard never blocks on this number.
 */
export async function getPendingEmailTransactionsCount(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;

  const { count, error } = await (supabase as any)
    .from("pending_email_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

// ── Queue read ────────────────────────────────────────────────────────────────

/**
 * Pending email-parsed transactions awaiting review, newest first. Mirrors the
 * webapp `getPendingEmailTransactions` (status = pending, limit 50). Also
 * back-fills `suggested_account_id` client-side (against remote accounts, which
 * carry the credit-card `mask`) for rows the ingest webhook couldn't match.
 */
export async function getPendingEmailTransactions(): Promise<PendingEmailRow[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await (supabase as any)
    .from("pending_email_transactions")
    .select("id, email_ingest_id, suggested_account_id, idempotency_key, parsed_data, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const rows = (data ?? []) as PendingEmailRow[];

  // Client-side fallback matching for rows that lack a suggested account.
  if (rows.some((r) => !r.suggested_account_id)) {
    const candidates = await getEmailMatchCandidateAccounts(userId);
    for (const row of rows) {
      if (row.suggested_account_id) continue;
      const parsed = row.parsed_data;
      if (!parsed?.card_last4) continue;
      const matched = resolveSuggestedEmailAccountId(candidates, parsed, null);
      if (matched) row.suggested_account_id = matched;
    }
  }

  return rows;
}

async function getEmailMatchCandidateAccounts(
  userId: string
): Promise<EmailMatchCandidate[]> {
  const { data } = await (supabase as any)
    .from("accounts")
    .select("id, mask, debit_card_mask, account_type")
    .eq("user_id", userId)
    .eq("is_active", true);
  return (data ?? []) as EmailMatchCandidate[];
}

// ── Account resolution (override > suggested > ingest default) ────────────────

async function resolveTargetAccountId(
  userId: string,
  pending: { suggested_account_id: string | null; email_ingest_id: string },
  overrideAccountId?: string
): Promise<string | null> {
  let accountId = overrideAccountId ?? pending.suggested_account_id ?? null;
  if (accountId) return accountId;

  const { data: ingestAddress } = await (supabase as any)
    .from("email_ingest_addresses")
    .select("account_id")
    .eq("id", pending.email_ingest_id)
    .eq("user_id", userId)
    .single();
  accountId = ingestAddress?.account_id ?? null;
  return accountId;
}

// ── Reconciliation check ──────────────────────────────────────────────────────

/**
 * Look for an existing transaction that could be a duplicate of this pending
 * email row (±3 days, any capture method). Mirrors webapp
 * `checkEmailReconciliation`. Returns null on any failure so the UI falls back
 * to importing directly.
 */
export async function checkEmailReconciliation(
  pendingId: string,
  overrideAccountId?: string
): Promise<{
  candidate: ReconciliationCandidatePreview;
  decision: "AUTO_MERGE" | "REVIEW";
} | null> {
  try {
    const userId = await getUserId();
    if (!userId) return null;

    const { data: pending } = await (supabase as any)
      .from("pending_email_transactions")
      .select("id, suggested_account_id, email_ingest_id, parsed_data")
      .eq("id", pendingId)
      .eq("user_id", userId)
      .single();
    if (!pending) return null;

    const parsed = pending.parsed_data as ParsedEmailTransaction;
    const accountId = await resolveTargetAccountId(userId, pending, overrideAccountId);
    if (!accountId) return null;

    const from = addDaysISO(parsed.transaction_date, -3);
    const to = addDaysISO(parsed.transaction_date, 3);

    const { data: candidates, error } = await (supabase as any)
      .from("transactions")
      .select(
        "id, user_id, account_id, amount, direction, transaction_date, raw_description, merchant_name, clean_description, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method"
      )
      .eq("account_id", accountId)
      .eq("user_id", userId)
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .is("reconciled_into_transaction_id", null);

    if (error || !candidates || candidates.length === 0) return null;

    const importTx = {
      account_id: accountId,
      amount: parsed.amount,
      direction: parsed.direction,
      transaction_date: parsed.transaction_date,
      raw_description: parsed.raw_line,
    };

    const result = findReconciliationCandidates(
      importTx,
      candidates as ReconciliationCandidate[]
    );

    if (!result.bestMatch || result.bestMatch.decision === "NO_MATCH") return null;

    const matched = candidates.find(
      (c: { id: string }) => c.id === result.bestMatch!.candidateId
    );
    if (!matched) return null;

    return {
      candidate: {
        id: matched.id,
        raw_description: matched.raw_description,
        merchant_name: matched.merchant_name,
        transaction_date: matched.transaction_date,
        amount: matched.amount,
        direction: matched.direction,
        category_id: matched.category_id,
        score: result.bestMatch.score,
      },
      decision: result.bestMatch.decision as "AUTO_MERGE" | "REVIEW",
    };
  } catch {
    return null;
  }
}

// ── Approve / dismiss ─────────────────────────────────────────────────────────

/**
 * Import a pending email transaction. Mirrors webapp `approveEmailTransaction`:
 * resolves the account, enriches (destinatario + autoCategorize), inserts the
 * transaction (capture_method EMAIL_IMPORT, idempotency dedup), optionally
 * reconciles into an existing manual transaction, applies the balance delta
 * (skipped when reconciling), and marks the pending row imported.
 */
export async function approveEmailTransaction(
  pendingId: string,
  overrideAccountId?: string,
  reconcileWithTransactionId?: string
): Promise<ApproveResult> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: "No autenticado" };

  const { data: pending, error: fetchError } = await (supabase as any)
    .from("pending_email_transactions")
    .select("id, suggested_account_id, email_ingest_id, idempotency_key, parsed_data")
    .eq("id", pendingId)
    .eq("user_id", userId)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!pending) return { success: false, error: "Transacción pendiente no encontrada" };

  const parsed = pending.parsed_data as ParsedEmailTransaction;

  const accountId = await resolveTargetAccountId(userId, pending, overrideAccountId);
  if (!accountId) {
    return { success: false, error: "No se encontró una cuenta para esta transacción" };
  }

  const { data: account, error: accountError } = await (supabase as any)
    .from("accounts")
    .select("currency_code, account_type, debit_card_mask, current_balance")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (accountError) return { success: false, error: accountError.message };
  if (!account) return { success: false, error: "Cuenta no encontrada" };

  // Learn the debit-card → account mapping when a debit notification lands on a
  // bank account that didn't have the card mask yet.
  if (
    parsed.card_type === "T.Deb" &&
    parsed.card_last4 &&
    (account.account_type === "SAVINGS" || account.account_type === "CHECKING") &&
    !maskSuffixMatches(account.debit_card_mask, parsed.card_last4)
  ) {
    await (supabase as any)
      .from("accounts")
      .update({ debit_card_mask: parsed.card_last4 })
      .eq("id", accountId)
      .eq("user_id", userId);
  }

  const merchantName = parsed.merchant ?? parsed.destination ?? null;
  const rawDescription = parsed.raw_line;
  const matchText = merchantName ?? rawDescription;

  // Enrichment: destinatario rule match (local synced rules) → autoCategorize.
  let destinatarioId: string | null = null;
  let categoryId: string | null = null;
  let categorizationSource: "SYSTEM_DEFAULT" | "USER_LEARNED" | undefined;

  try {
    const prepared = prepareDestinatarioRules(await getDestinatarioRulesForMatching());
    const destMatch = prepared.length > 0 ? matchDestinatario(matchText, prepared) : null;
    if (destMatch) {
      destinatarioId = destMatch.destinatario_id;
      categoryId = destMatch.category_id ?? null;
      categorizationSource = categoryId ? "USER_LEARNED" : undefined;
    }
  } catch {
    // No rules / load failure — proceed without a destinatario match.
  }

  if (!categoryId && merchantName) {
    const result = autoCategorize(merchantName);
    categoryId = result?.category_id ?? null;
    if (categoryId) categorizationSource = "SYSTEM_DEFAULT";
  }

  const idempotencyKey =
    pending.idempotency_key ||
    (await computeIdempotencyKey({
      provider: "EMAIL",
      transactionDate: parsed.transaction_date,
      amount: parsed.amount,
      rawDescription: parsed.raw_line,
    }));

  const cleanDescription = merchantName ?? rawDescription;

  const { data: insertedTx, error: insertError } = await (supabase as any)
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: accountId,
      amount: parsed.amount,
      currency_code: account.currency_code,
      direction: parsed.direction,
      transaction_date: parsed.transaction_date,
      transaction_time: normalizeEmailTime(parsed.transaction_time),
      raw_description: rawDescription,
      clean_description: cleanDescription,
      merchant_name: merchantName,
      idempotency_key: idempotencyKey,
      provider: "EMAIL",
      capture_method: "EMAIL_IMPORT",
      category_id: categoryId,
      categorization_source: categorizationSource,
      destinatario_id: destinatarioId,
      status: "POSTED",
    })
    .select("id, category_id, categorization_source, notes")
    .single();

  if (insertError) {
    // Duplicate — still mark imported so it doesn't linger in the queue.
    if (insertError.code === "23505") {
      await markImported(userId, pendingId);
      return { success: true };
    }
    return { success: false, error: insertError.message };
  }

  // Reconcile with an existing manual transaction if requested.
  if (reconcileWithTransactionId && insertedTx) {
    const { data: manualTx } = await (supabase as any)
      .from("transactions")
      .select(
        "id, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method"
      )
      .eq("id", reconcileWithTransactionId)
      .eq("user_id", userId)
      .is("reconciled_into_transaction_id", null)
      .maybeSingle();

    if (manualTx) {
      const merged = mergeTransactionMetadata(manualTx as ReconciliationCandidate, {
        category_id: insertedTx.category_id,
        categorization_source: insertedTx.categorization_source,
        notes: insertedTx.notes,
        capture_method: "EMAIL_IMPORT",
      });

      await (supabase as any)
        .from("transactions")
        .update({
          category_id: merged.category_id ?? null,
          notes: merged.notes ?? null,
          capture_method: merged.capture_method,
        })
        .eq("user_id", userId)
        .eq("id", insertedTx.id);

      await (supabase as any)
        .from("transactions")
        .update({ reconciled_into_transaction_id: insertedTx.id })
        .eq("user_id", userId)
        .eq("id", manualTx.id);
    }
  }

  // Balance delta — skip when reconciling (the manual tx already moved it).
  if (!reconcileWithTransactionId) {
    const newBalance = applyAccountBalanceDelta({
      currentBalance: account.current_balance ?? 0,
      accountType: account.account_type,
      direction: parsed.direction,
      amount: parsed.amount,
    });
    await (supabase as any)
      .from("accounts")
      .update({ current_balance: newBalance })
      .eq("id", accountId)
      .eq("user_id", userId);
  }

  const { error: updateError } = await (supabase as any)
    .from("pending_email_transactions")
    .update({ status: "imported" })
    .eq("id", pendingId)
    .eq("user_id", userId);

  if (updateError) return { success: false, error: updateError.message };

  return { success: true };
}

async function markImported(userId: string, pendingId: string): Promise<void> {
  await (supabase as any)
    .from("pending_email_transactions")
    .update({ status: "imported" })
    .eq("id", pendingId)
    .eq("user_id", userId);
}

/** Mark a pending email transaction as dismissed. Mirrors webapp `dismissEmailTransaction`. */
export async function dismissEmailTransaction(
  pendingId: string
): Promise<ApproveResult> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: "No autenticado" };

  const { error } = await (supabase as any)
    .from("pending_email_transactions")
    .update({ status: "dismissed" })
    .eq("id", pendingId)
    .eq("user_id", userId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
