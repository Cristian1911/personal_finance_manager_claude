-- Propagate `has_auth` guard to every encrypted view INSTEAD OF trigger.
--
-- Problem: when a trigger function runs without a JWT (service-role RPC,
-- webhook, cron, migration), `zeta_encrypt()` has no pgsodium user context
-- and silently returns NULL. Any encrypted column written from a no-auth
-- path loses its plaintext forever. UPDATE is worse — a partial UPDATE that
-- only touches a plaintext column still re-encrypts every encrypted column
-- with NULL, destroying data that wasn't meant to change.
--
-- Fix: rebuild all 14 *_view_insert / *_view_update functions using the
-- pattern already adopted by `accounts_view_*` and `pdf_passwords_view_*`:
--
--   INSERT: CASE WHEN has_auth THEN zeta_encrypt(X)
--                ELSE zeta_encrypt_as(X, NEW.user_id) END
--   UPDATE: CASE WHEN has_auth THEN zeta_encrypt(X)
--                ELSE (SELECT col FROM <tbl>_enc WHERE id = OLD.id) END
--
-- INSERT uses zeta_encrypt_as() because the inserter knows the owner.
-- UPDATE preserves the existing ciphertext — a no-auth UPDATE must not
-- stomp encrypted columns it has no authority to re-encrypt.
--
-- Tables covered (7): capture_tokens, destinatarios, email_ingest_addresses,
-- profiles, recurring_transaction_templates (view: recurring_templates),
-- statement_snapshots, wishlist_items.
-- Already guarded (3): accounts, pdf_passwords, transactions.
--
-- Function bodies below mirror the current production definitions
-- byte-for-byte except for the has_auth guard wrapping. No schema change.

-- ─── capture_tokens ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.capture_tokens_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());

  INSERT INTO capture_tokens_enc (
    id, user_id, token, token_hash, label, default_account_id, created_at
  ) VALUES (
    NEW.id, NEW.user_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.token) ELSE zeta_encrypt_as(NEW.token, NEW.user_id) END,
    encode(digest(NEW.token, 'sha256'), 'hex'),
    CASE WHEN has_auth THEN zeta_encrypt(NEW.label) ELSE zeta_encrypt_as(NEW.label, NEW.user_id) END,
    NEW.default_account_id, NEW.created_at
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.capture_tokens_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE capture_tokens_enc SET
    created_at = NEW.created_at,
    default_account_id = NEW.default_account_id,
    label = CASE WHEN has_auth THEN zeta_encrypt(NEW.label) ELSE (SELECT ct.label FROM capture_tokens_enc ct WHERE ct.id = OLD.id) END,
    last_used_at = NEW.last_used_at,
    revoked_at = NEW.revoked_at,
    token = CASE WHEN has_auth THEN zeta_encrypt(NEW.token) ELSE (SELECT ct.token FROM capture_tokens_enc ct WHERE ct.id = OLD.id) END,
    token_hash = CASE WHEN has_auth THEN encode(digest(NEW.token, 'sha256'), 'hex') ELSE (SELECT ct.token_hash FROM capture_tokens_enc ct WHERE ct.id = OLD.id) END,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

-- ─── destinatarios ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.destinatarios_view_insert()
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
  NEW.is_active := COALESCE(NEW.is_active, true);

  INSERT INTO destinatarios_enc (
    id, user_id, name, name_hmac, notes, default_category_id,
    is_active, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE zeta_encrypt_as(NEW.name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.name) ELSE zeta_hmac_as(NEW.name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE zeta_encrypt_as(NEW.notes, NEW.user_id) END,
    NEW.default_category_id, NEW.is_active,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.destinatarios_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE destinatarios_enc SET
    created_at = NEW.created_at,
    default_category_id = NEW.default_category_id,
    is_active = NEW.is_active,
    name = CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE (SELECT d.name FROM destinatarios_enc d WHERE d.id = OLD.id) END,
    name_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.name) ELSE (SELECT d.name_hmac FROM destinatarios_enc d WHERE d.id = OLD.id) END,
    notes = CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE (SELECT d.notes FROM destinatarios_enc d WHERE d.id = OLD.id) END,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

-- ─── email_ingest_addresses ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.email_ingest_addresses_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.auto_import := COALESCE(NEW.auto_import, false);
  NEW.is_active := COALESCE(NEW.is_active, true);
  NEW.pdf_import_enabled := COALESCE(NEW.pdf_import_enabled, false);

  INSERT INTO email_ingest_addresses_enc (
    id, user_id, address_key, allowed_sender, account_id,
    auto_import, is_active, gmail_verification_url, created_at,
    pdf_import_enabled
  ) VALUES (
    NEW.id, NEW.user_id, NEW.address_key,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.allowed_sender) ELSE zeta_encrypt_as(NEW.allowed_sender, NEW.user_id) END,
    NEW.account_id,
    NEW.auto_import, NEW.is_active,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.gmail_verification_url) ELSE zeta_encrypt_as(NEW.gmail_verification_url, NEW.user_id) END,
    NEW.created_at,
    NEW.pdf_import_enabled
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.email_ingest_addresses_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE email_ingest_addresses_enc SET
    account_id = NEW.account_id,
    address_key = NEW.address_key,
    allowed_sender = CASE WHEN has_auth THEN zeta_encrypt(NEW.allowed_sender) ELSE (SELECT e.allowed_sender FROM email_ingest_addresses_enc e WHERE e.id = OLD.id) END,
    auto_import = NEW.auto_import,
    created_at = NEW.created_at,
    gmail_verification_at = NEW.gmail_verification_at,
    gmail_verification_url = CASE WHEN has_auth THEN zeta_encrypt(NEW.gmail_verification_url) ELSE (SELECT e.gmail_verification_url FROM email_ingest_addresses_enc e WHERE e.id = OLD.id) END,
    is_active = NEW.is_active,
    pdf_import_enabled = NEW.pdf_import_enabled,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

