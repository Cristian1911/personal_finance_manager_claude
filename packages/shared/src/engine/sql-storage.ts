import { toDialect, toIso, toJson, toNumber } from "./sql";
import type { CommandResult, SqlDriver, StoragePort } from "./types";

/**
 * The single SQL implementation of StoragePort. Table and column names match
 * the real Supabase views (`accounts`, `transactions`) and the phone's v2
 * SQLite tables, so the same statements run on both.
 */
export function createSqlStorage(driver: SqlDriver): StoragePort {
  const q = <R = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    driver.query<R>(toDialect(sql, driver.dialect), params);
  const pg = driver.dialect === "postgres";

  const storage: StoragePort = {
    withTransaction: (fn) => driver.transaction((tx) => fn(createSqlStorage(tx))),

    async findCommand(id) {
      const rows = await q<{ id: string; result: unknown }>(
        "SELECT id, result FROM commands WHERE id = ?", [id]);
      return rows[0] ? { id: String(rows[0].id), result: toJson<CommandResult>(rows[0].result) } : null;
    },

    async recordCommand(cmd, result) {
      const payload = JSON.stringify(cmd.payload);
      await q(
        pg
          ? "INSERT INTO commands (id, user_id, device_id, type, client_ts, payload_enc, status, result) VALUES (?, ?, ?, ?, ?, zeta_encrypt(?), ?, ?::jsonb)"
          : "INSERT INTO commands (id, user_id, device_id, type, client_ts, payload, status, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [cmd.id, cmd.userId, cmd.deviceId, cmd.type, cmd.clientTs, payload, result.status, JSON.stringify(result)],
      );
    },

    async getAccount(id) {
      const rows = await q<{ id: string; user_id: string; current_balance: unknown }>(
        "SELECT id, user_id, current_balance FROM accounts WHERE id = ?", [id]);
      const r = rows[0];
      return r ? { id: String(r.id), userId: String(r.user_id), currentBalance: toNumber(r.current_balance) } : null;
    },

    async adjustAccountBalance(id, delta) {
      await q("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", [delta, id]);
    },

    async findTransactionByIdempotencyKey(key) {
      const rows = await q<{ id: string }>("SELECT id FROM transactions WHERE idempotency_key = ?", [key]);
      return rows[0] ? { id: String(rows[0].id) } : null;
    },

    async insertTransaction(t) {
      await q(
        "INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, clean_description, notes, capture_method, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.userId, t.accountId, t.amount, t.currencyCode, t.direction, t.transactionDate,
          t.cleanDescription, t.notes, t.captureMethod, t.idempotencyKey],
      );
    },

    async getTransaction(id) {
      const rows = await q<Record<string, unknown>>(
        "SELECT id, user_id, account_id, amount, direction, clean_description, notes, idempotency_key FROM transactions WHERE id = ?",
        [id]);
      const r = rows[0];
      if (!r) return null;
      return {
        id: String(r.id),
        userId: String(r.user_id),
        accountId: String(r.account_id),
        amount: toNumber(r.amount),
        direction: r.direction as "INFLOW" | "OUTFLOW",
        cleanDescription: (r.clean_description as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        idempotencyKey: String(r.idempotency_key),
      };
    },

    async updateTransactionNotes(id, notes) {
      await q("UPDATE transactions SET notes = ? WHERE id = ?", [notes, id]);
    },

    async getFieldVersion(entity, entityId, field) {
      const rows = await q<{ client_ts: unknown }>(
        "SELECT client_ts FROM field_versions WHERE entity = ? AND entity_id = ? AND field = ?",
        [entity, entityId, field]);
      return rows[0] ? toIso(rows[0].client_ts) : null;
    },

    async setFieldVersion(v) {
      await q(
        "INSERT INTO field_versions (user_id, entity, entity_id, field, client_ts, command_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (entity, entity_id, field) DO UPDATE SET client_ts = excluded.client_ts, command_id = excluded.command_id",
        [v.userId, v.entity, v.entityId, v.field, v.clientTs, v.commandId],
      );
    },
  };
  return storage;
}
