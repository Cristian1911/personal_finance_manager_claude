import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  applyAccountBalanceDelta,
  buildDebtBalanceUpdatePayload,
  computeIdempotencyKey as sharedComputeIdempotencyKey,
  isDebtAccountType,
  type HashFn,
  type TransactionDirection,
} from "@zeta/shared";

/**
 * Ledger mutation substrate — the shared write primitives the 4 money-moving
 * mobile mutations (registerPayment, createTransfer, reconcileBalance,
 * recordRecurringOccurrencePayment) compose.
 *
 * INVARIANT: every helper here receives the active `db` handle and a frozen
 * `now` ISO timestamp from the CALLER, and the caller wraps all of its writes
 * in a single `db.withTransactionAsync(...)`. Helpers therefore NEVER open a
 * transaction of their own — that would nest and break atomic rollback. A throw
 * from any helper rolls back the entire mutation (this replaces the webapp's
 * manual outflow-delete rollback path).
 *
 * Idempotency, recurrence_group_id and transfer_group_id are computed with the
 * exact same inputs as the webapp Server Actions so cross-platform rows dedup
 * by construction (DB UNIQUE(idempotency_key) catches re-imports).
 */

/** expo-crypto SHA256 hashFn — the mobile equivalent of webapp's WebCrypto. */
export const expoHashFn: HashFn = (payload: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);

export const computeIdempotencyKey = (
  params: Parameters<typeof sharedComputeIdempotencyKey>[0]
) => sharedComputeIdempotencyKey(params, expoHashFn);

/** Account columns the ledger mutations read. `currency_balances` (a JSON map
 * whose per-currency entries hold total_payment_due/available_balance — there is
 * no top-level total_payment_due column) may be absent on older installs — see
 * schema migration. */
export type LedgerAccountRow = {
  id: string;
  user_id?: string;
  name: string;
  account_type: string;
  currency_code: string;
  current_balance: number;
  available_balance?: number | null;
  credit_limit: number | null;
  interest_rate?: number | null;
  monthly_payment?: number | null;
  currency_balances?: unknown;
};

// ─── sync_queue: account UPDATE coalesce ─────────────────────────────────────

/**
 * Queue an account-balance UPDATE, coalescing into a still-unsynced INSERT when
 * one exists (factored out of accounts.ts updateAccount L159-209). If the row
 * has never synced, merge the partial payload into the pending INSERT payload
 * so Supabase receives one consistent INSERT; otherwise queue a standalone
 * UPDATE (further coalescing into a pending UPDATE if present, mirroring the
 * transactions repo's enqueueTransactionUpdate).
 *
 * Caller must run inside its own withTransactionAsync.
 */
export async function enqueueAccountUpdateCoalesced(
  db: SQLiteDatabase,
  accountId: string,
  partialPayload: Record<string, unknown>,
  now: string
): Promise<void> {
  const pendingInsert = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue
     WHERE table_name = 'accounts' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [accountId]
  );

  if (pendingInsert) {
    const existing = JSON.parse(pendingInsert.payload);
    await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
      JSON.stringify({ ...existing, ...partialPayload }),
      pendingInsert.id,
    ]);
    return;
  }

  const pendingUpdate = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue
     WHERE table_name = 'accounts' AND record_id = ? AND operation = 'UPDATE' AND synced_at IS NULL`,
    [accountId]
  );

  if (pendingUpdate) {
    const existing = JSON.parse(pendingUpdate.payload);
    await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
      JSON.stringify({ ...existing, ...partialPayload }),
      pendingUpdate.id,
    ]);
    return;
  }

  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('accounts', ?, 'UPDATE', ?, ?)`,
    [accountId, JSON.stringify(partialPayload), now]
  );
}

// ─── Ledger transaction payload ──────────────────────────────────────────────

