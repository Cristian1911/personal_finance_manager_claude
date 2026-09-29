// Same logical tables in both dialects; names and columns match the real
// Supabase views (`accounts`, `transactions`) and new tables (`commands`,
// `field_versions`) so one SQL implementation serves both.

export const SQLITE_SCHEMA = `
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
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT NOT NULL,
  type TEXT NOT NULL, client_ts TEXT NOT NULL, payload TEXT,
  status TEXT NOT NULL, result TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE field_versions (
  user_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  field TEXT NOT NULL, client_ts TEXT NOT NULL, command_id TEXT NOT NULL,
  PRIMARY KEY (entity, entity_id, field)
);
`;

export const POSTGRES_SCHEMA = `
CREATE FUNCTION zeta_encrypt(plaintext text) RETURNS bytea
  LANGUAGE sql AS $$ SELECT convert_to(plaintext, 'UTF8') $$;
CREATE TABLE accounts (
  id uuid PRIMARY KEY, user_id uuid NOT NULL,
  current_balance numeric(15,2) NOT NULL DEFAULT 0
);
CREATE TABLE transactions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, account_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL, currency_code text NOT NULL, direction text NOT NULL,
  transaction_date date NOT NULL, clean_description text, notes text,
  capture_method text NOT NULL, idempotency_key text NOT NULL UNIQUE
);
CREATE TABLE commands (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, device_id text NOT NULL,
  type text NOT NULL, client_ts timestamptz NOT NULL, payload_enc bytea,
  status text NOT NULL, result jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE field_versions (
  user_id uuid NOT NULL, entity text NOT NULL, entity_id uuid NOT NULL,
  field text NOT NULL, client_ts timestamptz NOT NULL, command_id uuid NOT NULL,
  PRIMARY KEY (entity, entity_id, field)
);
`;
