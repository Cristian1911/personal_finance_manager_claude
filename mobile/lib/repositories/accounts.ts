import { getDatabase } from "../db/database";
import * as Crypto from "expo-crypto";
import { getDirectionForBalanceDelta } from "@zeta/shared";
import { setPdfPasswordForAccount } from "../pdf-passwords";
import {
  applyLocalBalanceDelta,
  buildLedgerTxPayload,
  computeIdempotencyKey,
  enqueueAccountUpdateCoalesced,
  insertLedgerTransaction,
  parseCurrencyBalances,
  setLocalBalanceOverwrite,
  type LedgerAccountRow,
} from "./ledger-helpers";

export type AccountRow = {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  currency_code: string;
  current_balance: number;
  available_balance: number | null;
  credit_limit: number | null;
  interest_rate: number | null;
  is_active: number;
  icon: string | null;
  color: string | null;
  monthly_payment: number | null;
  payment_day: number | null;
  cutoff_day: number | null;
  show_in_dashboard: number;
  card_brand: string | null;
  debit_card_mask: string | null;
  is_payroll_deducted: number;
  created_at: string;
  updated_at: string;
};

export type CreateAccountParams = {
  user_id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  currency_code?: string;
  current_balance?: number;
  credit_limit?: number | null;
  interest_rate?: number | null;
  monthly_payment?: number | null;
  payment_day?: number | null;
  cutoff_day?: number | null;
  color?: string | null;
  icon?: string | null;
};

export type UpdateAccountParams = Omit<CreateAccountParams, "user_id">;

export async function getAllAccounts(): Promise<AccountRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<AccountRow>(
    "SELECT * FROM accounts WHERE is_active = 1 ORDER BY name"
  );
}

export async function getAccountById(id: string): Promise<AccountRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<AccountRow>(
    "SELECT * FROM accounts WHERE id = ?",
    [id]
  );
}

export async function createAccount(
  params: CreateAccountParams
): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  const currencyCode = params.currency_code ?? "COP";
  const currentBalance = params.current_balance ?? 0;

  await db.runAsync(
    `INSERT INTO accounts
      (id, user_id, name, account_type, institution_name, currency_code,
       current_balance, credit_limit, interest_rate, is_active, icon, color,
       monthly_payment, payment_day, cutoff_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.user_id,
      params.name,
      params.account_type,
      params.institution_name ?? null,
      currencyCode,
      currentBalance,
      params.credit_limit ?? null,
      params.interest_rate ?? null,
      params.icon ?? null,
      params.color ?? null,
      params.monthly_payment ?? null,
      params.payment_day ?? null,
      params.cutoff_day ?? null,
      now,
      now,
    ]
  );

  // Queue for sync — Supabase uses booleans, not integers
  const syncPayload = {
    id,
    user_id: params.user_id,
    name: params.name,
    account_type: params.account_type,
    institution_name: params.institution_name ?? null,
    currency_code: currencyCode,
    current_balance: currentBalance,
    credit_limit: params.credit_limit ?? null,
    interest_rate: params.interest_rate ?? null,
    is_active: true,
    icon: params.icon ?? null,
    color: params.color ?? null,
    monthly_payment: params.monthly_payment ?? null,
    payment_day: params.payment_day ?? null,
    cutoff_day: params.cutoff_day ?? null,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('accounts', ?, 'INSERT', ?, ?)`,
    [id, JSON.stringify(syncPayload), now]
  );

  return id;
}

