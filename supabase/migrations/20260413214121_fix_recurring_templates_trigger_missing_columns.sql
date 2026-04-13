-- ===========================================================================
-- Fix: recurring_transaction_templates INSERT trigger references
-- last_occurrence_date and next_occurrence_date which don't exist on
-- the _enc table. These were erroneously added by
-- 20260408143013_fix_all_insert_trigger_defaults.sql.
--
-- The original table (20260215180000) never had these columns.
-- The encryption migration (20260408143008) correctly omitted them.
-- But the defaults-fix migration overwrote the trigger with them.
-- ===========================================================================

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
    created_at, updated_at, transfer_source_account_id
  ) VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.amount, NEW.currency_code,
    NEW.direction, NEW.frequency, NEW.day_of_month, NEW.day_of_week,
    zeta_encrypt(NEW.merchant_name), zeta_encrypt(NEW.description),
    NEW.category_id, NEW.is_active, NEW.start_date, NEW.end_date,
    NEW.created_at, NEW.updated_at, NEW.transfer_source_account_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
