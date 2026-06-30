-- ============================================================================
-- Add split_group_id to personal_debts + transactions ("Pago compartido")
--
-- A shared payment (Splitwise-style) is recorded as N+1 transaction "legs"
-- sharing one split_group_id:
--   - the user's own share = a normal expense leg (counts in cashflow), and
--   - each other participant's share = a "lent-origin" leg (pd_role='origin',
--     excluded from cashflow) linked 1:1 to a personal_debts row (direction
--     'lent'). All those personal_debts also share the split_group_id so the UI
--     can group them under the single payment.
--
-- Both columns are non-PII plaintext passthrough (exactly like transfer_group_id
-- / personal_debt_id): no encryption, no hmac, no _old routing in UPDATE.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- personal_debts: plain table, simple ADD COLUMN.
-- ----------------------------------------------------------------------------
ALTER TABLE public.personal_debts
  ADD COLUMN IF NOT EXISTS split_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_personal_debts_split_group_id
  ON public.personal_debts (split_group_id)
  WHERE split_group_id IS NOT NULL;

COMMENT ON COLUMN public.personal_debts.split_group_id IS
  'Groups the N personal_debts (direction=lent) created from one shared payment (Pago compartido). NULL for standalone debts.';

-- ----------------------------------------------------------------------------
-- transactions: 6-step _enc rebuild. Bodies copied VERBATIM from the current
-- newest transactions migration 20260603223915_add_transaction_personal_debt_link.sql,
-- preserving the has_auth branching + SELECT INTO _old refactor. Only the new
-- plain split_group_id column is added. Nullable with no default, so NO COALESCE
-- preamble line is needed.
-- ----------------------------------------------------------------------------
ALTER TABLE public.transactions_enc
  ADD COLUMN IF NOT EXISTS split_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_transactions_split_group_id
  ON public.transactions_enc (split_group_id)
  WHERE split_group_id IS NOT NULL;

COMMENT ON COLUMN public.transactions_enc.split_group_id IS
  'Groups the user-share leg + N lent-origin legs of one shared payment (Pago compartido). Non-PII, plaintext.';

-- ============================================================================
-- Recreate transactions view + triggers to include split_group_id alongside all
-- existing columns. Bodies verbatim from 20260603223915, plus split_group_id.
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
  recurrence_group_id, secondary_category_id, status, tags, title_locked,
  transaction_date, transaction_time, transfer_group_id,
  personal_debt_id, pd_role, split_group_id,
  updated_at, user_id
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
  NEW.title_locked := COALESCE(NEW.title_locked, false);

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
    recurrence_group_id, secondary_category_id, status, tags, title_locked,
    transaction_date, transaction_time, transfer_group_id,
    personal_debt_id, pd_role, split_group_id,
    updated_at, user_id
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
    NEW.tags, NEW.title_locked, NEW.transaction_date, NEW.transaction_time,
    NEW.transfer_group_id,
    NEW.personal_debt_id, NEW.pd_role, NEW.split_group_id,
    NEW.updated_at, NEW.user_id
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
  _old public.transactions_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM public.transactions_enc WHERE id = OLD.id;
  END IF;

  UPDATE public.transactions_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    amount_in_base_currency = NEW.amount_in_base_currency,
    capture_input_text = CASE WHEN has_auth THEN zeta_encrypt(NEW.capture_input_text) ELSE _old.capture_input_text END,
    capture_method = NEW.capture_method,
    categorization_confidence = NEW.categorization_confidence,
    categorization_source = NEW.categorization_source,
    category_id = NEW.category_id,
    clean_description = CASE WHEN has_auth THEN zeta_encrypt(NEW.clean_description) ELSE _old.clean_description END,
    clean_description_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.clean_description) ELSE _old.clean_description_hmac END,
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
    merchant_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE _old.merchant_name END,
    merchant_name_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.merchant_name) ELSE _old.merchant_name_hmac END,
    notes = CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE _old.notes END,
    original_amount = NEW.original_amount,
    posting_date = NEW.posting_date,
    provider = NEW.provider,
    provider_transaction_id = NEW.provider_transaction_id,
    raw_description = CASE WHEN has_auth THEN zeta_encrypt(NEW.raw_description) ELSE _old.raw_description END,
    reconciled_into_transaction_id = NEW.reconciled_into_transaction_id,
    reconciliation_score = NEW.reconciliation_score,
    recurrence_group_id = NEW.recurrence_group_id,
    secondary_category_id = NEW.secondary_category_id,
    status = NEW.status,
    tags = NEW.tags,
    title_locked = NEW.title_locked,
    transaction_date = NEW.transaction_date,
    transaction_time = NEW.transaction_time,
    transfer_group_id = NEW.transfer_group_id,
    personal_debt_id = NEW.personal_debt_id,
    pd_role = NEW.pd_role,
    split_group_id = NEW.split_group_id,
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

COMMIT;
