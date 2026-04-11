-- ===========================================================================
-- Fix: transactions INSERT and UPDATE triggers to support admin client
--
-- Problem: zeta_encrypt() and zeta_hmac() use auth.uid() to find the
-- user's DEK. When the admin/service_role client is used (e.g., email
-- webhook auto-import), auth.uid() returns NULL, causing:
--   RAISE EXCEPTION 'No encryption key found for user %'
-- and the INSERT silently fails.
--
-- Solution: Detect when auth.uid() IS NULL and fall back to
-- zeta_encrypt_as(value, NEW.user_id) / zeta_hmac_as(value, NEW.user_id),
-- which take an explicit user_id instead of relying on auth.uid().
--
-- When auth.uid() IS NOT NULL, we keep using zeta_encrypt()/zeta_hmac()
-- because they benefit from per-session DEK caching.
-- ===========================================================================

-- 1. Fix INSERT trigger
CREATE OR REPLACE FUNCTION transactions_view_insert() RETURNS TRIGGER AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.exchange_rate := COALESCE(NEW.exchange_rate, 1.000000);
  NEW.status := COALESCE(NEW.status, 'POSTED'::transaction_status);
  NEW.categorization_source := COALESCE(NEW.categorization_source, 'USER_CREATED'::categorization_source);
  NEW.is_subscription := COALESCE(NEW.is_subscription, false);
  NEW.is_recurring := COALESCE(NEW.is_recurring, false);
  NEW.provider := COALESCE(NEW.provider, 'MANUAL'::data_provider);
  NEW.is_excluded := COALESCE(NEW.is_excluded, false);
  NEW.capture_method := COALESCE(NEW.capture_method, 'MANUAL_FORM'::transaction_capture_method);

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
    CASE WHEN has_auth THEN zeta_encrypt(NEW.capture_input_text) ELSE zeta_encrypt_as(NEW.capture_input_text, NEW.user_id) END,
    NEW.capture_method, NEW.categorization_confidence,
    NEW.categorization_source, NEW.category_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.clean_description) ELSE zeta_encrypt_as(NEW.clean_description, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.clean_description) ELSE zeta_hmac_as(NEW.clean_description, NEW.user_id) END,
    NEW.created_at, NEW.currency_code, NEW.destinatario_id,
    NEW.direction, NEW.exchange_rate, NEW.id, NEW.idempotency_key,
    NEW.installment_current, NEW.installment_group_id,
    NEW.installment_total, NEW.is_excluded, NEW.is_recurring,
    NEW.is_subscription, NEW.merchant_category_code,
    NEW.merchant_logo_url,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE zeta_encrypt_as(NEW.merchant_name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.merchant_name) ELSE zeta_hmac_as(NEW.merchant_name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE zeta_encrypt_as(NEW.notes, NEW.user_id) END,
    NEW.original_amount, NEW.posting_date, NEW.provider,
    NEW.provider_transaction_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.raw_description) ELSE zeta_encrypt_as(NEW.raw_description, NEW.user_id) END,
    NEW.reconciled_into_transaction_id, NEW.reconciliation_score,
    NEW.recurrence_group_id, NEW.secondary_category_id, NEW.status,
    NEW.tags, NEW.transaction_date, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix UPDATE trigger
--    When has_auth is false, encrypted columns preserve existing ciphertext
--    from transactions_enc. The admin client can't decrypt values through
--    the view (zeta_decrypt returns NULL), so re-encrypting those NULLs
--    would destroy data. Instead, read the raw ciphertext from _enc.
CREATE OR REPLACE FUNCTION transactions_view_update() RETURNS TRIGGER AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE transactions_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    amount_in_base_currency = NEW.amount_in_base_currency,
    capture_input_text = CASE WHEN has_auth THEN zeta_encrypt(NEW.capture_input_text) ELSE (SELECT te.capture_input_text FROM transactions_enc te WHERE te.id = OLD.id) END,
    capture_method = NEW.capture_method,
    categorization_confidence = NEW.categorization_confidence,
    categorization_source = NEW.categorization_source,
    category_id = NEW.category_id,
    clean_description = CASE WHEN has_auth THEN zeta_encrypt(NEW.clean_description) ELSE (SELECT te.clean_description FROM transactions_enc te WHERE te.id = OLD.id) END,
    clean_description_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.clean_description) ELSE (SELECT te.clean_description_hmac FROM transactions_enc te WHERE te.id = OLD.id) END,
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
    merchant_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE (SELECT te.merchant_name FROM transactions_enc te WHERE te.id = OLD.id) END,
    merchant_name_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.merchant_name) ELSE (SELECT te.merchant_name_hmac FROM transactions_enc te WHERE te.id = OLD.id) END,
    notes = CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE (SELECT te.notes FROM transactions_enc te WHERE te.id = OLD.id) END,
    original_amount = NEW.original_amount,
    posting_date = NEW.posting_date,
    provider = NEW.provider,
    provider_transaction_id = NEW.provider_transaction_id,
    raw_description = CASE WHEN has_auth THEN zeta_encrypt(NEW.raw_description) ELSE (SELECT te.raw_description FROM transactions_enc te WHERE te.id = OLD.id) END,
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