export async function updateAccount(
  id: string,
  params: UpdateAccountParams
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE accounts
     SET name = ?, institution_name = ?, currency_code = ?, current_balance = ?,
         credit_limit = ?, interest_rate = ?, icon = ?, color = ?, monthly_payment = ?,
         payment_day = ?, cutoff_day = ?, updated_at = ?
     WHERE id = ?`,
    [
      params.name,
      params.institution_name ?? null,
      params.currency_code ?? "COP",
      params.current_balance ?? 0,
      params.credit_limit ?? null,
      params.interest_rate ?? null,
      params.icon ?? null,
      params.color ?? null,
      params.monthly_payment ?? null,
      params.payment_day ?? null,
      params.cutoff_day ?? null,
      now,
      id,
    ]
  );

  // Queue the field UPDATE, coalescing into a still-unsynced INSERT if present
  // (shared with the ledger mutations via enqueueAccountUpdateCoalesced).
  const syncPayload = {
    name: params.name,
    institution_name: params.institution_name ?? null,
    currency_code: params.currency_code ?? "COP",
    current_balance: params.current_balance ?? 0,
    credit_limit: params.credit_limit ?? null,
    interest_rate: params.interest_rate ?? null,
    icon: params.icon ?? null,
    color: params.color ?? null,
    monthly_payment: params.monthly_payment ?? null,
    payment_day: params.payment_day ?? null,
    cutoff_day: params.cutoff_day ?? null,
    updated_at: now,
  };
  await enqueueAccountUpdateCoalesced(db, id, syncPayload, now);
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDatabase();
  const account = await db.getFirstAsync<{ user_id: string }>(
    "SELECT user_id FROM accounts WHERE id = ?",
    [id]
  );

  // Check if there's a pending INSERT that hasn't synced yet
  const pendingInsert = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM sync_queue
     WHERE table_name = 'accounts' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  // Cascade delete transactions (SQLite FK cascades require PRAGMA foreign_keys = ON,
  // which is enabled at DB init — but we delete manually to also clean sync_queue)
  const txRows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM transactions WHERE account_id = ?",
    [id]
  );
  for (const tx of txRows) {
    await db.runAsync("DELETE FROM sync_queue WHERE table_name = 'transactions' AND record_id = ?", [tx.id]);
    await db.runAsync("DELETE FROM transactions WHERE id = ?", [tx.id]);
  }

  await db.runAsync("DELETE FROM accounts WHERE id = ?", [id]);
  if (account?.user_id) {
    await setPdfPasswordForAccount(account.user_id, id, null);
  }

  if (pendingInsert) {
    // Never synced — remove the pending INSERT
    await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [pendingInsert.id]);
  } else {
    // Already synced — queue a DELETE
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('accounts', ?, 'DELETE', ?, ?)`,
      [id, JSON.stringify({ id }), now]
    );
  }
}

// ─── Quick Payment ───────────────────────────────────────────────────────────

export type RegisterPaymentResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Offline-first mirror of webapp accounts.ts `registerPayment`.
 *
 * Records a payment/income against a target account as a single INFLOW
 * transaction, then updates the target balance (debt → clamp at 0 + recompute
 * available_balance via the shared debt payload; non-debt → +amount). When a
 * source account is given, deducts from it with OUTFLOW semantics — but the
 * source is NOT clamped and its available_balance is NOT recomputed
 * (asymmetric, matching the webapp exactly). The whole mutation is wrapped in
 * one withTransactionAsync so a throw rolls back the tx + both balance writes.
 *
 * Idempotency input (matches webapp): provider "MANUAL", transactionDate =
 * now.slice(0,10), amount, rawDescription = the embedded-ISO "Pago/Ingreso"
 * description (the timestamp is part of the webapp key — preserved verbatim).
 */
