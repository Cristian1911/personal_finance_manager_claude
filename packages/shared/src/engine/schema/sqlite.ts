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

/**
 * v2 M1 settings on the phone (phone schema version 2; mirrors
 * supabase/migrations/20260930155213_v2_settings_tables.sql, same checks).
 * A separate constant so the version-1 schema the phone may already have
 * is never edited.
 */
export const SQLITE_SETTINGS_SCHEMA = `
ALTER TABLE accounts ADD COLUMN account_type TEXT NOT NULL DEFAULT 'CHECKING';
CREATE TABLE user_cycle_settings (
  user_id TEXT PRIMARY KEY,
  schedule_kind TEXT CHECK (schedule_kind IN ('semimonthly', 'monthly', 'biweekly', 'irregular')),
  payday_1 INTEGER CHECK (payday_1 BETWEEN 1 AND 31),
  payday_2 INTEGER CHECK (payday_2 BETWEEN 1 AND 31),
  biweekly_anchor TEXT,
  income_per_cycle REAL CHECK (income_per_cycle >= 0),
  savings_per_cycle REAL NOT NULL DEFAULT 0 CHECK (savings_per_cycle >= 0),
  balance_anchor REAL,
  balance_anchor_at TEXT,
  big_purchase_threshold REAL NOT NULL DEFAULT 300000 CHECK (big_purchase_threshold > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (
    schedule_kind IS NULL
    OR (schedule_kind = 'semimonthly' AND payday_1 IS NOT NULL AND payday_2 IS NOT NULL AND payday_1 < payday_2 AND biweekly_anchor IS NULL)
    OR (schedule_kind = 'monthly' AND payday_1 IS NOT NULL AND payday_2 IS NULL AND biweekly_anchor IS NULL)
    OR (schedule_kind = 'biweekly' AND payday_1 IS NULL AND payday_2 IS NULL AND biweekly_anchor IS NOT NULL)
    OR (schedule_kind = 'irregular' AND payday_1 IS NULL AND payday_2 IS NULL AND biweekly_anchor IS NULL)
  ),
  CHECK ((balance_anchor IS NULL) = (balance_anchor_at IS NULL))
);
CREATE TABLE account_settings (
  user_id TEXT NOT NULL, account_id TEXT NOT NULL,
  counts_in_disponible INTEGER NOT NULL CHECK (counts_in_disponible IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, account_id)
);
CREATE TABLE bill_reservations (
  id TEXT NOT NULL, user_id TEXT NOT NULL,
  recurring_template_id TEXT NOT NULL, occurrence_id TEXT,
  amount_per_cycle REAL NOT NULL CHECK (amount_per_cycle > 0),
  starts_on TEXT NOT NULL, released_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, id)
);
`;

/**
 * Phone schema version 3: when each movement was captured, so a movement
 * made on the day of the first-cycle balance ("¿Cuánto tienes hoy?") lands
 * before or after it (computeDisponible's anchor). Commands write it (the
 * command's clientTs) on both databases; rows from before version 3 stay NULL
 * and count as earlier that day. Postgres already has transactions.created_at.
 */
export const SQLITE_CAPTURE_TIME_SCHEMA = `
ALTER TABLE transactions ADD COLUMN created_at TEXT;
`;

/**
 * Phone schema version 4: Ignorar in Detalle ("esto no es un movimiento",
 * D8). Same column as Postgres transactions.is_excluded; 0/1 here.
 */
export const SQLITE_EXCLUDED_SCHEMA = `
ALTER TABLE transactions ADD COLUMN is_excluded INTEGER NOT NULL DEFAULT 0;
`;

/**
 * Phone schema version 5: what an account is called and its card/loan details
 * (Mis cuentas, Agregar). Same columns as the Supabase `accounts` view.
 */
export const SQLITE_ACCOUNTS_SCHEMA = `
ALTER TABLE accounts ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN institution_name TEXT;
ALTER TABLE accounts ADD COLUMN mask TEXT;
ALTER TABLE accounts ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'COP';
ALTER TABLE accounts ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accounts ADD COLUMN credit_limit REAL;
ALTER TABLE accounts ADD COLUMN cutoff_day INTEGER CHECK (cutoff_day BETWEEN 1 AND 31);
ALTER TABLE accounts ADD COLUMN payment_day INTEGER CHECK (payment_day BETWEEN 1 AND 31);
ALTER TABLE accounts ADD COLUMN monthly_payment REAL;
`;

/**
 * Phone schema version 6: Anotar's Ingreso / Entre cuentas. A hand-set flow
 * class (with its version, 0) and the transfer group both legs share.
 */
export const SQLITE_TRANSFER_SCHEMA = `
ALTER TABLE transactions ADD COLUMN flow_class TEXT;
ALTER TABLE transactions ADD COLUMN flow_class_version INTEGER;
ALTER TABLE transactions ADD COLUMN transfer_group_id TEXT;
`;

/**
 * Phone schema version 7: Pagos fijos. Same columns as the Supabase
 * recurring tables. Occurrences are computed from the template; a row is
 * stored only when its status changes, keyed by (template, date) like the
 * server's unique constraint (the server generates its own rows by trigger).
 */
export const SQLITE_RECURRING_SCHEMA = `
CREATE TABLE recurring_transaction_templates (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, account_id TEXT,
  amount REAL NOT NULL, currency_code TEXT NOT NULL DEFAULT 'COP', direction TEXT NOT NULL,
  frequency TEXT NOT NULL, day_of_month INTEGER, start_date TEXT NOT NULL, end_date TEXT,
  merchant_name TEXT, description TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE recurring_occurrences (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, template_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL, expected_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'skipped')),
  transaction_id TEXT, paid_at TEXT, skipped_at TEXT, linked_manually INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  UNIQUE (template_id, occurrence_date)
);
`;

/**
 * Phone schema version 8: categories and destinatarios (S8-2, S9-6). Same
 * columns as the Supabase tables; the 25 categories are built into the app.
 */
export const SQLITE_CATEGORIES_SCHEMA = `
ALTER TABLE transactions ADD COLUMN category_id TEXT;
ALTER TABLE transactions ADD COLUMN destinatario_id TEXT;
CREATE TABLE destinatarios (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('merchant', 'person')),
  default_category_id TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE destinatario_rules (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, destinatario_id TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('contains', 'exact')), pattern TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100, match_count INTEGER NOT NULL DEFAULT 0, last_matched_at TEXT,
  created_at TEXT
);
CREATE UNIQUE INDEX destinatario_rules_user_pattern ON destinatario_rules (user_id, lower(pattern));
`;
