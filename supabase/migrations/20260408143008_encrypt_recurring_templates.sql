-- ==================================================
-- Encrypt recurring_transaction_templates (2 encrypted)
-- ==================================================

ALTER TABLE recurring_transaction_templates RENAME TO recurring_transaction_templates_enc;

ALTER TABLE recurring_transaction_templates_enc
  ALTER COLUMN description TYPE BYTEA USING zeta_encrypt_as(description, user_id);
ALTER TABLE recurring_transaction_templates_enc
  ALTER COLUMN merchant_name TYPE BYTEA USING zeta_encrypt_as(merchant_name, user_id);

CREATE VIEW recurring_transaction_templates WITH (security_invoker = true) AS
SELECT
  account_id, amount, category_id, created_at, currency_code,
  day_of_month, day_of_week,
  zeta_decrypt(description) AS description,
  direction, end_date, frequency, id, is_active,
  zeta_decrypt(merchant_name) AS merchant_name,
  start_date, transfer_source_account_id, updated_at, user_id
FROM recurring_transaction_templates_enc;

CREATE OR REPLACE FUNCTION recurring_templates_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO recurring_transaction_templates_enc (
    account_id, amount, category_id, created_at, currency_code,
    day_of_month, day_of_week, description, direction, end_date,
    frequency, id, is_active, merchant_name, start_date,
    transfer_source_account_id, updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.category_id, NEW.created_at,
    NEW.currency_code, NEW.day_of_month, NEW.day_of_week,
    zeta_encrypt(NEW.description),
    NEW.direction, NEW.end_date, NEW.frequency, NEW.id, NEW.is_active,
    zeta_encrypt(NEW.merchant_name),
    NEW.start_date, NEW.transfer_source_account_id, NEW.updated_at,
    NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_templates_view_insert_trg
  INSTEAD OF INSERT ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_insert();

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
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_templates_view_update_trg
  INSTEAD OF UPDATE ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_update();

CREATE OR REPLACE FUNCTION recurring_templates_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM recurring_transaction_templates_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_templates_view_delete_trg
  INSTEAD OF DELETE ON recurring_transaction_templates
  FOR EACH ROW EXECUTE FUNCTION recurring_templates_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON recurring_transaction_templates TO authenticated;
GRANT ALL ON recurring_transaction_templates TO postgres, service_role;
