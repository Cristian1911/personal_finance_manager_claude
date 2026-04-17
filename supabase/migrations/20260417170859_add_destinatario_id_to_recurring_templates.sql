-- ============================================================
-- Add destinatario_id FK to recurring_transaction_templates.
--
-- Lets a template anchor to a merchant profile so the occurrence
-- matcher can auto-link new transactions via destinatario instead
-- of relying on amount proximity alone. Not PII — plain UUID FK.
--
-- 6-step encrypted-table process: add column on _enc, rebuild the
-- security_invoker view (CREATE OR REPLACE can't insert a column
-- mid-list), rebuild INSERT + UPDATE + DELETE trigger functions,
-- recreate the INSTEAD OF triggers the view drop cascaded, regrant.
-- ============================================================

BEGIN;

-- Step 1: Add column to the _enc table
ALTER TABLE recurring_transaction_templates_enc
  ADD COLUMN IF NOT EXISTS destinatario_id UUID NULL
    REFERENCES destinatarios_enc(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_templates_destinatario_id
  ON recurring_transaction_templates_enc(destinatario_id)
  WHERE destinatario_id IS NOT NULL;

-- Step 2: Drop the old view + its INSTEAD OF triggers
DROP VIEW IF EXISTS recurring_transaction_templates CASCADE;

-- Step 3: Recreate the decrypting view with destinatario_id
CREATE VIEW recurring_transaction_templates WITH (security_invoker = true) AS
SELECT
  account_id, amount, category_id, created_at, currency_code,
  day_of_month, day_of_week,
  zeta_decrypt(description) AS description,
  destinatario_id,
  direction, end_date, frequency, id, is_active,
  zeta_decrypt(merchant_name) AS merchant_name,
  start_date, sub_payments, transfer_source_account_id, updated_at, user_id
FROM recurring_transaction_templates_enc;

-- Step 4a: INSERT trigger function
CREATE OR REPLACE FUNCTION recurring_templates_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP'::currency_code);
  NEW.is_active := COALESCE(NEW.is_active, true);

  INSERT INTO recurring_transaction_templates_enc (
    id, user_id, account_id, amount, currency_code, direction,
    frequency, day_of_month, day_of_week, merchant_name, description,
    category_id, is_active, start_date, end_date,
    created_at, updated_at, transfer_source_account_id, sub_payments,
    destinatario_id
  ) VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.amount, NEW.currency_code,
    NEW.direction, NEW.frequency, NEW.day_of_month, NEW.day_of_week,
    zeta_encrypt(NEW.merchant_name), zeta_encrypt(NEW.description),
    NEW.category_id, NEW.is_active, NEW.start_date, NEW.end_date,
    NEW.created_at, NEW.updated_at, NEW.transfer_source_account_id,
    NEW.sub_payments,
    NEW.destinatario_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4b: UPDATE trigger function
CREATE OR REPLACE FUNCTION recurring_templates_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE recurring_transaction_templates_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    category_id = NEW.category_id,
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    day_of_month = NEW.day_of_month,
    day_of_week = NEW.day_of_week,
    description = zeta_encrypt(NEW.description),
    destinatario_id = NEW.destinatario_id,
    direction = NEW.direction,
    end_date = NEW.end_date,
    frequency = NEW.frequency,
    is_active = NEW.is_active,
    merchant_name = zeta_encrypt(NEW.merchant_name),
    start_date = NEW.start_date,
    transfer_source_account_id = NEW.transfer_source_account_id,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id,
    sub_payments = NEW.sub_payments
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4c: DELETE trigger function
CREATE OR REPLACE FUNCTION recurring_templates_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM recurring_transaction_templates_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate the INSTEAD OF triggers
CREATE TRIGGER recurring_templates_view_insert_trg
  INSTEAD OF INSERT ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_insert();

CREATE TRIGGER recurring_templates_view_update_trg
  INSTEAD OF UPDATE ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_update();

CREATE TRIGGER recurring_templates_view_delete_trg
  INSTEAD OF DELETE ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_delete();

-- Step 6: Re-grant view permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_transaction_templates TO authenticated;
GRANT ALL ON recurring_transaction_templates TO postgres, service_role;

COMMIT;
