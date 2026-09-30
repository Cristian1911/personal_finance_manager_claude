import { SQLITE_ENGINE_SCHEMA, SQLITE_SETTINGS_SCHEMA } from "../../schema/sqlite";

/** The phone's full schema: every version in order. */
export const SQLITE_SCHEMA = SQLITE_ENGINE_SCHEMA + SQLITE_SETTINGS_SCHEMA;

// Same logical tables in both dialects; names and columns match the real
// Supabase views (`accounts`, `transactions`) and new tables (`commands`,
// `field_versions`) so one SQL implementation serves both.

export const POSTGRES_SCHEMA = `
CREATE FUNCTION zeta_encrypt(plaintext text) RETURNS bytea
  LANGUAGE sql AS $$ SELECT convert_to(plaintext, 'UTF8') $$;
-- Mirrors Supabase: encrypted base table + view of the same name.
CREATE TABLE accounts_enc (
  id uuid PRIMARY KEY, user_id uuid NOT NULL,
  account_type text NOT NULL DEFAULT 'CHECKING',
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
-- v2 settings: same columns and checks as supabase/migrations/20260930155213_v2_settings_tables.sql
-- (migration.test.ts runs that file itself, with RLS).
CREATE TABLE user_cycle_settings (
  user_id uuid PRIMARY KEY,
  schedule_kind text CHECK (schedule_kind IN ('semimonthly', 'monthly', 'biweekly', 'irregular')),
  payday_1 smallint CHECK (payday_1 BETWEEN 1 AND 31),
  payday_2 smallint CHECK (payday_2 BETWEEN 1 AND 31),
  biweekly_anchor date,
  income_per_cycle numeric(15,2) CHECK (income_per_cycle >= 0),
  savings_per_cycle numeric(15,2) NOT NULL DEFAULT 0 CHECK (savings_per_cycle >= 0),
  balance_anchor numeric(15,2),
  balance_anchor_at timestamptz,
  big_purchase_threshold numeric(15,2) NOT NULL DEFAULT 300000 CHECK (big_purchase_threshold > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
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
  user_id uuid NOT NULL, account_id uuid NOT NULL REFERENCES accounts_enc(id) ON DELETE CASCADE,
  counts_in_disponible boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);
`;
