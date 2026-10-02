import { toDialect, toIso, toNumber } from "./sql";
import type { SqlDriver } from "./types";

/**
 * What a phone holds, table by table (S9-4). One column list for both ends:
 * the server reads these columns through its views (decrypted, as the user)
 * and the phone writes them into SQLCipher. Types turn Postgres values into
 * JSON and back into SQLite's.
 */
type Kind = "text" | "num" | "bool" | "date" | "ts";
interface SyncTable {
  name: string;
  cols: Record<string, Kind>;
  /** Only rows dated on or after `since` (the rest stay as the phone has them). */
  dateCol?: string;
}

const T = "text", N = "num", B = "bool", D = "date", TS = "ts";
export const SYNC_TABLES: SyncTable[] = [
  {
    name: "accounts",
    cols: {
      id: T, user_id: T, name: T, account_type: T, institution_name: T, mask: T, currency_code: T, current_balance: N,
      is_active: B, credit_limit: N, cutoff_day: N, payment_day: N, monthly_payment: N,
    },
  },
  { name: "account_settings", cols: { user_id: T, account_id: T, counts_in_disponible: B, updated_at: TS } },
  {
    name: "user_cycle_settings",
    cols: {
      user_id: T, schedule_kind: T, payday_1: N, payday_2: N, biweekly_anchor: D, income_per_cycle: N, savings_per_cycle: N,
      balance_anchor: N, balance_anchor_at: TS, big_purchase_threshold: N, created_at: TS, updated_at: TS,
    },
  },
  {
    name: "transactions",
    dateCol: "transaction_date",
    cols: {
      id: T, user_id: T, account_id: T, amount: N, currency_code: T, direction: T, transaction_date: D, clean_description: T,
      notes: T, capture_method: T, idempotency_key: T, created_at: TS, is_excluded: B, flow_class: T, flow_class_version: N,
      transfer_group_id: T, category_id: T, destinatario_id: T,
      raw_description: T, transaction_time: T, merchant_name: T, source_pattern: T, reconciled_into_transaction_id: T, provider: T, status: T,
    },
  },
  {
    name: "recurring_transaction_templates",
    cols: {
      id: T, user_id: T, account_id: T, amount: N, currency_code: T, direction: T, frequency: T, day_of_month: N,
      start_date: D, end_date: D, merchant_name: T, description: T, is_active: B, created_at: TS, updated_at: TS,
    },
  },
  {
    name: "recurring_occurrences",
    dateCol: "occurrence_date",
    cols: {
      id: T, user_id: T, template_id: T, occurrence_date: D, expected_amount: N, status: T, transaction_id: T,
      paid_at: TS, skipped_at: TS, linked_manually: B, created_at: TS,
    },
  },
];

// Appended after the tables above (order matters for nothing but readability).
SYNC_TABLES.push(
  { name: "destinatarios", cols: { id: T, user_id: T, name: T, kind: T, default_category_id: T, is_active: B, created_at: TS, updated_at: TS } },
  {
    name: "destinatario_rules",
    cols: { id: T, user_id: T, destinatario_id: T, match_type: T, pattern: T, priority: N, match_count: N, last_matched_at: TS, created_at: TS },
  },
  // Which fields the user chose (and when): without it, a reinstalled or second phone would let
  // "¿Siempre…?" overwrite a category picked by hand until the next pull.
  { name: "field_versions", cols: { user_id: T, entity: T, entity_id: T, field: T, client_ts: TS, command_id: T } },
  {
    name: "statement_snapshots",
    cols: {
      id: T, user_id: T, account_id: T, period_from: D, period_to: D, final_balance: N, total_payment_due: N, minimum_payment: N,
      payment_due_date: D, interest_rate: N, currency_code: T, transaction_count: N,
      previous_balance: N, purchases_and_charges: N, interest_charged: N, imported_count: N, skipped_count: N, created_at: TS, updated_at: TS,
    },
  },
);

export type Snapshot = Record<string, Record<string, unknown>[]>;

function toJson(kind: Kind, v: unknown): unknown {
  if (v == null) return null;
  if (kind === "num") return toNumber(v);
  if (kind === "bool") return v === true || v === 1;
  if (kind === "ts") return toIso(v);
  return String(v);
}

/** The user's rows (server side, or any driver): everything, and dated tables from `since`. */
export async function readSnapshot(driver: SqlDriver, userId: string, since: string): Promise<Snapshot> {
  const pg = driver.dialect === "postgres";
  const out: Snapshot = {};
  for (const t of SYNC_TABLES) {
    // Dates as text on Postgres: a JS Date would shift the day with the time zone.
    const select = Object.entries(t.cols).map(([c, k]) => (pg && k === "date" ? `${c}::text AS ${c}` : c)).join(", ");
    const rows = await driver.query<Record<string, unknown>>(
      toDialect(`SELECT ${select} FROM ${t.name} WHERE user_id = ?${t.dateCol ? ` AND ${t.dateCol} >= ?` : ""}`, driver.dialect),
      t.dateCol ? [userId, since] : [userId],
    );
    out[t.name] = rows.map((r) => Object.fromEntries(Object.entries(t.cols).map(([c, k]) => [c, toJson(k, r[c])])));
  }
  return out;
}

/**
 * Replaces the phone's copy with the server's, in one transaction. Only call
 * it with an empty outbox: rows the server doesn't have yet would be lost.
 * Undated tables are replaced whole; dated ones from `since` on.
 */
export async function applySnapshot(driver: SqlDriver, userId: string, snapshot: Snapshot, since: string): Promise<void> {
  await driver.transaction(async (tx) => {
    for (const t of SYNC_TABLES) {
      const rows = snapshot[t.name];
      if (!Array.isArray(rows)) throw new Error(`Snapshot without ${t.name}`);
      await tx.query(
        toDialect(`DELETE FROM ${t.name} WHERE user_id = ?${t.dateCol ? ` AND ${t.dateCol} >= ?` : ""}`, tx.dialect),
        t.dateCol ? [userId, since] : [userId],
      );
      const cols = Object.keys(t.cols);
      // Upsert: a row the phone holds outside the window (e.g. its date moved on another device)
      // would otherwise clash on its id and fail every pull.
      const verb = tx.dialect === "sqlite" ? "INSERT OR REPLACE" : "INSERT";
      const sql = toDialect(`${verb} INTO ${t.name} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, tx.dialect);
      for (const r of rows) {
        // Never trust a row for someone else (defense in depth; the server already scopes).
        if (r.user_id !== userId) continue;
        await tx.query(sql, cols.map((c) => {
          const v = r[c] ?? null;
          return t.cols[c] === "bool" && tx.dialect === "sqlite" && v != null ? (v ? 1 : 0) : v;
        }));
      }
    }
  });
}
