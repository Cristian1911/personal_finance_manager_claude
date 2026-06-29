import { supabase } from "../supabase";
import {
  autoCategorize,
  findReconciliationCandidates,
  mergeTransactionMetadata,
  prepareDestinatarioRules,
  matchDestinatario,
  type ReconciliationCandidate,
  type TransactionCaptureMethod,
  type TransactionDirection,
} from "@zeta/shared";
import { getDatabase } from "../db/database";
import { enqueueAccountUpdateCoalesced } from "./ledger-helpers";
import { getAccountById } from "./accounts";
import {
  createTransaction,
  createTransactionAndApplyBalance,
  updateTransaction,
  type CreateTransactionParams,
} from "./transactions";
import { findAndLinkLocalOccurrence } from "./recurring";
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
 * NOTE: like the webapp's approve, this now runs `findAndLinkLocalOccurrence` to
 * mark a matching pending recurring occurrence paid — app-wide on mobile as of the
 * 2026-06-29 parity wave (the capture paths auto-link too; PDF import in its pass).
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
 * Import a pending email transaction — LOCAL-FIRST. Mirrors webapp
 * `approveEmailTransaction` but writes to local SQLite + enqueues the sync push
 * instead of inserting straight to remote, so the row appears in the feed
 * immediately, works offline, and applies the balance side-effect locally.
 *
 * Only the two genuinely remote steps survive (the `pending_email_transactions`
 * queue is REMOTE-only): reading the pending row up-front, and marking it
 * imported at the end. The mark-imported call is fire-and-forget so the action
 * returns the instant the local writes finish — if it fails offline, the
 * idempotency key blocks a duplicate transaction on the next retry.
 *
 * Flow: resolve the account locally → learn the debit-card mask locally →
 * enrich (destinatario + autoCategorize) → insert the transaction via
 * `createTransaction` (capture_method EMAIL_IMPORT, idempotency dedup) →
 * optionally reconcile into an existing manual transaction → apply the balance
 * delta (skipped when reconciling) → mark the pending row imported.
 */
