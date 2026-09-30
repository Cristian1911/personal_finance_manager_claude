export { SQLITE_ENGINE_SCHEMA as SQLITE_SCHEMA } from "../../schema/sqlite";

// Same logical tables in both dialects; names and columns match the real
// Supabase views (`accounts`, `transactions`) and new tables (`commands`,
// `field_versions`) so one SQL implementation serves both.

export const POSTGRES_SCHEMA = `
CREATE FUNCTION zeta_encrypt(plaintext text) RETURNS bytea
  LANGUAGE sql AS $$ SELECT convert_to(plaintext, 'UTF8') $$;
-- Mirrors Supabase: encrypted base table + view of the same name.
CREATE TABLE accounts_enc (
  id uuid PRIMARY KEY, user_id uuid NOT NULL,
  current_balance numeric(15,2) NOT NULL DEFAULT 0
);
CREATE VIEW accounts AS SELECT * FROM accounts_enc;
CREATE TABLE transactions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, account_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL, currency_code text NOT NULL, direction text NOT NULL,
  transaction_date date NOT NULL, clean_description text, notes text,
  capture_method text NOT NULL, idempotency_key text NOT NULL UNIQUE
);
CREATE TABLE commands (
  id uuid NOT NULL, user_id uuid NOT NULL, device_id text NOT NULL,
  type text NOT NULL, client_ts timestamptz NOT NULL, payload_enc bytea,
  status text NOT NULL, result jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE TABLE field_versions (
  user_id uuid NOT NULL, entity text NOT NULL, entity_id uuid NOT NULL,
  field text NOT NULL, client_ts timestamptz NOT NULL, command_id uuid NOT NULL,
  PRIMARY KEY (user_id, entity, entity_id, field)
);
`;
