/**
 * The engine's tables on SQLite — used by the phone database (mobile/lib/v2)
 * and by the contract tests, so the two can't drift. Column names match the
 * Supabase views; user_id leads the keys like the Postgres migration.
 */
export const SQLITE_ENGINE_SCHEMA = `
CREATE TABLE accounts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  current_balance REAL NOT NULL DEFAULT 0
);
CREATE TABLE transactions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, account_id TEXT NOT NULL,
  amount REAL NOT NULL, currency_code TEXT NOT NULL, direction TEXT NOT NULL,
  transaction_date TEXT NOT NULL, clean_description TEXT, notes TEXT,
  capture_method TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE
);
CREATE TABLE commands (
  id TEXT NOT NULL, user_id TEXT NOT NULL, device_id TEXT NOT NULL,
  type TEXT NOT NULL, client_ts TEXT NOT NULL, payload TEXT,
  status TEXT NOT NULL, result TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, id)
);
CREATE TABLE field_versions (
  user_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  field TEXT NOT NULL, client_ts TEXT NOT NULL, command_id TEXT NOT NULL,
  PRIMARY KEY (user_id, entity, entity_id, field)
);
`;
