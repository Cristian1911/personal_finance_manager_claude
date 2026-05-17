-- ============================================================================
-- Create transaction_locations (encrypted PII: lat/lng + place strings)
-- and add location_id to transactions.
--
-- New encrypted table that links a transaction to the user's approximate
-- location at the time the transaction happened. Captured by the mobile app
-- in the background when the user has opted in (controlled by
-- profiles.location_tracking_enabled — added in 20260516120200_*).
--
-- Pattern (mirrors 20260408143001_encrypt_transactions.sql for the new
-- encrypted table, then re-applies the canonical transactions rebuild from
-- 20260413194415 with has_auth branching + transfer_group_id + the new
-- transaction_time + location_id columns).
-- ============================================================================

-- 1. Encrypted real table
CREATE TABLE IF NOT EXISTS public.transaction_locations_enc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Encrypted PII
  latitude BYTEA NOT NULL,
  longitude BYTEA NOT NULL,
  place_name BYTEA,
  place_locality BYTEA,
  -- Plaintext (low PII / needed for queries)
  accuracy_m REAL,
  place_country TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  -- Bookkeeping
  linked_transaction_id UUID REFERENCES public.transactions_enc(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transaction_locations_enc IS
  'Approximate location captured by the mobile app and linked to a transaction. Lat/lng and place strings are encrypted (zeta_encrypt). Country and accuracy are plaintext.';

-- 2. Row level security
ALTER TABLE public.transaction_locations_enc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own transaction_locations" ON public.transaction_locations_enc;
CREATE POLICY "own transaction_locations"
  ON public.transaction_locations_enc FOR ALL
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_tx_locations_enc_user_captured
  ON public.transaction_locations_enc (user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_tx_locations_enc_linked_tx
  ON public.transaction_locations_enc (user_id, linked_transaction_id)
  WHERE linked_transaction_id IS NOT NULL;

-- 4. Decrypted view
DROP VIEW IF EXISTS public.transaction_locations CASCADE;
CREATE VIEW public.transaction_locations WITH (security_invoker = true) AS
SELECT
  id, user_id,
  zeta_decrypt(latitude)::DOUBLE PRECISION AS latitude,
  zeta_decrypt(longitude)::DOUBLE PRECISION AS longitude,
  accuracy_m,
  zeta_decrypt(place_name) AS place_name,
  zeta_decrypt(place_locality) AS place_locality,
  place_country,
  captured_at,
  linked_transaction_id,
  created_at,
  updated_at
FROM public.transaction_locations_enc;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_locations TO authenticated;
GRANT ALL ON public.transaction_locations TO postgres, service_role;

-- INSERT trigger
CREATE OR REPLACE FUNCTION public.transaction_locations_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());

  INSERT INTO public.transaction_locations_enc (
    id, user_id, latitude, longitude, accuracy_m,
    place_name, place_locality, place_country,
    captured_at, linked_transaction_id, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.latitude::TEXT) ELSE zeta_encrypt_as(NEW.latitude::TEXT, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.longitude::TEXT) ELSE zeta_encrypt_as(NEW.longitude::TEXT, NEW.user_id) END,
    NEW.accuracy_m,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.place_name) ELSE zeta_encrypt_as(NEW.place_name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.place_locality) ELSE zeta_encrypt_as(NEW.place_locality, NEW.user_id) END,
    NEW.place_country,
    NEW.captured_at, NEW.linked_transaction_id,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER transaction_locations_view_insert_trg
  INSTEAD OF INSERT ON public.transaction_locations
  FOR EACH ROW EXECUTE FUNCTION public.transaction_locations_view_insert();

-- UPDATE trigger
CREATE OR REPLACE FUNCTION public.transaction_locations_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE public.transaction_locations_enc SET
    user_id = NEW.user_id,
    latitude = CASE WHEN has_auth THEN zeta_encrypt(NEW.latitude::TEXT) ELSE (SELECT te.latitude FROM transaction_locations_enc te WHERE te.id = OLD.id) END,
    longitude = CASE WHEN has_auth THEN zeta_encrypt(NEW.longitude::TEXT) ELSE (SELECT te.longitude FROM transaction_locations_enc te WHERE te.id = OLD.id) END,
    accuracy_m = NEW.accuracy_m,
    place_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.place_name) ELSE (SELECT te.place_name FROM transaction_locations_enc te WHERE te.id = OLD.id) END,
    place_locality = CASE WHEN has_auth THEN zeta_encrypt(NEW.place_locality) ELSE (SELECT te.place_locality FROM transaction_locations_enc te WHERE te.id = OLD.id) END,
    place_country = NEW.place_country,
    captured_at = NEW.captured_at,
    linked_transaction_id = NEW.linked_transaction_id,
    updated_at = COALESCE(NEW.updated_at, now())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER transaction_locations_view_update_trg
  INSTEAD OF UPDATE ON public.transaction_locations
  FOR EACH ROW EXECUTE FUNCTION public.transaction_locations_view_update();