export type LedgerTxInput = {
  userId: string;
  accountId: string;
  amount: number;
  currencyCode: string;
  direction: TransactionDirection;
  transactionDate: string;
  rawDescription: string;
  /** merchant / human label. Defaults clean_description = merchantName ?? rawDescription. */
  merchantName?: string | null;
  /** Override for clean_description. When set, used verbatim (e.g. reconcile sets
   * a distinct clean label while keeping merchant_name = null). Defaults to
   * merchantName || rawDescription. */
  cleanDescription?: string | null;
  categoryId?: string | null;
  /** Override; defaults USER_CREATED when categoryId present, else SYSTEM_DEFAULT. */
  categorizationSource?: string | null;
  notes?: string | null;
  idempotencyKey: string;
  transferGroupId?: string | null;
  recurrenceGroupId?: string | null;
  isRecurring?: boolean;
  /** Defaults "MANUAL". registerPayment / transfers / reconcile use MANUAL. */
  provider?: string;
  /** Defaults "MANUAL_FORM". */
  captureMethod?: string;
};

type LedgerTxPayload = {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  categorization_source: string;
  amount: number;
  currency_code: string;
  direction: TransactionDirection;
  clean_description: string;
  merchant_name: string | null;
  raw_description: string;
  transaction_date: string;
  status: string;
  idempotency_key: string;
  is_excluded: boolean;
  is_recurring: boolean;
  notes: string | null;
  provider: string;
  capture_method: string;
  transfer_group_id: string | null;
  recurrence_group_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Single source of the standard transaction field set for the ledger mutations,
 * matching webapp persistTransaction + the mobile `transactions` table column
 * set (transactions.ts buildInsertPayload). `clean_description` falls back to
 * `merchant_name || raw_description`, exactly like the webapp's persisted rows.
 */
export function buildLedgerTxPayload(
  input: LedgerTxInput,
  now: string
): LedgerTxPayload {
  const cleanDescription =
    input.cleanDescription ?? (input.merchantName || input.rawDescription);
  return {
    id: Crypto.randomUUID(),
    user_id: input.userId,
    account_id: input.accountId,
    category_id: input.categoryId ?? null,
    categorization_source:
      input.categorizationSource ??
      (input.categoryId ? "USER_CREATED" : "SYSTEM_DEFAULT"),
    amount: input.amount,
    currency_code: input.currencyCode,
    direction: input.direction,
    clean_description: cleanDescription,
    merchant_name: input.merchantName ?? null,
    raw_description: input.rawDescription,
    transaction_date: input.transactionDate,
    status: "POSTED",
    idempotency_key: input.idempotencyKey,
    is_excluded: false,
    is_recurring: input.isRecurring ?? false,
    notes: input.notes ?? null,
    provider: input.provider ?? "MANUAL",
    capture_method: input.captureMethod ?? "MANUAL_FORM",
    transfer_group_id: input.transferGroupId ?? null,
    recurrence_group_id: input.recurrenceGroupId ?? null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * INSERT one ledger transaction row + enqueue its `transactions` INSERT for
 * sync. Returns `{ inserted: false }` on a local UNIQUE(idempotency_key)
 * conflict (the mobile equivalent of Postgres 23505) so callers skip balance
 * application + occurrence marking for duplicates — never throwing, so the
 * caller's withTransactionAsync isn't rolled back by an expected dupe.
 *
 * Sync payload uses the Supabase VIEW column names + real booleans (the local
 * row uses `description` for clean text and 0/1 booleans; push.ts sends the
 * payload object verbatim, so it must already be view-shaped).
 */
export async function insertLedgerTransaction(
  db: SQLiteDatabase,
  payload: LedgerTxPayload,
  now: string
): Promise<{ inserted: boolean; id: string }> {
  try {
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, account_id, category_id, categorization_source,
         amount, currency_code, direction,
         description, merchant_name, raw_description, transaction_date, status, idempotency_key,
         is_excluded, is_recurring, notes, provider, capture_method,
         transfer_group_id, recurrence_group_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.id,
        payload.user_id,
        payload.account_id,
        payload.category_id,
        payload.categorization_source,
        payload.amount,
        payload.currency_code,
        payload.direction,
        payload.clean_description,
        payload.merchant_name,
        payload.raw_description,
        payload.transaction_date,
        payload.status,
        payload.idempotency_key,
        payload.is_excluded ? 1 : 0,
        payload.is_recurring ? 1 : 0,
        payload.notes,
        payload.provider,
        payload.capture_method,
        payload.transfer_group_id,
        payload.recurrence_group_id,
        payload.created_at,
        payload.updated_at,
      ]
    );
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { inserted: false, id: payload.id };
    }
    throw err;
  }

  // Sync payload: Supabase view columns + real booleans (mirror push.ts intent).
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('transactions', ?, 'INSERT', ?, ?)`,
    [payload.id, JSON.stringify(payload), now]
  );

  return { inserted: true, id: payload.id };
}

/** True for a SQLite UNIQUE constraint violation (idempotency_key collision). */
function isUniqueConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed|constraint failed: transactions\.idempotency_key/i.test(
    message
  );
}

// ─── Balance application ──────────────────────────────────────────────────────

/**
 * Apply a signed balance DELTA to an account (the webapp's
 * applyAccountBalanceDelta + buildDebtBalanceUpdatePayload path). Debt accounts
 * get current_balance + available_balance + currency_balances written together;
 * non-debt accounts get only current_balance. Bumps updated_at and coalesces
 * the sync UPDATE. Returns the new balance.
 *
 * Multi-currency degrades gracefully: buildDebtBalanceUpdatePayload only writes
 * `currency_balances` when the column holds a map with the currency key — when
 * absent (older installs / unparsed column) only top-level balances are written
 * (matches the webapp's "currency_balances missing key" warning path).
 */
export async function applyLocalBalanceDelta(
  db: SQLiteDatabase,
  account: LedgerAccountRow,
  direction: TransactionDirection,
  amount: number,
  currencyCode: string,
  now: string
): Promise<number> {
  const isDebt = isDebtAccountType(account.account_type);
  const nextBalance = applyAccountBalanceDelta({
    currentBalance: account.current_balance,
    accountType: account.account_type,
    direction,
    amount,
  });

  const currencyBalances = parseCurrencyBalances(account.currency_balances);

  const payload: Record<string, unknown> = isDebt
    ? buildDebtBalanceUpdatePayload(
        { credit_limit: account.credit_limit, currency_balances: currencyBalances },
        nextBalance,
        currencyCode
      )
    : { current_balance: nextBalance };
  payload.updated_at = now;

  await runAccountBalanceUpdate(db, account.id, payload, now);

  // Keep the in-memory row consistent for callers that hit the same account
  // twice in one mutation (e.g. a debt leg pair).
  account.current_balance = nextBalance;
  if (typeof payload.available_balance === "number") {
    account.available_balance = payload.available_balance as number;
  }
  if (payload.currency_balances !== undefined) {
    account.currency_balances = payload.currency_balances;
  }

  return nextBalance;
}

/**
 * Reconcile-only OVERWRITE of an account's balance. Unlike applyLocalBalanceDelta
 * this sets current_balance directly (NO delta — calling applyAccountBalanceDelta
 * here would double-count the adjustment transactions). Recomputes
 * available_balance for CREDIT_CARD when credit_limit is known, persists the
 * currency_balances JSON when provided, bumps updated_at, coalesces the sync
 * UPDATE.
 */
export async function setLocalBalanceOverwrite(
  db: SQLiteDatabase,
  account: LedgerAccountRow,
  primaryBalance: number,
  currencyBalances: Record<string, unknown> | null,
  now: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    current_balance: primaryBalance,
    updated_at: now,
  };

  if (account.account_type === "CREDIT_CARD" && account.credit_limit != null) {
    payload.available_balance = Math.max(account.credit_limit - primaryBalance, 0);
  }

  if (currencyBalances !== null) {
    payload.currency_balances = currencyBalances;
  }

  await runAccountBalanceUpdate(db, account.id, payload, now);

  account.current_balance = primaryBalance;
  if (typeof payload.available_balance === "number") {
    account.available_balance = payload.available_balance as number;
  }
  if (currencyBalances !== null) {
    account.currency_balances = currencyBalances;
  }
}

/**
 * Apply a bank-reported statement balance to an account (Tier-1 PDF import).
 * Like setLocalBalanceOverwrite this OVERWRITES current_balance (never a delta —
 * that would double-count against the imported tx rows), but uses the bank's
 * `available_credit` DIRECTLY rather than recomputing it, and writes the
 * per-currency entry for the statement's currency — mirroring webapp
 * processStatementMeta. Idempotent: a re-import sets the same figures.
 */
export async function applyStatementMetaBalance(
  db: SQLiteDatabase,
  account: LedgerAccountRow,
  meta: {
    currentBalance: number;
    availableBalance?: number | null;
    creditLimit?: number | null;
    totalPaymentDue?: number | null;
    currencyCode: string;
  },
  now: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    current_balance: meta.currentBalance,
    updated_at: now,
  };
  if (meta.availableBalance != null) payload.available_balance = meta.availableBalance;

  // Mirror the per-currency entry webapp writes into currency_balances.
  const currencyBalances = parseCurrencyBalances(account.currency_balances) ?? {};
  const entry: Record<string, unknown> = {
    ...(currencyBalances[meta.currencyCode] ?? {}),
  };
  entry.current_balance = meta.currentBalance;
  if (meta.availableBalance != null) entry.available_balance = meta.availableBalance;
  if (meta.creditLimit != null) entry.credit_limit = meta.creditLimit;
  if (meta.totalPaymentDue != null) entry.total_payment_due = meta.totalPaymentDue;
  currencyBalances[meta.currencyCode] = entry;
  payload.currency_balances = currencyBalances;

  await runAccountBalanceUpdate(db, account.id, payload, now);

  account.current_balance = meta.currentBalance;
  if (meta.availableBalance != null) account.available_balance = meta.availableBalance;
  account.currency_balances = currencyBalances;
}

// ─── Internal: write the account row + coalesce sync ─────────────────────────

/**
 * Apply a balance payload to the local accounts row (only the columns the
 * payload actually carries) and enqueue/coalesce the sync UPDATE.
 *
 * Multi-currency degrades gracefully: `currency_balances` (a JSON column whose
 * entries carry per-currency total_payment_due/available_balance) is written to
 * the local row ONLY when that column exists (added in the schema migration). On
 * older installs the column write is skipped silently and only top-level
 * current_balance/available_balance land — matching the webapp's documented
 * warning path. The sync payload carries the same view-shaped fields.
 */
async function runAccountBalanceUpdate(
  db: SQLiteDatabase,
  accountId: string,
  payload: Record<string, unknown>,
  now: string
): Promise<void> {
  const hasCurrencyBalancesColumn = await accountsHasColumn(db, "currency_balances");

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if ("current_balance" in payload) {
    setClauses.push("current_balance = ?");
    values.push(payload.current_balance as number);
  }
  if ("available_balance" in payload) {
    setClauses.push("available_balance = ?");
    values.push(payload.available_balance as number);
  }
  if ("currency_balances" in payload && hasCurrencyBalancesColumn) {
    setClauses.push("currency_balances = ?");
    const cb = payload.currency_balances;
    values.push(cb == null ? null : JSON.stringify(cb));
  }
  setClauses.push("updated_at = ?");
  values.push(now);
  values.push(accountId);

  await db.runAsync(
    `UPDATE accounts SET ${setClauses.join(", ")} WHERE id = ?`,
    values
  );

  await enqueueAccountUpdateCoalesced(db, accountId, payload, now);
}

const accountsColumnCache = new Map<string, boolean>();

/** Cheap PRAGMA-backed check so balance writes degrade gracefully before the
 * currency_balances column exists on older installs. */
async function accountsHasColumn(db: SQLiteDatabase, column: string): Promise<boolean> {
  const cached = accountsColumnCache.get(column);
  if (cached !== undefined) return cached;
  const cols = await db.getAllAsync<{ name: string }>("PRAGMA table_info(accounts)");
  const present = cols.some((c) => c.name === column);
  accountsColumnCache.set(column, present);
  return present;
}

/** Parse the stored currency_balances (JSON string or object) into a map, or
 * null when absent — so buildDebtBalanceUpdatePayload only touches the JSON when
 * it actually has the currency key. */
export function parseCurrencyBalances(
  raw: unknown
): Record<string, Record<string, unknown>> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, Record<string, unknown>>;
  return null;
}