-- ─── profiles ──────────────────────────────────────────────────────────────
-- profiles is keyed by `id` (== user_id), so _as(..., NEW.id).

CREATE OR REPLACE FUNCTION public.profiles_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.created_at := COALESCE(NEW.created_at, now()::text);
  NEW.updated_at := COALESCE(NEW.updated_at, now()::text);
  NEW.locale := COALESCE(NEW.locale, 'es-CO');
  NEW.onboarding_completed := COALESCE(NEW.onboarding_completed, false);
  NEW.preferred_currency := COALESCE(NEW.preferred_currency, 'COP');
  NEW.timezone := COALESCE(NEW.timezone, 'America/Bogota');
  NEW.demo_mode := COALESCE(NEW.demo_mode, false);
  INSERT INTO profiles_enc (
    app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
    demo_mode, email, estimated_monthly_expenses, estimated_monthly_income,
    full_name, id, locale, monthly_salary, onboarding_completed,
    preferred_currency, timezone, updated_at
  ) VALUES (
    NEW.app_purpose, NEW.avatar_url, NEW.budget_mode, NEW.created_at,
    NEW.dashboard_config, NEW.demo_mode,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.email) ELSE zeta_encrypt_as(NEW.email, NEW.id) END,
    NEW.estimated_monthly_expenses, NEW.estimated_monthly_income,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.full_name) ELSE zeta_encrypt_as(NEW.full_name, NEW.id) END,
    NEW.id, NEW.locale, NEW.monthly_salary, NEW.onboarding_completed,
    NEW.preferred_currency, NEW.timezone, NEW.updated_at
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.profiles_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE profiles_enc SET
    app_purpose = NEW.app_purpose,
    avatar_url = NEW.avatar_url,
    budget_mode = NEW.budget_mode,
    created_at = NEW.created_at,
    dashboard_config = NEW.dashboard_config,
    demo_mode = NEW.demo_mode,
    email = CASE WHEN has_auth THEN zeta_encrypt(NEW.email) ELSE (SELECT p.email FROM profiles_enc p WHERE p.id = OLD.id) END,
    estimated_monthly_expenses = NEW.estimated_monthly_expenses,
    estimated_monthly_income = NEW.estimated_monthly_income,
    full_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.full_name) ELSE (SELECT p.full_name FROM profiles_enc p WHERE p.id = OLD.id) END,
    locale = NEW.locale,
    monthly_salary = NEW.monthly_salary,
    onboarding_completed = NEW.onboarding_completed,
    preferred_currency = NEW.preferred_currency,
    timezone = NEW.timezone,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

-- ─── recurring_templates ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recurring_templates_view_insert()
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
    CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE zeta_encrypt_as(NEW.merchant_name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.description) ELSE zeta_encrypt_as(NEW.description, NEW.user_id) END,
    NEW.category_id, NEW.is_active, NEW.start_date, NEW.end_date,
    NEW.created_at, NEW.updated_at, NEW.transfer_source_account_id,
    NEW.sub_payments,
    NEW.destinatario_id
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recurring_templates_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE recurring_transaction_templates_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    category_id = NEW.category_id,
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    day_of_month = NEW.day_of_month,
    day_of_week = NEW.day_of_week,
    description = CASE WHEN has_auth THEN zeta_encrypt(NEW.description) ELSE (SELECT r.description FROM recurring_transaction_templates_enc r WHERE r.id = OLD.id) END,
    destinatario_id = NEW.destinatario_id,
    direction = NEW.direction,
    end_date = NEW.end_date,
    frequency = NEW.frequency,
    is_active = NEW.is_active,
    merchant_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE (SELECT r.merchant_name FROM recurring_transaction_templates_enc r WHERE r.id = OLD.id) END,
    start_date = NEW.start_date,
    transfer_source_account_id = NEW.transfer_source_account_id,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id,
    sub_payments = NEW.sub_payments
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

