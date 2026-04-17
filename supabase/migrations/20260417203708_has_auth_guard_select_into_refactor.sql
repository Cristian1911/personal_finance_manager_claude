-- Refactor: replace per-column `(SELECT col FROM <tbl>_enc WHERE id = OLD.id)`
-- subqueries with a single `SELECT * INTO _old <tbl>_enc` on the no-auth path.
--
-- Behaviour is unchanged — both forms preserve the existing ciphertext when
-- has_auth is false. The IF NOT has_auth gate ensures the SELECT only runs
-- when actually needed; the prior `CASE` form already had lazy evaluation,
-- so the perf delta on the auth'd path is zero. On the no-auth path we go
-- from N row reads to one.
--
-- Scope: only the 7 *_view_update functions added by 20260417193237. The
-- pre-existing accounts/pdf_passwords/transactions update functions still
-- use the subquery form; left alone in this migration to keep the diff
-- focused on the addition we just shipped.
--
-- Per Gemini review on PR #186.

CREATE OR REPLACE FUNCTION public.capture_tokens_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old capture_tokens_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM capture_tokens_enc WHERE id = OLD.id;
  END IF;

  UPDATE capture_tokens_enc SET
    created_at = NEW.created_at,
    default_account_id = NEW.default_account_id,
    label = CASE WHEN has_auth THEN zeta_encrypt(NEW.label) ELSE _old.label END,
    last_used_at = NEW.last_used_at,
    revoked_at = NEW.revoked_at,
    token = CASE WHEN has_auth THEN zeta_encrypt(NEW.token) ELSE _old.token END,
    token_hash = CASE WHEN has_auth THEN encode(digest(NEW.token, 'sha256'), 'hex') ELSE _old.token_hash END,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.destinatarios_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old destinatarios_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM destinatarios_enc WHERE id = OLD.id;
  END IF;

  UPDATE destinatarios_enc SET
    created_at = NEW.created_at,
    default_category_id = NEW.default_category_id,
    is_active = NEW.is_active,
    name = CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE _old.name END,
    name_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.name) ELSE _old.name_hmac END,
    notes = CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE _old.notes END,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.email_ingest_addresses_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old email_ingest_addresses_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM email_ingest_addresses_enc WHERE id = OLD.id;
  END IF;

  UPDATE email_ingest_addresses_enc SET
    account_id = NEW.account_id,
    address_key = NEW.address_key,
    allowed_sender = CASE WHEN has_auth THEN zeta_encrypt(NEW.allowed_sender) ELSE _old.allowed_sender END,
    auto_import = NEW.auto_import,
    created_at = NEW.created_at,
    gmail_verification_at = NEW.gmail_verification_at,
    gmail_verification_url = CASE WHEN has_auth THEN zeta_encrypt(NEW.gmail_verification_url) ELSE _old.gmail_verification_url END,
    is_active = NEW.is_active,
    pdf_import_enabled = NEW.pdf_import_enabled,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.profiles_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old profiles_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM profiles_enc WHERE id = OLD.id;
  END IF;

  UPDATE profiles_enc SET
    app_purpose = NEW.app_purpose,
    avatar_url = NEW.avatar_url,
    budget_mode = NEW.budget_mode,
    created_at = NEW.created_at,
    dashboard_config = NEW.dashboard_config,
    demo_mode = NEW.demo_mode,
    email = CASE WHEN has_auth THEN zeta_encrypt(NEW.email) ELSE _old.email END,
    estimated_monthly_expenses = NEW.estimated_monthly_expenses,
    estimated_monthly_income = NEW.estimated_monthly_income,
    full_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.full_name) ELSE _old.full_name END,
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

CREATE OR REPLACE FUNCTION public.recurring_templates_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old recurring_transaction_templates_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM recurring_transaction_templates_enc WHERE id = OLD.id;
  END IF;

  UPDATE recurring_transaction_templates_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    category_id = NEW.category_id,
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    day_of_month = NEW.day_of_month,
    day_of_week = NEW.day_of_week,
    description = CASE WHEN has_auth THEN zeta_encrypt(NEW.description) ELSE _old.description END,
    destinatario_id = NEW.destinatario_id,
    direction = NEW.direction,
    end_date = NEW.end_date,
    frequency = NEW.frequency,
    is_active = NEW.is_active,
    merchant_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE _old.merchant_name END,
    start_date = NEW.start_date,
    transfer_source_account_id = NEW.transfer_source_account_id,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id,
    sub_payments = NEW.sub_payments
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.statement_snapshots_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old statement_snapshots_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM statement_snapshots_enc WHERE id = OLD.id;
  END IF;

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
    loan_number = CASE WHEN has_auth THEN zeta_encrypt(NEW.loan_number) ELSE _old.loan_number END,
    minimum_payment = NEW.minimum_payment,
    payment_due_date = NEW.payment_due_date,
    period_from = NEW.period_from,
    period_to = NEW.period_to,
    previous_balance = NEW.previous_balance,
    purchases_and_charges = NEW.purchases_and_charges,
    remaining_balance = NEW.remaining_balance,
    skipped_count = NEW.skipped_count,
    source_filename = CASE WHEN has_auth THEN zeta_encrypt(NEW.source_filename) ELSE _old.source_filename END,
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

CREATE OR REPLACE FUNCTION public.wishlist_items_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old wishlist_items_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM wishlist_items_enc WHERE id = OLD.id;
  END IF;

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
    name = CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE _old.name END,
    ready_at = NEW.ready_at,
    status = NEW.status,
    transaction_id = NEW.transaction_id,
    updated_at = NEW.updated_at,
    urgency = NEW.urgency,
    url = CASE WHEN has_auth THEN zeta_encrypt(NEW.url) ELSE _old.url END,
    user_id = NEW.user_id,
    why = CASE WHEN has_auth THEN zeta_encrypt(NEW.why) ELSE _old.why END
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;
