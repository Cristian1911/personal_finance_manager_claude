import { SQLITE_ACCOUNTS_SCHEMA, SQLITE_CAPTURE_TIME_SCHEMA, SQLITE_ENGINE_SCHEMA, SQLITE_EXCLUDED_SCHEMA, SQLITE_CATEGORIES_SCHEMA, SQLITE_RECURRING_SCHEMA, SQLITE_SETTINGS_SCHEMA, SQLITE_TRANSFER_SCHEMA } from "../../schema/sqlite";

/** The phone's full schema: every version in order. */
export const SQLITE_SCHEMA = SQLITE_ENGINE_SCHEMA + SQLITE_SETTINGS_SCHEMA + SQLITE_CAPTURE_TIME_SCHEMA + SQLITE_EXCLUDED_SCHEMA + SQLITE_ACCOUNTS_SCHEMA + SQLITE_TRANSFER_SCHEMA + SQLITE_RECURRING_SCHEMA + SQLITE_CATEGORIES_SCHEMA;

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
  current_balance numeric(15,2) NOT NULL DEFAULT 0,
  -- Plain text here; on Supabase name/institution_name/mask are encrypted behind the view.
  name text NOT NULL DEFAULT '', institution_name text, mask text,
  currency_code text NOT NULL DEFAULT 'COP', is_active boolean NOT NULL DEFAULT true,
  credit_limit numeric(15,2), cutoff_day smallint, payment_day smallint, monthly_payment numeric(15,2)
);
CREATE VIEW accounts AS SELECT * FROM accounts_enc;
CREATE TABLE transactions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, account_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL, currency_code text NOT NULL, direction text NOT NULL,
  transaction_date date NOT NULL, clean_description text, notes text,
  capture_method text NOT NULL, idempotency_key text NOT NULL UNIQUE,
  is_excluded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  flow_class text, flow_class_version smallint, transfer_group_id uuid,
  category_id uuid, destinatario_id uuid
);
-- Plain here; on Supabase destinatarios is a view (name encrypted).
CREATE TABLE destinatarios (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, name text NOT NULL, kind text NOT NULL,
  default_category_id uuid, is_active boolean NOT NULL DEFAULT true, created_at timestamptz, updated_at timestamptz
);
CREATE TABLE destinatario_rules (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, destinatario_id uuid NOT NULL,
  match_type text NOT NULL, pattern text NOT NULL, priority int NOT NULL DEFAULT 100,
  match_count int NOT NULL DEFAULT 0, last_matched_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
-- As on Supabase (20260310044637): one rule per text per user.
CREATE UNIQUE INDEX destinatario_rules_user_pattern ON destinatario_rules (user_id, lower(pattern));
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
-- Recurring (plain here; on Supabase the template is a view over _enc and a trigger generates occurrences).
CREATE TABLE recurring_transaction_templates (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, account_id uuid,
  amount numeric(15,2) NOT NULL, currency_code text NOT NULL DEFAULT 'COP', direction text NOT NULL,
  frequency text NOT NULL, day_of_month int, start_date date NOT NULL, end_date date,
  merchant_name text, description text, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz, updated_at timestamptz
);
CREATE TABLE recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, template_id uuid NOT NULL,
  occurrence_date date NOT NULL, expected_amount numeric(15,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending', transaction_id uuid, paid_at timestamptz, skipped_at timestamptz,
  linked_manually boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, occurrence_date)
);
CREATE TABLE account_settings (
  user_id uuid NOT NULL, account_id uuid NOT NULL REFERENCES accounts_enc(id) ON DELETE CASCADE,
  counts_in_disponible boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);
`;