-- ─── statement_snapshots ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.statement_snapshots_view_insert()
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
  NEW.transaction_count := COALESCE(NEW.transaction_count, 0);
  NEW.imported_count := COALESCE(NEW.imported_count, 0);
  NEW.skipped_count := COALESCE(NEW.skipped_count, 0);
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP'::text);

  INSERT INTO statement_snapshots_enc (
    id, user_id, account_id, period_from, period_to,
    opening_balance, closing_balance, total_debits, total_credits,
    minimum_payment, remaining_balance, initial_amount,
    transaction_count, imported_count, skipped_count,
    loan_number, source_filename, currency_code,
    created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.period_from, NEW.period_to,
    NEW.opening_balance, NEW.closing_balance, NEW.total_debits,
    NEW.total_credits, NEW.minimum_payment, NEW.remaining_balance,
    NEW.initial_amount, NEW.transaction_count, NEW.imported_count,
    NEW.skipped_count,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.loan_number) ELSE zeta_encrypt_as(NEW.loan_number, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.source_filename) ELSE zeta_encrypt_as(NEW.source_filename, NEW.user_id) END,
    NEW.currency_code,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.statement_snapshots_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE statement_snapshots_enc SET
    account_id = NEW.account_id,
    available_credit = NEW.available_credit,
    created_at = NEW.created_at,
    credit_limit = NEW.credit_limit,
    currency_code = NEW.currency_code,
    final_balance = NEW.final_balance,
    imported_count = NEW.imported_count,
    initial_amount = NEW.initial_amount,
    installments_in_default = NEW.installments_in_default,
    interest_charged = NEW.interest_charged,
    interest_rate = NEW.interest_rate,
    late_interest_rate = NEW.late_interest_rate,
    loan_number = CASE WHEN has_auth THEN zeta_encrypt(NEW.loan_number) ELSE (SELECT s.loan_number FROM statement_snapshots_enc s WHERE s.id = OLD.id) END,
    minimum_payment = NEW.minimum_payment,
    payment_due_date = NEW.payment_due_date,
    period_from = NEW.period_from,
    period_to = NEW.period_to,
    previous_balance = NEW.previous_balance,
    purchases_and_charges = NEW.purchases_and_charges,
    remaining_balance = NEW.remaining_balance,
    skipped_count = NEW.skipped_count,
    source_filename = CASE WHEN has_auth THEN zeta_encrypt(NEW.source_filename) ELSE (SELECT s.source_filename FROM statement_snapshots_enc s WHERE s.id = OLD.id) END,
    total_credits = NEW.total_credits,
    total_debits = NEW.total_debits,
    total_payment_due = NEW.total_payment_due,
    transaction_count = NEW.transaction_count,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

-- ─── wishlist_items ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wishlist_items_view_insert()
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
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP'::text);
  NEW.status := COALESCE(NEW.status, 'wishlist'::text);
  NEW.enriched := COALESCE(NEW.enriched, false);

  INSERT INTO wishlist_items_enc (
    id, user_id, name, url, price, currency_code, why,
    status, enriched, enrichment_data, score_data,
    created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE zeta_encrypt_as(NEW.name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.url) ELSE zeta_encrypt_as(NEW.url, NEW.user_id) END,
    NEW.price, NEW.currency_code,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.why) ELSE zeta_encrypt_as(NEW.why, NEW.user_id) END,
    NEW.status, NEW.enriched, NEW.enrichment_data, NEW.score_data,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.wishlist_items_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE wishlist_items_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    bought_at = NEW.bought_at,
    category_id = NEW.category_id,
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    desire_type = NEW.desire_type,
    enriched = NEW.enriched,
    enriched_at = NEW.enriched_at,
    funding_type = NEW.funding_type,
    image_url = NEW.image_url,
    installments = NEW.installments,
    last_nudge_dismissed_at = NEW.last_nudge_dismissed_at,
    last_score = NEW.last_score,
    last_scored_at = NEW.last_scored_at,
    last_verdict = NEW.last_verdict,
    name = CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE (SELECT w.name FROM wishlist_items_enc w WHERE w.id = OLD.id) END,
    ready_at = NEW.ready_at,
    status = NEW.status,
    transaction_id = NEW.transaction_id,
    updated_at = NEW.updated_at,
    urgency = NEW.urgency,
    url = CASE WHEN has_auth THEN zeta_encrypt(NEW.url) ELSE (SELECT w.url FROM wishlist_items_enc w WHERE w.id = OLD.id) END,
    user_id = NEW.user_id,
    why = CASE WHEN has_auth THEN zeta_encrypt(NEW.why) ELSE (SELECT w.why FROM wishlist_items_enc w WHERE w.id = OLD.id) END
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;