export async function approveEmailTransaction(
  pendingId: string,
  overrideAccountId?: string,
  reconcileWithTransactionId?: string
): Promise<ApproveResult> {
  const userId = await getUserId();
  if (!userId) return { success: false, error: "No autenticado" };

  // REMOTE read — the pending queue is not in local SQLite.
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

  // Resolve the account LOCALLY — applyLocalBalanceDelta needs the full row.
  const account = await getAccountById(accountId);
  if (!account) return { success: false, error: "Cuenta no encontrada" };

  const db = await getDatabase();
  const now = new Date().toISOString();

  // Learn the debit-card → account mapping LOCALLY (+ enqueue the sync UPDATE)
  // when a debit notification lands on a bank account without the mask yet.
  if (
    parsed.card_type === "T.Deb" &&
    parsed.card_last4 &&
    (account.account_type === "SAVINGS" || account.account_type === "CHECKING") &&
    !maskSuffixMatches(account.debit_card_mask, parsed.card_last4)
  ) {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        "UPDATE accounts SET debit_card_mask = ?, updated_at = ? WHERE id = ?",
        [parsed.card_last4, now, accountId]
      );
      await enqueueAccountUpdateCoalesced(
        db,
        accountId,
        { debit_card_mask: parsed.card_last4, updated_at: now },
        now
      );
    });
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

  const cleanDescription = merchantName ?? rawDescription;

  // Reconcile pre-read: when merging into an existing manual transaction, the
  // higher-authority capture_method survives and the manual tx's user-set
  // enrichments are carried onto the new row (mergeTransactionMetadata). We read
  // the manual tx LOCALLY and bake the merged values straight into the create —
  // identical end-state to the webapp's create-then-update, with one less write.
  let captureMethod: TransactionCaptureMethod = "EMAIL_IMPORT";
  let reconcileNotes: string | null = null;
  let reconcileManualId: string | null = null;

  if (reconcileWithTransactionId) {
    const manualTx = await db.getFirstAsync<
      Pick<
        ReconciliationCandidate,
        "category_id" | "categorization_source" | "notes" | "capture_method"
      > & { id: string }
    >(
      `SELECT id, category_id, categorization_source, notes, capture_method
       FROM transactions
       WHERE id = ? AND user_id = ? AND reconciled_into_transaction_id IS NULL`,
      [reconcileWithTransactionId, userId]
    );

    // If the reconcile target isn't in local SQLite (deleted, already
    // reconciled, or — likely on mobile — found remotely by
    // checkEmailReconciliation but not yet pulled to this device), we cannot
    // safely import: proceeding would skip the balance delta (silent drift),
    // and applying the delta instead would double-count against the manual tx
    // that already moved the balance remotely. Abort so the user retries after
    // a sync. (Justified divergence from webapp, whose manualTx comes from the
    // authoritative DB so it is virtually always present.)
    if (!manualTx) {
      return {
        success: false,
        error:
          "La transacción a conciliar ya no está disponible. Intenta de nuevo tras sincronizar.",
      };
    }

    const merged = mergeTransactionMetadata(manualTx, {
      category_id: categoryId,
      categorization_source: categorizationSource,
      notes: null,
      capture_method: "EMAIL_IMPORT",
    });
    categoryId = merged.category_id ?? null;
    reconcileNotes = merged.notes ?? null;
    captureMethod = merged.capture_method;
    reconcileManualId = manualTx.id;
  }

  // Insert the transaction LOCALLY. createTransaction computes the same EMAIL
  // idempotency key when `pending.idempotency_key` is null (provider/date/amount/
  // raw_description match the old fallback), so cross-source dedup is preserved.
  const createParams: CreateTransactionParams = {
    user_id: userId,
    account_id: accountId,
    amount: parsed.amount,
    currency_code: account.currency_code,
    direction: parsed.direction,
    transaction_date: parsed.transaction_date,
    transaction_time: normalizeEmailTime(parsed.transaction_time),
    raw_description: rawDescription,
    description: cleanDescription,
    merchant_name: merchantName,
    category_id: categoryId,
    categorization_source: categorizationSource,
    destinatario_id: destinatarioId,
    notes: reconcileNotes,
    provider: "EMAIL",
    capture_method: captureMethod,
    status: "POSTED",
    idempotency_key: pending.idempotency_key ?? undefined,
  };

  let newTxId: string;
  try {
    // Reconcile path: the manual tx already moved the balance, so insert WITHOUT
    // a delta. Normal path: insert + local balance delta in ONE transaction
    // (createTransactionAndApplyBalance) — replaces the old separate delta block.
    newTxId = reconcileWithTransactionId
      ? await createTransaction(createParams)
      : await createTransactionAndApplyBalance(createParams, account);
  } catch (err) {
    // Local UNIQUE(idempotency_key) collision = already imported. Mark the
    // pending row imported (non-blocking) so it leaves the queue, and report
    // success — the existing row already represents this transaction.
    if (isUniqueConstraintError(err)) {
      void markImported(userId, pendingId);
      return { success: true };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo importar la transacción",
    };
  }

  // Link the manual transaction into the new (surviving) row. The balance delta
  // below is skipped because that manual tx already moved the balance.
  if (reconcileManualId) {
    await updateTransaction(reconcileManualId, {
      reconciled_into_transaction_id: newTxId,
    });
  }

  // Auto-link to a matching pending recurring occurrence (best-effort) — only on
  // the normal path; the reconcile path preserves the manual tx's occurrence state.
  if (!reconcileWithTransactionId) {
    await findAndLinkLocalOccurrence(newTxId).catch(() => false);
  }

  // REMOTE write, non-blocking — return the instant the local writes finish.
  void markImported(userId, pendingId);

  return { success: true };
}

/** True for a SQLite UNIQUE constraint violation (idempotency_key collision) —
 * the local equivalent of the Postgres 23505 duplicate path. */
function isUniqueConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed/i.test(message);
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
