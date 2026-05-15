-- ============================================================================
-- Add transaction_time to transactions
--
-- Optional time-of-day (TIME, nullable) on every transaction. Plaintext —
-- precision matters more than secrecy here, and PostgREST/SQL need to filter
-- and order by it. PDF imports leave it NULL; manual capture (web + mobile)
-- and email parsers (where available) populate it.
--
-- Pattern (mirrors 20260428120000_add_nav_focus_to_profiles.sql):
--   1. ALTER transactions_enc to add the column (nullable, no default).
--   2. Drop INSTEAD OF triggers + view.
--   3. Recreate view with the new column as a plain passthrough (no decrypt).
--   4. Recreate INSERT + UPDATE trigger fns to include the column.
--   5. Recreate triggers.
--   6. Composite index for date+time ordering inside a day.
-- ============================================================================

ALTER TABLE public.transactions_enc
  ADD COLUMN transaction_time TIME NULL;

COMMENT ON COLUMN public.transactions_enc.transaction_time IS
  'Optional time-of-day for the transaction. NULL when the source (e.g. PDF) does not carry it.';

-- Drop triggers + view so we can recreate with the new column
DROP TRIGGER IF EXISTS transactions_view_insert_trg ON public.transactions;
DROP TRIGGER IF EXISTS transactions_view_update_trg ON public.transactions;
DROP TRIGGER IF EXISTS transactions_view_delete_trg ON public.transactions;
DROP VIEW IF EXISTS public.transactions;

-- Recreate decrypted view including transaction_time (plain passthrough)
CREATE VIEW public.transactions WITH (security_invoker = true) AS
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
  transaction_date, transaction_time, updated_at, user_id
FROM public.transactions_enc;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO postgres, service_role;

-- Recreate INSERT trigger fn with transaction_time
CREATE OR REPLACE FUNCTION public.transactions_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.transactions_enc (
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
    transaction_date, transaction_time, updated_at, user_id
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
    NEW.tags, NEW.transaction_date, NEW.transaction_time,
    NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$function$;

-- Recreate UPDATE trigger fn with transaction_time
CREATE OR REPLACE FUNCTION public.transactions_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.transactions_enc SET
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
    transaction_time = NEW.transaction_time,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

-- DELETE fn unchanged — recreate triggers only
CREATE TRIGGER transactions_view_insert_trg
  INSTEAD OF INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_insert();

CREATE TRIGGER transactions_view_update_trg
  INSTEAD OF UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_update();

CREATE TRIGGER transactions_view_delete_trg
  INSTEAD OF DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_delete();

-- Composite index for date + time ordering inside a single day.
-- transaction_date is already covered by idx_transactions_user_date_desc;
-- this one helps when sorting/filtering with time-of-day awareness.
CREATE INDEX IF NOT EXISTS idx_transactions_enc_user_date_time
  ON public.transactions_enc (user_id, transaction_date DESC, transaction_time DESC NULLS LAST);
