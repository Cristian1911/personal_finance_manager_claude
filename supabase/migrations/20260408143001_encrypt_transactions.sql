-- ==================================================
-- Encrypt transactions table (5 encrypted, 2 HMAC)
-- ==================================================

-- 1. Rename table
ALTER TABLE transactions RENAME TO transactions_enc;

-- 2. Add HMAC columns and backfill while data is still plaintext
ALTER TABLE transactions_enc ADD COLUMN merchant_name_hmac TEXT;
ALTER TABLE transactions_enc ADD COLUMN clean_description_hmac TEXT;

UPDATE transactions_enc SET
  merchant_name_hmac = zeta_hmac_as(merchant_name, user_id)
WHERE merchant_name IS NOT NULL;

UPDATE transactions_enc SET
  clean_description_hmac = zeta_hmac_as(clean_description, user_id)
WHERE clean_description IS NOT NULL;

-- 3. Drop GIN text search index that references encrypted columns
--    (COALESCE on clean_description/merchant_name is incompatible with BYTEA)
DROP INDEX IF EXISTS idx_transactions_description_search;

-- 4. Encrypt columns — atomic type change + encryption per column
ALTER TABLE transactions_enc
  ALTER COLUMN raw_description TYPE BYTEA USING zeta_encrypt_as(raw_description, user_id);
ALTER TABLE transactions_enc
  ALTER COLUMN clean_description TYPE BYTEA USING zeta_encrypt_as(clean_description, user_id);
ALTER TABLE transactions_enc
  ALTER COLUMN merchant_name TYPE BYTEA USING zeta_encrypt_as(merchant_name, user_id);
ALTER TABLE transactions_enc
  ALTER COLUMN notes TYPE BYTEA USING zeta_encrypt_as(notes, user_id);
ALTER TABLE transactions_enc
  ALTER COLUMN capture_input_text TYPE BYTEA USING zeta_encrypt_as(capture_input_text, user_id);

-- 4. Create decrypted view
CREATE VIEW transactions WITH (security_invoker = true) AS
SELECT
  account_id, amount, amount_in_base_currency,
  zeta_decrypt(capture_input_text) AS capture_input_text,
  capture_method, categorization_confidence, categorization_source,
  category_id,
  zeta_decrypt(clean_description) AS clean_description,
  clean_description_hmac, created_at, currency_code, destinatario_id,
  direction, exchange_rate, id, idempotency_key, installment_current,
  installment_group_id, installment_total, is_excluded, is_recurring,
  is_subscription, merchant_category_code, merchant_logo_url,
  zeta_decrypt(merchant_name) AS merchant_name,
  merchant_name_hmac,
  zeta_decrypt(notes) AS notes,
  original_amount, posting_date, provider, provider_transaction_id,
  zeta_decrypt(raw_description) AS raw_description,
  reconciled_into_transaction_id, reconciliation_score,
  recurrence_group_id, secondary_category_id, status, tags,
  transaction_date, updated_at, user_id
FROM transactions_enc;

-- 5. INSTEAD OF INSERT trigger
CREATE OR REPLACE FUNCTION transactions_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO transactions_enc (
    account_id, amount, amount_in_base_currency, capture_input_text,
    capture_method, categorization_confidence, categorization_source,
    category_id, clean_description, clean_description_hmac, created_at,
    currency_code, destinatario_id, direction, exchange_rate, id,
    idempotency_key, installment_current, installment_group_id,
    installment_total, is_excluded, is_recurring, is_subscription,
    merchant_category_code, merchant_logo_url, merchant_name,
    merchant_name_hmac, notes, original_amount, posting_date, provider,
    provider_transaction_id, raw_description,
    reconciled_into_transaction_id, reconciliation_score,
    recurrence_group_id, secondary_category_id, status, tags,
    transaction_date, updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.amount_in_base_currency,
    zeta_encrypt(NEW.capture_input_text),
    NEW.capture_method, NEW.categorization_confidence,
    NEW.categorization_source, NEW.category_id,
    zeta_encrypt(NEW.clean_description),
    zeta_hmac(NEW.clean_description),
    NEW.created_at, NEW.currency_code, NEW.destinatario_id,
    NEW.direction, NEW.exchange_rate, NEW.id, NEW.idempotency_key,
    NEW.installment_current, NEW.installment_group_id,
    NEW.installment_total, NEW.is_excluded, NEW.is_recurring,
    NEW.is_subscription, NEW.merchant_category_code,
    NEW.merchant_logo_url,
    zeta_encrypt(NEW.merchant_name),
    zeta_hmac(NEW.merchant_name),
    zeta_encrypt(NEW.notes),
    NEW.original_amount, NEW.posting_date, NEW.provider,
    NEW.provider_transaction_id,
    zeta_encrypt(NEW.raw_description),
    NEW.reconciled_into_transaction_id, NEW.reconciliation_score,
    NEW.recurrence_group_id, NEW.secondary_category_id, NEW.status,
    NEW.tags, NEW.transaction_date, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_view_insert_trg
  INSTEAD OF INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_view_insert();

-- 6. INSTEAD OF UPDATE trigger
CREATE OR REPLACE FUNCTION transactions_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE transactions_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    amount_in_base_currency = NEW.amount_in_base_currency,
    capture_input_text = zeta_encrypt(NEW.capture_input_text),
    capture_method = NEW.capture_method,
    categorization_confidence = NEW.categorization_confidence,
    categorization_source = NEW.categorization_source,
    category_id = NEW.category_id,
    clean_description = zeta_encrypt(NEW.clean_description),
    clean_description_hmac = zeta_hmac(NEW.clean_description),
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    destinatario_id = NEW.destinatario_id,
    direction = NEW.direction,
    exchange_rate = NEW.exchange_rate,
    idempotency_key = NEW.idempotency_key,
    installment_current = NEW.installment_current,
    installment_group_id = NEW.installment_group_id,
    installment_total = NEW.installment_total,
    is_excluded = NEW.is_excluded,
    is_recurring = NEW.is_recurring,
    is_subscription = NEW.is_subscription,
    merchant_category_code = NEW.merchant_category_code,
    merchant_logo_url = NEW.merchant_logo_url,
    merchant_name = zeta_encrypt(NEW.merchant_name),
    merchant_name_hmac = zeta_hmac(NEW.merchant_name),
    notes = zeta_encrypt(NEW.notes),
    original_amount = NEW.original_amount,
    posting_date = NEW.posting_date,
    provider = NEW.provider,
    provider_transaction_id = NEW.provider_transaction_id,
    raw_description = zeta_encrypt(NEW.raw_description),
    reconciled_into_transaction_id = NEW.reconciled_into_transaction_id,
    reconciliation_score = NEW.reconciliation_score,
    recurrence_group_id = NEW.recurrence_group_id,
    secondary_category_id = NEW.secondary_category_id,
    status = NEW.status,
    tags = NEW.tags,
    transaction_date = NEW.transaction_date,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_view_update_trg
  INSTEAD OF UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_view_update();

-- 7. INSTEAD OF DELETE trigger
CREATE OR REPLACE FUNCTION transactions_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM transactions_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_view_delete_trg
  INSTEAD OF DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_view_delete();

-- 8. Grant permissions on view
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO authenticated;
GRANT ALL ON transactions TO postgres, service_role;