export async function registerPayment(
  accountId: string,
  input: { amount: number; sourceAccountId?: string; notes?: string }
): Promise<RegisterPaymentResult> {
  const db = await getDatabase();

  const account = await db.getFirstAsync<LedgerAccountRow>(
    "SELECT * FROM accounts WHERE id = ?",
    [accountId]
  );
  if (!account) return { success: false, error: "Cuenta no encontrada" };
  // Fail fast on a missing user_id — an empty-string user_id produces rows that
  // fail Supabase RLS and stick in sync_queue forever.
  if (!account.user_id) return { success: false, error: "Sesión inválida" };

  const isDebt = account.account_type === "CREDIT_CARD" || account.account_type === "LOAN";
  const now = new Date().toISOString();
  const transactionDate = now.slice(0, 10);

  let sourceAccount: LedgerAccountRow | null = null;
  if (input.sourceAccountId) {
    sourceAccount = await db.getFirstAsync<LedgerAccountRow>(
      "SELECT * FROM accounts WHERE id = ?",
      [input.sourceAccountId]
    );
  }
  const sourceAccountName = sourceAccount?.name ?? "";

  const merchantName = isDebt
    ? `Pago - ${account.name}`
    : `Ingreso - ${account.name}`;
  const rawDescription = isDebt
    ? sourceAccountName
      ? `Pago manual registrado desde ${sourceAccountName} (${now})`
      : `Pago manual registrado (${now})`
    : `Ingreso manual registrado (${now})`;

  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    transactionDate,
    amount: input.amount,
    rawDescription,
  });

  // Debt INFLOW → payment received → balance decreases.
  // Savings INFLOW → money received → balance increases. Always INFLOW.
  const txPayload = buildLedgerTxPayload(
    {
      userId: account.user_id,
      accountId,
      amount: input.amount,
      currencyCode: account.currency_code,
      direction: "INFLOW",
      transactionDate,
      rawDescription,
      merchantName,
      notes: input.notes ?? null,
      idempotencyKey,
    },
    now
  );

  let duplicate = false;
  await db.withTransactionAsync(async () => {
    const { inserted } = await insertLedgerTransaction(db, txPayload, now);
    if (!inserted) {
      duplicate = true;
      return;
    }

    // Target account balance — debt uses the shared clamp + available recompute.
    await applyLocalBalanceDelta(db, account, "INFLOW", input.amount, account.currency_code, now);

    // Source account: OUTFLOW semantics, NOT clamped, available NOT recomputed
    // (asymmetric — matches webapp registerPayment).
    if (sourceAccount) {
      const isDebtSource =
        sourceAccount.account_type === "CREDIT_CARD" || sourceAccount.account_type === "LOAN";
      const nextSource = isDebtSource
        ? sourceAccount.current_balance + input.amount
        : sourceAccount.current_balance - input.amount;
      await db.runAsync(
        "UPDATE accounts SET current_balance = ?, updated_at = ? WHERE id = ?",
        [nextSource, now, sourceAccount.id]
      );
      await enqueueAccountUpdateCoalesced(
        db,
        sourceAccount.id,
        { current_balance: nextSource, updated_at: now },
        now
      );
    }
  });

  if (duplicate) return { success: false, error: "Este pago ya fue registrado" };
  return { success: true };
}

// ─── Reconcile balance (manual adjustment) ───────────────────────────────────

export type ReconcileBalanceInput = {
  currentBalance?: number;
  currencyBalances?: Record<string, number>;
  notes?: string;
};

export type ReconcileBalanceResult =
  | { success: true; delta: number; currencyDeltas: Record<string, number> }
  | { success: false; error: string };

/**
 * Offline-first mirror of webapp accounts.ts `reconcileBalance` — OVERWRITE
 * semantics. For each requested currency it computes delta = new - previous,
 * derives the adjustment direction (debt-inverted) via getDirectionForBalanceDelta,
 * and for every NON-ZERO delta inserts an "Ajuste manual de saldo" transaction
 * (amount = |delta|). It then OVERWRITES the balance with setLocalBalanceOverwrite
 * (never applyLocalBalanceDelta — the adjustment tx already represents the move;
 * a delta-apply would double-count). Single-currency works before the
 * currency_balances column exists; multi-currency persists currency_balances
 * when present. All writes are wrapped in one withTransactionAsync.
 */
