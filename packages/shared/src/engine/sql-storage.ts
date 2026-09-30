import { toDialect, toIso, toJson, toNumber } from "./sql";
import type { CommandResult, CycleSettingsPatch, SqlDriver, StoragePort, StoredPaySchedule } from "./types";

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

    async findCommand(userId, id) {
      const rows = await q<{ id: string; result: unknown }>(
        "SELECT id, result FROM commands WHERE user_id = ? AND id = ?", [userId, id]);
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

    async getAccount(userId, id) {
      const rows = await q<{ id: string; user_id: string; account_type: string; current_balance: unknown }>(
        "SELECT id, user_id, account_type, current_balance FROM accounts WHERE user_id = ? AND id = ?", [userId, id]);
      const r = rows[0];
      return r
        ? { id: String(r.id), userId: String(r.user_id), accountType: String(r.account_type), currentBalance: toNumber(r.current_balance) }
        : null;
    },

    async adjustAccountBalance(userId, id, delta) {
      // Postgres writes the base table: the `accounts` view's INSTEAD OF trigger
      // stores an absolute value from an unlocked snapshot, which would lose a
      // concurrent delta. ROUND keeps SQLite's REAL at cents like numeric(15,2).
      await q(
        `UPDATE ${pg ? "accounts_enc" : "accounts"} SET current_balance = ROUND(current_balance + ?, 2) WHERE user_id = ? AND id = ?`,
        [delta, userId, id],
      );
    },

    async findTransactionByIdempotencyKey(userId, key) {
      const rows = await q<{ id: string }>(
        "SELECT id FROM transactions WHERE user_id = ? AND idempotency_key = ?", [userId, key]);
      return rows[0] ? { id: String(rows[0].id) } : null;
    },

    async insertTransaction(t) {
      await q(
        "INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, clean_description, notes, capture_method, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.userId, t.accountId, t.amount, t.currencyCode, t.direction, t.transactionDate,
          t.cleanDescription, t.notes, t.captureMethod, t.idempotencyKey],
      );
    },

    async getTransaction(userId, id) {
      const rows = await q<Record<string, unknown>>(
        "SELECT id, user_id, account_id, amount, direction, clean_description, notes, idempotency_key FROM transactions WHERE user_id = ? AND id = ?",
        [userId, id]);
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

    async updateTransactionNotes(userId, id, notes) {
      await q("UPDATE transactions SET notes = ? WHERE user_id = ? AND id = ?", [notes, userId, id]);
    },

    async getFieldVersion(userId, entity, entityId, field) {
      const rows = await q<{ client_ts: unknown; command_id: string }>(
        "SELECT client_ts, command_id FROM field_versions WHERE user_id = ? AND entity = ? AND entity_id = ? AND field = ?",
        [userId, entity, entityId, field]);
      return rows[0] ? { clientTs: toIso(rows[0].client_ts), commandId: String(rows[0].command_id) } : null;
    },

    async setFieldVersion(v) {
      await q(
        "INSERT INTO field_versions (user_id, entity, entity_id, field, client_ts, command_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, entity, entity_id, field) DO UPDATE SET client_ts = excluded.client_ts, command_id = excluded.command_id",
        [v.userId, v.entity, v.entityId, v.field, v.clientTs, v.commandId],
      );
    },

    async getCycleSettings(userId) {
      // date as text on Postgres: a JS Date would shift the day with the time zone.
      const rows = await q<Record<string, unknown>>(
        `SELECT schedule_kind, payday_1, payday_2, ${pg ? "biweekly_anchor::text" : "biweekly_anchor"} AS biweekly_anchor,
           income_per_cycle, savings_per_cycle, balance_anchor, balance_anchor_at, big_purchase_threshold
         FROM user_cycle_settings WHERE user_id = ?`,
        [userId]);
      const r = rows[0];
      if (!r) return null;
      const num = (v: unknown) => (v == null ? null : toNumber(v));
      let schedule: StoredPaySchedule | null = null;
      switch (r.schedule_kind) {
        case "semimonthly": schedule = { kind: "semimonthly", paydays: [toNumber(r.payday_1), toNumber(r.payday_2)] }; break;
        case "monthly": schedule = { kind: "monthly", paydays: [toNumber(r.payday_1)] }; break;
        case "biweekly": schedule = { kind: "biweekly", anchor: String(r.biweekly_anchor) }; break;
        case "irregular": schedule = { kind: "irregular" }; break;
      }
      return {
        schedule,
        incomePerCycle: num(r.income_per_cycle),
        savingsPerCycle: toNumber(r.savings_per_cycle),
        balanceAnchor: r.balance_anchor == null ? null : { balance: toNumber(r.balance_anchor), at: toIso(r.balance_anchor_at) },
        bigPurchaseThreshold: toNumber(r.big_purchase_threshold),
      };
    },

    async upsertCycleSettings(userId, patch) {
      const cols = cycleSettingsColumns(patch);
      const names = Object.keys(cols);
      if (names.length === 0) return;
      await q(
        `INSERT INTO user_cycle_settings (user_id, ${names.join(", ")}) VALUES (?, ${names.map(() => "?").join(", ")})
         ON CONFLICT (user_id) DO UPDATE SET ${names.map((n) => `${n} = excluded.${n}`).join(", ")}, updated_at = CURRENT_TIMESTAMP`,
        [userId, ...Object.values(cols)]);
    },

    async getAccountSetting(userId, accountId) {
      const rows = await q<{ counts_in_disponible: unknown }>(
        "SELECT counts_in_disponible FROM account_settings WHERE user_id = ? AND account_id = ?", [userId, accountId]);
      // SQLite stores booleans as 0/1.
      return rows[0] ? { countsInDisponible: rows[0].counts_in_disponible === true || rows[0].counts_in_disponible === 1 } : null;
    },

    async setAccountSetting(userId, accountId, countsInDisponible) {
      await q(
        `INSERT INTO account_settings (user_id, account_id, counts_in_disponible) VALUES (?, ?, ?)
         ON CONFLICT (user_id, account_id) DO UPDATE SET counts_in_disponible = excluded.counts_in_disponible, updated_at = CURRENT_TIMESTAMP`,
        [userId, accountId, pg ? countsInDisponible : countsInDisponible ? 1 : 0]);
    },
  };
  return storage;
}

/** Only these column names ever reach the SQL (never payload keys). */
function cycleSettingsColumns(p: CycleSettingsPatch): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (p.schedule) {
    const s = p.schedule;
    c.schedule_kind = s.kind;
    c.payday_1 = s.kind === "semimonthly" || s.kind === "monthly" ? s.paydays[0] : null;
    c.payday_2 = s.kind === "semimonthly" ? s.paydays[1] : null;
    c.biweekly_anchor = s.kind === "biweekly" ? s.anchor : null;
  }
  if (p.incomePerCycle !== undefined) c.income_per_cycle = p.incomePerCycle;
  if (p.savingsPerCycle !== undefined) c.savings_per_cycle = p.savingsPerCycle;
  if (p.balanceAnchor !== undefined) {
    c.balance_anchor = p.balanceAnchor?.balance ?? null;
    c.balance_anchor_at = p.balanceAnchor?.at ?? null;
  }
  if (p.bigPurchaseThreshold !== undefined) c.big_purchase_threshold = p.bigPurchaseThreshold;
  return c;
}