-- DELETE trigger
CREATE OR REPLACE FUNCTION public.transaction_locations_view_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.transaction_locations_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER transaction_locations_view_delete_trg
  INSTEAD OF DELETE ON public.transaction_locations
  FOR EACH ROW EXECUTE FUNCTION public.transaction_locations_view_delete();

-- ============================================================================
-- 5. Add location_id FK to transactions
-- ============================================================================

ALTER TABLE public.transactions_enc
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.transaction_locations_enc(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.transactions_enc.location_id IS
  'Optional FK to the transaction_location captured at the time of this transaction. Set by the mobile app when the user has opted in to location tracking.';

CREATE INDEX IF NOT EXISTS idx_transactions_enc_location
  ON public.transactions_enc (user_id, location_id)
  WHERE location_id IS NOT NULL;

-- ============================================================================
-- 6. Recreate transactions view + triggers to include location_id alongside
--    the transaction_time column added in 20260516120000 and the
--    transfer_group_id column added in 20260413194415. Pattern is identical
--    to 20260413194415_add_transfer_group_id with location_id appended.
-- ============================================================================

DROP VIEW IF EXISTS public.transactions CASCADE;

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
  is_subscription, location_id, merchant_category_code, merchant_logo_url,
  zeta_decrypt(merchant_name) AS merchant_name,
  merchant_name_hmac,
  zeta_decrypt(notes) AS notes,
  original_amount, posting_date, provider, provider_transaction_id,
  zeta_decrypt(raw_description) AS raw_description,
  reconciled_into_transaction_id, reconciliation_score,
  recurrence_group_id, secondary_category_id, status, tags,
  transaction_date, transaction_time, transfer_group_id, updated_at, user_id
FROM public.transactions_enc;

CREATE OR REPLACE FUNCTION public.transactions_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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

  INSERT INTO public.transactions_enc (
    account_id, amount, amount_in_base_currency, capture_input_text,
    capture_method, categorization_confidence, categorization_source,
    category_id, clean_description, clean_description_hmac, created_at,
    currency_code, destinatario_id, direction, exchange_rate, id,
    idempotency_key, installment_current, installment_group_id,
    installment_total, is_excluded, is_recurring, is_subscription,
    location_id, merchant_category_code, merchant_logo_url, merchant_name,
    merchant_name_hmac, notes, original_amount, posting_date, provider,
    provider_transaction_id, raw_description,
    reconciled_into_transaction_id, reconciliation_score,
    recurrence_group_id, secondary_category_id, status, tags,
    transaction_date, transaction_time, transfer_group_id, updated_at, user_id
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
    NEW.is_subscription, NEW.location_id,
    NEW.merchant_category_code, NEW.merchant_logo_url,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE zeta_encrypt_as(NEW.merchant_name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.merchant_name) ELSE zeta_hmac_as(NEW.merchant_name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE zeta_encrypt_as(NEW.notes, NEW.user_id) END,
    NEW.original_amount, NEW.posting_date, NEW.provider,
    NEW.provider_transaction_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.raw_description) ELSE zeta_encrypt_as(NEW.raw_description, NEW.user_id) END,
    NEW.reconciled_into_transaction_id, NEW.reconciliation_score,
    NEW.recurrence_group_id, NEW.secondary_category_id, NEW.status,
    NEW.tags, NEW.transaction_date, NEW.transaction_time,
    NEW.transfer_group_id, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transactions_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE public.transactions_enc SET
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
    location_id = NEW.location_id,
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
    transaction_time = NEW.transaction_time,
    transfer_group_id = NEW.transfer_group_id,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transactions_view_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.transactions_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER transactions_view_insert_trg
  INSTEAD OF INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_insert();

CREATE TRIGGER transactions_view_update_trg
  INSTEAD OF UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_update();

CREATE TRIGGER transactions_view_delete_trg
  INSTEAD OF DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_delete();

-- Re-grant permissions (CASCADE on the view revokes these)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO postgres, service_role;