export async function reconcileBalance(
  accountId: string,
  input: ReconcileBalanceInput
): Promise<ReconcileBalanceResult> {
  const db = await getDatabase();

  const account = await db.getFirstAsync<LedgerAccountRow>(
    "SELECT * FROM accounts WHERE id = ?",
    [accountId]
  );
  if (!account) return { success: false, error: "Cuenta no encontrada" };

  const requestedBalances =
    input.currencyBalances && Object.keys(input.currencyBalances).length > 0
      ? input.currencyBalances
      : input.currentBalance != null
        ? { [account.currency_code]: input.currentBalance }
        : {};

  // Validate EVERY requested balance before any write (matches webapp).
  for (const [currency, newBalance] of Object.entries(requestedBalances)) {
    if (!Number.isFinite(newBalance) || newBalance < 0) {
      return { success: false, error: `Saldo invalido para ${currency}` };
    }
  }

  const existingCurrencyBalances = parseCurrencyBalances(account.currency_balances) ?? {};
  const shouldPersistCurrencyBalances =
    account.currency_balances != null ||
    Object.keys(requestedBalances).some((currency) => currency !== account.currency_code);

  const now = new Date().toISOString();
  const transactionDate = now.slice(0, 10);
  const currencyDeltas: Record<string, number> = {};

  // Build per-currency adjustment transactions + next currency_balances map.
  type AdjustmentTx = {
    currency: string;
    direction: "INFLOW" | "OUTFLOW";
    amount: number;
    idempotencyKey: string;
    rawDescription: string;
  };
  const adjustments: AdjustmentTx[] = [];

  for (const [currency, newBalance] of Object.entries(requestedBalances)) {
    const previousBalance =
      currency === account.currency_code
        ? account.current_balance ?? 0
        : resolveCurrencyCurrentValue(existingCurrencyBalances[currency]);
    const delta = newBalance - previousBalance;
    currencyDeltas[currency] = delta;

    if (shouldPersistCurrencyBalances) {
      const baseEntry: Record<string, unknown> =
        currency === account.currency_code
          ? {
              current_balance: account.current_balance ?? 0,
              credit_limit: account.credit_limit,
              available_balance: account.available_balance ?? null,
              interest_rate: account.interest_rate ?? null,
              minimum_payment: account.monthly_payment ?? null,
              total_payment_due: null,
              ...(existingCurrencyBalances[currency] ?? {}),
            }
          : (existingCurrencyBalances[currency] ?? {
              current_balance: null,
              credit_limit: null,
              available_balance: null,
              interest_rate: null,
              minimum_payment: null,
              total_payment_due: null,
            });

      const nextEntry: Record<string, unknown> = { ...baseEntry, current_balance: newBalance };

      if (account.account_type === "CREDIT_CARD") {
        const creditLimit =
          (nextEntry.credit_limit as number | null) ??
          (currency === account.currency_code ? account.credit_limit : null);
        nextEntry.total_payment_due = newBalance;
        if (creditLimit != null) {
          nextEntry.credit_limit = creditLimit;
          nextEntry.available_balance = Math.max(creditLimit - newBalance, 0);
        }
      }

      existingCurrencyBalances[currency] = nextEntry;
    }

    if (delta === 0) continue;

    const adjustmentDirection = getDirectionForBalanceDelta({
      accountType: account.account_type,
      delta,
    });
    if (!adjustmentDirection) {
      return { success: false, error: "No se pudo determinar el ajuste de saldo." };
    }

    const rawDescription = `Ajuste manual de saldo ${currency} (${now})`;
    const idempotencyKey = await computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate,
      amount: Math.abs(delta),
      rawDescription,
    });

    adjustments.push({
      currency,
      direction: adjustmentDirection,
      amount: Math.abs(delta),
      idempotencyKey,
      rawDescription,
    });
  }

  const primaryBalance =
    requestedBalances[account.currency_code] ?? account.current_balance ?? 0;

  await db.withTransactionAsync(async () => {
    for (const adj of adjustments) {
      const txPayload = buildLedgerTxPayload(
        {
          userId: account.user_id ?? "",
          accountId,
          amount: adj.amount,
          currencyCode: adj.currency,
          direction: adj.direction,
          transactionDate,
          rawDescription: adj.rawDescription,
          // Webapp sets merchant_name = null + a distinct clean_description.
          // rawDescription stays byte-matched to the webapp idempotency string.
          merchantName: null,
          cleanDescription: "Ajuste manual de saldo",
          categoryId: null,
          categorizationSource: "SYSTEM_DEFAULT",
          notes: input.notes ?? null,
          idempotencyKey: adj.idempotencyKey,
        },
        now
      );
      await insertLedgerTransaction(db, txPayload, now);
    }

    // OVERWRITE the balance (NOT a delta — the adjustment tx already moved it).
    await setLocalBalanceOverwrite(
      db,
      account,
      primaryBalance,
      shouldPersistCurrencyBalances ? existingCurrencyBalances : null,
      now
    );
  });

  return {
    success: true,
    delta: currencyDeltas[account.currency_code] ?? 0,
    currencyDeltas,
  };
}

/**
 * Mirror of resolveCurrencyBalanceCurrentValue (webapp currency-balances.ts):
 * total_payment_due → (credit_limit - available_balance) → current_balance → 0.
 */
function resolveCurrencyCurrentValue(entry: Record<string, unknown> | undefined): number {
  if (!entry) return 0;
  const tpd = entry.total_payment_due;
  if (typeof tpd === "number" && Number.isFinite(tpd)) return tpd;
  const cl = entry.credit_limit;
  const ab = entry.available_balance;
  if (typeof cl === "number" && typeof ab === "number") return Math.max(cl - ab, 0);
  const cb = entry.current_balance;
  return typeof cb === "number" ? cb : 0;
}
