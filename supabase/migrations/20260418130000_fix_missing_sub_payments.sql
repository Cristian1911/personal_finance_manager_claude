-- ===========================================================================
-- Fix missing sub_payments column on recurring_transaction_templates_enc.
--
-- Migration 20260416120000 was stamped in supabase_migrations.schema_migrations
-- on the remote project but the DDL never ran — `sub_payments` is absent on
-- both the encrypted table and the decrypting view. PostgREST therefore fails
-- the plan page's recurrentes query with:
--   "column recurring_transaction_templates_1.sub_payments does not exist"
--
-- This corrective migration re-runs steps 1–4 of the original migration
-- (ALTER TABLE + view rebuild + trigger functions + triggers + grants).
--
-- NOTE: the original migration also had a step 5 that merged duplicate
-- multi-currency templates. That step is INTENTIONALLY OMITTED here because
-- it deletes templates and may drop occurrence→transaction links for pays
-- made since the migration was supposed to run. If the merge is desired,
-- run it in a separate, explicit follow-up migration after review.
-- ===========================================================================

-- Step 1: Add column to the _enc table (idempotent)
ALTER TABLE recurring_transaction_templates_enc
  ADD COLUMN IF NOT EXISTS sub_payments JSONB DEFAULT NULL;

-- Step 2: Drop the old view + its INSTEAD OF triggers (CREATE OR REPLACE VIEW
-- cannot add a column in a non-trailing position, so we drop and recreate).
DROP VIEW IF EXISTS recurring_transaction_templates CASCADE;

-- Step 3: Recreate the decrypting view with sub_payments
CREATE VIEW recurring_transaction_templates WITH (security_invoker = true) AS
SELECT
  account_id, amount, category_id, created_at, currency_code,
  day_of_month, day_of_week,
  zeta_decrypt(description) AS description,
  direction, end_date, frequency, id, is_active,
  zeta_decrypt(merchant_name) AS merchant_name,
  start_date, sub_payments, transfer_source_account_id, updated_at, user_id
FROM recurring_transaction_templates_enc;

-- Step 4a: INSERT trigger function (includes sub_payments)
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
    created_at, updated_at, transfer_source_account_id, sub_payments
  ) VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.amount, NEW.currency_code,
    NEW.direction, NEW.frequency, NEW.day_of_month, NEW.day_of_week,
    zeta_encrypt(NEW.merchant_name), zeta_encrypt(NEW.description),
    NEW.category_id, NEW.is_active, NEW.start_date, NEW.end_date,
    NEW.created_at, NEW.updated_at, NEW.transfer_source_account_id,
    NEW.sub_payments
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4b: UPDATE trigger function (includes sub_payments)
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

-- Step 4c: DELETE trigger function (unchanged from original, recreated for
-- completeness since CASCADE drops depend on the triggers below).
CREATE OR REPLACE FUNCTION recurring_templates_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM recurring_transaction_templates_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate the INSTEAD OF triggers dropped by CASCADE
CREATE TRIGGER recurring_templates_view_insert_trg
  INSTEAD OF INSERT ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_insert();

CREATE TRIGGER recurring_templates_view_update_trg
  INSTEAD OF UPDATE ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_update();

CREATE TRIGGER recurring_templates_view_delete_trg
  INSTEAD OF DELETE ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_delete();

-- Step 6: Re-grant the permissions CASCADE dropped with the view
GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_transaction_templates TO authenticated;
GRANT ALL ON recurring_transaction_templates TO postgres, service_role;
