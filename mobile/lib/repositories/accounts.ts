import { getDatabase } from "../db/database";
import * as Crypto from "expo-crypto";

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
  payment_day: number | null;
  cutoff_day: number | null;
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
       payment_day, cutoff_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
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
         credit_limit = ?, interest_rate = ?, icon = ?, color = ?,
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
      params.payment_day ?? null,
      params.cutoff_day ?? null,
      now,
      id,
    ]
  );

  // Check if there's a pending INSERT that hasn't synced yet
  const pendingInsert = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue
     WHERE table_name = 'accounts' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  if (pendingInsert) {
    // Update the INSERT payload instead of queuing a separate UPDATE
    const existing = JSON.parse(pendingInsert.payload);
    const updated = {
      ...existing,
      name: params.name,
      institution_name: params.institution_name ?? null,
      currency_code: params.currency_code ?? "COP",
      current_balance: params.current_balance ?? 0,
      credit_limit: params.credit_limit ?? null,
      interest_rate: params.interest_rate ?? null,
      icon: params.icon ?? null,
      color: params.color ?? null,
      payment_day: params.payment_day ?? null,
      cutoff_day: params.cutoff_day ?? null,
      updated_at: now,
    };
    await db.runAsync(
      "UPDATE sync_queue SET payload = ? WHERE id = ?",
      [JSON.stringify(updated), pendingInsert.id]
    );
  } else {
    // Already synced — queue an UPDATE
    const syncPayload = {
      name: params.name,
      institution_name: params.institution_name ?? null,
      currency_code: params.currency_code ?? "COP",
      current_balance: params.current_balance ?? 0,
      credit_limit: params.credit_limit ?? null,
      interest_rate: params.interest_rate ?? null,
      icon: params.icon ?? null,
      color: params.color ?? null,
      payment_day: params.payment_day ?? null,
      cutoff_day: params.cutoff_day ?? null,
      updated_at: now,
    };
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('accounts', ?, 'UPDATE', ?, ?)`,
      [id, JSON.stringify(syncPayload), now]
    );
  }
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDatabase();

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
