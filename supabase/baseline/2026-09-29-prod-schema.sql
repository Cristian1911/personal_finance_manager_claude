


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "analytics";


ALTER SCHEMA "analytics" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."account_type" AS ENUM (
    'CHECKING',
    'SAVINGS',
    'CREDIT_CARD',
    'CASH',
    'INVESTMENT',
    'LOAN',
    'OTHER'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."categorization_source" AS ENUM (
    'SYSTEM_DEFAULT',
    'USER_CREATED',
    'ML_MODEL',
    'USER_OVERRIDE',
    'USER_LEARNED',
    'RECURRING_TEMPLATE'
);


ALTER TYPE "public"."categorization_source" OWNER TO "postgres";


CREATE TYPE "public"."connection_status" AS ENUM (
    'CONNECTED',
    'DISCONNECTED',
    'ERROR',
    'PENDING'
);


ALTER TYPE "public"."connection_status" OWNER TO "postgres";


CREATE TYPE "public"."currency_code" AS ENUM (
    'COP',
    'BRL',
    'MXN',
    'USD',
    'EUR',
    'PEN',
    'CLP',
    'ARS'
);


ALTER TYPE "public"."currency_code" OWNER TO "postgres";


CREATE TYPE "public"."data_provider" AS ENUM (
    'MANUAL',
    'BELVO',
    'PROMETEO',
    'PLAID',
    'CSV_IMPORT',
    'OCR',
    'EMAIL'
);


ALTER TYPE "public"."data_provider" OWNER TO "postgres";


CREATE TYPE "public"."destinatario_kind" AS ENUM (
    'merchant',
    'person'
);


ALTER TYPE "public"."destinatario_kind" OWNER TO "postgres";


CREATE TYPE "public"."nav_focus" AS ENUM (
    'PLAN',
    'DEBT'
);


ALTER TYPE "public"."nav_focus" OWNER TO "postgres";


CREATE TYPE "public"."occurrence_status" AS ENUM (
    'pending',
    'paid',
    'skipped'
);


ALTER TYPE "public"."occurrence_status" OWNER TO "postgres";


CREATE TYPE "public"."pd_role" AS ENUM (
    'origin',
    'repayment'
);


ALTER TYPE "public"."pd_role" OWNER TO "postgres";


CREATE TYPE "public"."personal_debt_direction" AS ENUM (
    'borrowed',
    'lent'
);


ALTER TYPE "public"."personal_debt_direction" OWNER TO "postgres";


CREATE TYPE "public"."personal_debt_status" AS ENUM (
    'active',
    'settled',
    'cancelled'
);


ALTER TYPE "public"."personal_debt_status" OWNER TO "postgres";


CREATE TYPE "public"."planning_entry_status" AS ENUM (
    'PLANNED',
    'COMPLETED',
    'SKIPPED'
);


ALTER TYPE "public"."planning_entry_status" OWNER TO "postgres";


CREATE TYPE "public"."planning_entry_type" AS ENUM (
    'INCOME',
    'EXPENSE'
);


ALTER TYPE "public"."planning_entry_type" OWNER TO "postgres";


CREATE TYPE "public"."planning_period_preset" AS ENUM (
    'WEEKLY',
    'BIWEEKLY',
    'MONTHLY',
    'CUSTOM'
);


ALTER TYPE "public"."planning_period_preset" OWNER TO "postgres";


CREATE TYPE "public"."recurrence_frequency" AS ENUM (
    'WEEKLY',
    'BIWEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'ANNUAL',
    'ONCE'
);


ALTER TYPE "public"."recurrence_frequency" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'suggested',
    'active',
    'trial',
    'marked_for_cancellation',
    'cancelled',
    'dismissed'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_capture_method" AS ENUM (
    'MANUAL_FORM',
    'TEXT_QUICK_CAPTURE',
    'PDF_IMPORT',
    'OCR_BATCH',
    'OCR_SINGLE',
    'EMAIL_IMPORT',
    'EMAIL_PDF_IMPORT'
);


ALTER TYPE "public"."transaction_capture_method" OWNER TO "postgres";


CREATE TYPE "public"."transaction_direction" AS ENUM (
    'INFLOW',
    'OUTFLOW'
);


ALTER TYPE "public"."transaction_direction" OWNER TO "postgres";


CREATE TYPE "public"."transaction_status" AS ENUM (
    'PENDING',
    'POSTED',
    'CANCELLED'
);


ALTER TYPE "public"."transaction_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accounts_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM accounts_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."accounts_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accounts_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.current_balance := COALESCE(NEW.current_balance, 0);
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP'::currency_code);
  NEW.provider := COALESCE(NEW.provider, 'MANUAL'::data_provider);
  NEW.connection_status := COALESCE(NEW.connection_status, 'CONNECTED'::connection_status);
  NEW.is_active := COALESCE(NEW.is_active, true);
  NEW.display_order := COALESCE(NEW.display_order, 0);
  NEW.show_in_dashboard := COALESCE(NEW.show_in_dashboard, true);
  NEW.is_demo := COALESCE(NEW.is_demo, false);
  NEW.is_payroll_deducted := COALESCE(NEW.is_payroll_deducted, false);

  INSERT INTO accounts_enc (
    account_type, available_balance, bank_key, card_brand, color, connection_status,
    created_at, credit_limit, currency_balances, currency_code, current_balance,
    cutoff_day, debit_card_mask, display_order, expected_return_rate, icon, id,
    initial_investment, institution_name, interest_rate, is_active, is_demo,
    is_payroll_deducted, last_synced_at, loan_amount, loan_end_date,
    loan_start_date, mask, mask_hmac, maturity_date, monthly_payment, name,
    payment_day, pdf_password, provider, provider_account_id,
    provider_account_id_hmac, show_in_dashboard, updated_at, user_id
  ) VALUES (
    NEW.account_type, NEW.available_balance, NEW.bank_key, NEW.card_brand, NEW.color,
    NEW.connection_status, NEW.created_at, NEW.credit_limit,
    NEW.currency_balances, NEW.currency_code, NEW.current_balance, NEW.cutoff_day,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.debit_card_mask) ELSE zeta_encrypt_as(NEW.debit_card_mask, NEW.user_id) END,
    NEW.display_order, NEW.expected_return_rate, NEW.icon, NEW.id,
    NEW.initial_investment,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.institution_name) ELSE zeta_encrypt_as(NEW.institution_name, NEW.user_id) END,
    NEW.interest_rate, NEW.is_active, NEW.is_demo, NEW.is_payroll_deducted,
    NEW.last_synced_at, NEW.loan_amount, NEW.loan_end_date, NEW.loan_start_date,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.mask) ELSE zeta_encrypt_as(NEW.mask, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.mask) ELSE zeta_hmac_as(NEW.mask, NEW.user_id) END,
    NEW.maturity_date, NEW.monthly_payment,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE zeta_encrypt_as(NEW.name, NEW.user_id) END,
    NEW.payment_day,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.pdf_password) ELSE zeta_encrypt_as(NEW.pdf_password, NEW.user_id) END,
    NEW.provider,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.provider_account_id) ELSE zeta_encrypt_as(NEW.provider_account_id, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.provider_account_id) ELSE zeta_hmac_as(NEW.provider_account_id, NEW.user_id) END,
    NEW.show_in_dashboard, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."accounts_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accounts_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE accounts_enc SET
    account_type = NEW.account_type,
    available_balance = NEW.available_balance,
    bank_key = NEW.bank_key,
    card_brand = NEW.card_brand,
    color = NEW.color,
    connection_status = NEW.connection_status,
    created_at = NEW.created_at,
    credit_limit = NEW.credit_limit,
    currency_balances = NEW.currency_balances,
    currency_code = NEW.currency_code,
    current_balance = NEW.current_balance,
    cutoff_day = NEW.cutoff_day,
    debit_card_mask = CASE WHEN has_auth THEN zeta_encrypt(NEW.debit_card_mask) ELSE (SELECT ae.debit_card_mask FROM accounts_enc ae WHERE ae.id = OLD.id) END,
    display_order = NEW.display_order,
    expected_return_rate = NEW.expected_return_rate,
    icon = NEW.icon,
    initial_investment = NEW.initial_investment,
    institution_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.institution_name) ELSE (SELECT ae.institution_name FROM accounts_enc ae WHERE ae.id = OLD.id) END,
    interest_rate = NEW.interest_rate,
    is_active = NEW.is_active,
    is_demo = NEW.is_demo,
    is_payroll_deducted = NEW.is_payroll_deducted,
    last_synced_at = NEW.last_synced_at,
    loan_amount = NEW.loan_amount,
    loan_end_date = NEW.loan_end_date,
    loan_start_date = NEW.loan_start_date,
    mask = CASE WHEN has_auth THEN zeta_encrypt(NEW.mask) ELSE (SELECT ae.mask FROM accounts_enc ae WHERE ae.id = OLD.id) END,
    mask_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.mask) ELSE (SELECT ae.mask_hmac FROM accounts_enc ae WHERE ae.id = OLD.id) END,
    maturity_date = NEW.maturity_date,
    monthly_payment = NEW.monthly_payment,
    name = CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE (SELECT ae.name FROM accounts_enc ae WHERE ae.id = OLD.id) END,
    payment_day = NEW.payment_day,
    pdf_password = CASE WHEN has_auth THEN zeta_encrypt(NEW.pdf_password) ELSE (SELECT ae.pdf_password FROM accounts_enc ae WHERE ae.id = OLD.id) END,
    provider = NEW.provider,
    provider_account_id = CASE WHEN has_auth THEN zeta_encrypt(NEW.provider_account_id) ELSE (SELECT ae.provider_account_id FROM accounts_enc ae WHERE ae.id = OLD.id) END,
    provider_account_id_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.provider_account_id) ELSE (SELECT ae.provider_account_id_hmac FROM accounts_enc ae WHERE ae.id = OLD.id) END,
    show_in_dashboard = NEW.show_in_dashboard,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."accounts_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_tokens_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM capture_tokens_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."capture_tokens_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_tokens_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."capture_tokens_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_tokens_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."capture_tokens_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_anonymous_demo_users"("p_older_than" interval DEFAULT '7 days'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM auth.users
    WHERE is_anonymous = true
      AND COALESCE(last_sign_in_at, created_at) < now() - p_older_than
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  RAISE NOTICE 'cleanup_anonymous_demo_users deleted % rows (older than %)', deleted_count, p_older_than;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_anonymous_demo_users"("p_older_than" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_anonymous_demo_users"("p_older_than" interval) IS 'Deletes anonymous users idle longer than p_older_than. Scheduled daily via pg_cron; safe to invoke manually too.';



CREATE OR REPLACE FUNCTION "public"."delete_user_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Wipe app-scoped tables (idempotent; safe to call before delete).
  PERFORM public.reset_user_data();

  -- Cascade-delete the auth row. profiles_enc, accounts, transactions_enc,
  -- budgets, etc. all REFERENCE auth.users(id) ON DELETE CASCADE.
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_user_account"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_user_account"() IS 'Self-service account deletion for the calling auth.uid(). Wipes app data via reset_user_data() then deletes the auth.users row (cascades the rest). Required by Apple App Store Guideline 5.1.1(v).';



CREATE OR REPLACE FUNCTION "public"."destinatarios_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM destinatarios_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."destinatarios_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."destinatarios_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.is_active := COALESCE(NEW.is_active, true);
  NEW.kind := COALESCE(NEW.kind, 'merchant');
  NEW.is_ad_hoc := COALESCE(NEW.is_ad_hoc, false);

  INSERT INTO destinatarios_enc (
    id, user_id, name, name_hmac, notes, default_category_id,
    is_active, kind, is_ad_hoc, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE zeta_encrypt_as(NEW.name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.name) ELSE zeta_hmac_as(NEW.name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE zeta_encrypt_as(NEW.notes, NEW.user_id) END,
    NEW.default_category_id, NEW.is_active, NEW.kind, NEW.is_ad_hoc,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."destinatarios_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."destinatarios_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
    is_ad_hoc = NEW.is_ad_hoc,
    kind = NEW.kind,
    name = CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE _old.name END,
    name_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.name) ELSE _old.name_hmac END,
    notes = CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE _old.notes END,
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."destinatarios_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."email_ingest_addresses_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM email_ingest_addresses_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."email_ingest_addresses_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."email_ingest_addresses_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."email_ingest_addresses_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."email_ingest_addresses_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."email_ingest_addresses_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_occurrences_for_template"("p_template_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id       uuid;
  v_amount        numeric(15,2);
  v_start_date    date;
  v_end_date      date;
  v_frequency     text;
  v_is_active     boolean;
  v_range_start   date;
  v_range_end     date;
  v_cursor        date;
  v_step          integer;
  v_dates         date[] := '{}';
  v_months        date[] := '{}';
  v_d             date;
  v_month_start   date;
  v_month_end     date;
  v_keep_id       uuid;
BEGIN
  SELECT user_id, amount, start_date, end_date, frequency::text, is_active
    INTO v_user_id, v_amount, v_start_date, v_end_date, v_frequency, v_is_active
  FROM recurring_transaction_templates_enc
  WHERE id = p_template_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_is_active THEN RETURN; END IF;

  v_range_start := date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
  v_range_end   := (date_trunc('month', now() AT TIME ZONE 'America/Bogota')
                     + interval '1 month'
                     - interval '1 day'
                     + interval '14 days')::date;

  IF v_frequency = 'ONCE' THEN
    IF v_start_date BETWEEN v_range_start AND v_range_end
       AND (v_end_date IS NULL OR v_start_date <= v_end_date) THEN
      v_dates := array_append(v_dates, v_start_date);
      INSERT INTO recurring_occurrences
        (template_id, user_id, occurrence_date, expected_amount, status)
      VALUES
        (p_template_id, v_user_id, v_start_date, v_amount, 'pending')
      ON CONFLICT (template_id, occurrence_date) DO NOTHING;
    END IF;

    DELETE FROM recurring_occurrences
    WHERE template_id = p_template_id
      AND status = 'pending'
      AND transaction_id IS NULL
      AND occurrence_date BETWEEN v_range_start AND v_range_end
      AND occurrence_date <> ALL(v_dates);
    RETURN;
  END IF;

  v_step := 0;
  v_cursor := v_start_date;

  WHILE v_cursor <= v_range_end LOOP
    IF v_end_date IS NOT NULL AND v_cursor > v_end_date THEN EXIT; END IF;

    IF v_cursor >= v_range_start THEN
      v_dates := array_append(v_dates, v_cursor);
      IF v_frequency <> 'MONTHLY' THEN
        INSERT INTO recurring_occurrences
          (template_id, user_id, occurrence_date, expected_amount, status)
        VALUES
          (p_template_id, v_user_id, v_cursor, v_amount, 'pending')
        ON CONFLICT (template_id, occurrence_date) DO NOTHING;
      END IF;
    END IF;

    v_step := v_step + 1;
    v_cursor := CASE v_frequency
      WHEN 'WEEKLY'    THEN (v_start_date + (v_step * interval '7 days'))::date
      WHEN 'BIWEEKLY'  THEN quincenal_occurrence_at(v_start_date, v_step)
      WHEN 'MONTHLY'   THEN (v_start_date + (v_step * interval '1 month'))::date
      WHEN 'QUARTERLY' THEN (v_start_date + (v_step * interval '3 months'))::date
      WHEN 'ANNUAL'    THEN (v_start_date + (v_step * interval '1 year'))::date
      ELSE NULL
    END;
    IF v_cursor IS NULL THEN EXIT; END IF;
  END LOOP;

  IF v_frequency = 'MONTHLY' THEN
    FOREACH v_d IN ARRAY v_dates LOOP
      v_month_start := date_trunc('month', v_d)::date;
      v_month_end   := (v_month_start + interval '1 month')::date;
      v_months := array_append(v_months, v_month_start);

      SELECT id INTO v_keep_id
      FROM recurring_occurrences
      WHERE template_id = p_template_id
        AND occurrence_date >= v_month_start
        AND occurrence_date <  v_month_end
      ORDER BY
        (status <> 'pending' OR transaction_id IS NOT NULL) DESC,
        (occurrence_date = v_d) DESC,
        occurrence_date ASC,
        created_at ASC
      LIMIT 1;

      IF v_keep_id IS NULL THEN
        INSERT INTO recurring_occurrences
          (template_id, user_id, occurrence_date, expected_amount, status)
        VALUES
          (p_template_id, v_user_id, v_d, v_amount, 'pending')
        ON CONFLICT (template_id, occurrence_date) DO NOTHING;
      ELSE
        UPDATE planning_entries
        SET occurrence_id = v_keep_id
        WHERE id = (
          SELECT pe.id
          FROM planning_entries pe
          JOIN recurring_occurrences o ON o.id = pe.occurrence_id
          WHERE o.template_id = p_template_id
            AND o.id <> v_keep_id
            AND o.status = 'pending'
            AND o.transaction_id IS NULL
            AND o.occurrence_date >= v_month_start
            AND o.occurrence_date <  v_month_end
          LIMIT 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM planning_entries k WHERE k.occurrence_id = v_keep_id
        );

        DELETE FROM recurring_occurrences
        WHERE template_id = p_template_id
          AND id <> v_keep_id
          AND status = 'pending'
          AND transaction_id IS NULL
          AND occurrence_date >= v_month_start
          AND occurrence_date <  v_month_end;

        UPDATE recurring_occurrences
        SET occurrence_date = v_d
        WHERE id = v_keep_id
          AND status = 'pending'
          AND transaction_id IS NULL
          AND occurrence_date <> v_d;
      END IF;
    END LOOP;

    DELETE FROM recurring_occurrences
    WHERE template_id = p_template_id
      AND status = 'pending'
      AND transaction_id IS NULL
      AND occurrence_date BETWEEN v_range_start AND v_range_end
      AND date_trunc('month', occurrence_date)::date <> ALL(v_months);
  ELSE
    DELETE FROM recurring_occurrences
    WHERE template_id = p_template_id
      AND status = 'pending'
      AND transaction_id IS NULL
      AND occurrence_date BETWEEN v_range_start AND v_range_end
      AND occurrence_date <> ALL(v_dates);
  END IF;
END;
$$;


ALTER FUNCTION "public"."generate_occurrences_for_template"("p_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_accounts_with_masks"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "mask" "text", "debit_card_mask" "text", "pdf_password" "text", "account_type" "public"."account_type", "currency_code" "public"."currency_code", "current_balance" numeric, "is_demo" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    a.id,
    zeta_decrypt_as(a.mask, p_user_id),
    zeta_decrypt_as(a.debit_card_mask, p_user_id),
    zeta_decrypt_as(a.pdf_password, p_user_id),
    a.account_type,
    a.currency_code,
    a.current_balance,
    a.is_demo
  FROM accounts_enc a
  WHERE a.user_id = p_user_id AND a.is_active = true;
$$;


ALTER FUNCTION "public"."get_accounts_with_masks"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_email_ingest_settings"("p_address_key" "text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "account_id" "uuid", "auto_import" boolean, "allowed_sender" "text", "pdf_import_enabled" boolean, "address_key" "text", "allowed_senders" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    e.id,
    e.user_id,
    e.account_id,
    e.auto_import,
    zeta_decrypt_as(e.allowed_sender, e.user_id),
    e.pdf_import_enabled,
    e.address_key,
    COALESCE(
      (SELECT array_agg(s.sender_email)
       FROM email_ingest_allowed_senders s
       WHERE s.user_id = e.user_id),
      '{}'::TEXT[]
    )
  FROM email_ingest_addresses_enc e
  WHERE lower(e.address_key) = lower(p_address_key)
    AND e.is_active = true;
$$;


ALTER FUNCTION "public"."get_email_ingest_settings"("p_address_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  master_key TEXT;
  new_dek TEXT;
BEGIN
  -- Get the master encryption key from Vault
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  -- Generate DEK for new user
  new_dek := encode(gen_random_bytes(32), 'hex');

  -- Store encrypted DEK (idempotent — skip if already exists)
  INSERT INTO user_encryption_keys (user_id, encrypted_dek)
  VALUES (NEW.id, pgp_sym_encrypt(new_dek, master_key))
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert profile directly into profiles_enc (bypass view + zeta_encrypt)
  -- Uses pgp_sym_encrypt with the DEK directly — auth.uid() is NULL here
  INSERT INTO profiles_enc (
    id, full_name, email,
    preferred_currency, locale, timezone,
    onboarding_completed, demo_mode,
    created_at, updated_at
  ) VALUES (
    NEW.id,
    pgp_sym_encrypt(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), new_dek),
    pgp_sym_encrypt(COALESCE(NEW.email, ''), new_dek),
    'COP', 'es-CO', 'America/Bogota',
    false, false,
    now(), now()
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_encryption_key"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  master_key TEXT;
  new_dek TEXT;
BEGIN
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  new_dek := encode(gen_random_bytes(32), 'hex');

  INSERT INTO user_encryption_keys (user_id, encrypted_dek)
  VALUES (NEW.id, pgp_sym_encrypt(new_dek, master_key))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_encryption_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pdf_passwords_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM pdf_passwords_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."pdf_passwords_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pdf_passwords_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id         := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());

  INSERT INTO pdf_passwords_enc (
    id, user_id, alias, password, scope, bank_key, account_id,
    created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.user_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.alias)    ELSE zeta_encrypt_as(NEW.alias, NEW.user_id)    END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.password) ELSE zeta_encrypt_as(NEW.password, NEW.user_id) END,
    NEW.scope,
    NEW.bank_key,
    NEW.account_id,
    NEW.created_at,
    NEW.updated_at
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."pdf_passwords_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pdf_passwords_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE pdf_passwords_enc SET
    alias = CASE
      WHEN has_auth THEN zeta_encrypt(NEW.alias)
      ELSE (SELECT pe.alias FROM pdf_passwords_enc pe WHERE pe.id = OLD.id)
    END,
    password = CASE
      WHEN has_auth THEN zeta_encrypt(NEW.password)
      ELSE (SELECT pe.password FROM pdf_passwords_enc pe WHERE pe.id = OLD.id)
    END,
    scope       = NEW.scope,
    bank_key    = NEW.bank_key,
    account_id  = NEW.account_id,
    updated_at  = COALESCE(NEW.updated_at, now())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."pdf_passwords_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM profiles_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."profiles_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
  NEW.nav_focus := COALESCE(NEW.nav_focus, 'PLAN');
  NEW.location_tracking_enabled := COALESCE(NEW.location_tracking_enabled, false);

  INSERT INTO public.profiles_enc (
    app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
    mobile_dashboard_config,
    demo_mode, email, estimated_monthly_expenses, estimated_monthly_income,
    full_name, id, locale, location_tracking_enabled, monthly_salary,
    nav_focus, onboarding_completed, preferred_currency, timezone, updated_at
  ) VALUES (
    NEW.app_purpose, NEW.avatar_url, NEW.budget_mode, NEW.created_at,
    NEW.dashboard_config, NEW.mobile_dashboard_config, NEW.demo_mode,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.email) ELSE zeta_encrypt_as(NEW.email, NEW.id) END,
    NEW.estimated_monthly_expenses, NEW.estimated_monthly_income,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.full_name) ELSE zeta_encrypt_as(NEW.full_name, NEW.id) END,
    NEW.id, NEW.locale, NEW.location_tracking_enabled, NEW.monthly_salary,
    NEW.nav_focus, NEW.onboarding_completed,
    NEW.preferred_currency, NEW.timezone, NEW.updated_at
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."profiles_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  has_auth BOOLEAN;
  _old profiles_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM public.profiles_enc WHERE id = OLD.id;
  END IF;

  UPDATE public.profiles_enc SET
    app_purpose = NEW.app_purpose,
    avatar_url = NEW.avatar_url,
    budget_mode = NEW.budget_mode,
    created_at = NEW.created_at,
    dashboard_config = NEW.dashboard_config,
    mobile_dashboard_config = NEW.mobile_dashboard_config,
    demo_mode = NEW.demo_mode,
    email = CASE WHEN has_auth THEN zeta_encrypt(NEW.email) ELSE _old.email END,
    estimated_monthly_expenses = NEW.estimated_monthly_expenses,
    estimated_monthly_income = NEW.estimated_monthly_income,
    full_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.full_name) ELSE _old.full_name END,
    locale = NEW.locale,
    location_tracking_enabled = NEW.location_tracking_enabled,
    monthly_salary = NEW.monthly_salary,
    nav_focus = NEW.nav_focus,
    onboarding_completed = NEW.onboarding_completed,
    preferred_currency = NEW.preferred_currency,
    timezone = NEW.timezone,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."profiles_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quincenal_occurrence_at"("p_start" "date", "p_k" integer) RETURNS "date"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  WITH params AS (
    SELECT
      CASE WHEN extract(day FROM p_start)::int <= 15
           THEN extract(day FROM p_start)::int
           ELSE extract(day FROM p_start)::int - 15 END AS day_low,
      CASE WHEN extract(day FROM p_start)::int <= 15
           THEN extract(day FROM p_start)::int + 15
           ELSE extract(day FROM p_start)::int END AS day_high,
      -- Position in the combined low/high series; offset 1 when the series
      -- starts on the high day so k=0 still lands exactly on p_start.
      p_k + CASE WHEN extract(day FROM p_start)::int <= 15 THEN 0 ELSE 1 END AS idx
  ),
  base AS (
    SELECT
      (date_trunc('month', p_start) + ((idx / 2) * interval '1 month'))::date AS month_start,
      CASE WHEN idx % 2 = 0 THEN day_low ELSE day_high END AS target_day
    FROM params
  )
  SELECT month_start
    + (LEAST(
         target_day,
         extract(day FROM (month_start + interval '1 month' - interval '1 day'))::int
       ) - 1)
  FROM base;
$$;


ALTER FUNCTION "public"."quincenal_occurrence_at"("p_start" "date", "p_k" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_templates_enc_generate_occurrences_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active THEN
      PERFORM generate_occurrences_for_template(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path
  IF NEW.is_active AND (
       NOT OLD.is_active
       OR OLD.start_date IS DISTINCT FROM NEW.start_date
       OR OLD.frequency  IS DISTINCT FROM NEW.frequency
       OR OLD.end_date   IS DISTINCT FROM NEW.end_date
     ) THEN
    PERFORM generate_occurrences_for_template(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."recurring_templates_enc_generate_occurrences_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_templates_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM recurring_transaction_templates_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."recurring_templates_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_templates_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."recurring_templates_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_templates_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."recurring_templates_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_user_data"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_user_id uuid := auth.uid();
  v_table   text;
  v_user_scoped_tables constant text[] := ARRAY[
    'transaction_tags',
    'recurring_template_tags',
    'planning_assignments',
    'planning_entries',
    'planning_periods',
    'budgets',
    'debt_scenarios',
    'financial_reminders',
    'recurring_occurrence_skips',
    'obligation_skips',
    'recurring_occurrences',
    'wishlist_reflections',
    'wishlist_items',
    'pending_email_transactions',
    'pending_email_statements',
    'email_ingest_allowed_senders',
    'email_ingest_logs',
    'email_ingest_addresses',
    'unrecognized_emails',
    'capture_tokens',
    'product_events',
    'design_reviews',
    'destinatarios',
    'category_rules',
    'accounts'
  ];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF to_regclass('public.category_tags') IS NOT NULL THEN
    DELETE FROM public.category_tags
      WHERE tag_id IN (
        SELECT id FROM public.tags WHERE user_id = v_user_id
      );
  END IF;

  IF to_regclass('public.destinatario_tags') IS NOT NULL THEN
    DELETE FROM public.destinatario_tags
      WHERE destinatario_id IN (
        SELECT id FROM public.destinatarios WHERE user_id = v_user_id
      );
  END IF;

  FOREACH v_table IN ARRAY v_user_scoped_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table)
        USING v_user_id;
    END IF;
  END LOOP;

  IF to_regclass('public.tags') IS NOT NULL THEN
    DELETE FROM public.tags
      WHERE user_id = v_user_id AND is_system = false;
  END IF;
  IF to_regclass('public.tag_groups') IS NOT NULL THEN
    DELETE FROM public.tag_groups
      WHERE user_id = v_user_id AND is_system = false;
  END IF;

  UPDATE public.profiles SET
    full_name                   = NULL,
    app_purpose                 = NULL,
    avatar_url                  = NULL,
    budget_mode                 = NULL,
    estimated_monthly_income    = NULL,
    estimated_monthly_expenses  = NULL,
    monthly_salary              = NULL,
    preferred_currency          = 'COP',
    timezone                    = 'America/Bogota',
    locale                      = 'es-CO',
    onboarding_completed        = false,
    dashboard_config            = NULL,
    mobile_dashboard_config     = NULL,
    updated_at                  = now()
  WHERE id = v_user_id;
END;
$_$;


ALTER FUNCTION "public"."reset_user_data"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reset_user_data"() IS 'Wipes all user-scoped data for the calling user (auth.uid()) and resets the profile to onboarding defaults. Keeps auth.users + encryption DEK so the user can re-run onboarding from the same account. Callable from clients via supabase.rpc(''reset_user_data'').';



CREATE OR REPLACE FUNCTION "public"."set_gmail_verification"("p_ingest_id" "uuid", "p_user_id" "uuid", "p_url" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  UPDATE email_ingest_addresses_enc
  SET gmail_verification_url = zeta_encrypt_as(p_url, p_user_id),
      gmail_verification_at = now()
  WHERE id = p_ingest_id AND user_id = p_user_id;
$$;


ALTER FUNCTION "public"."set_gmail_verification"("p_ingest_id" "uuid", "p_user_id" "uuid", "p_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."statement_snapshots_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM statement_snapshots_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."statement_snapshots_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."statement_snapshots_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
    account_id, available_credit, created_at, credit_limit, currency_code,
    final_balance, id, imported_count, initial_amount, installments_in_default,
    interest_charged, interest_rate, late_interest_rate, loan_number,
    minimum_payment, payment_due_date, period_from, period_to, previous_balance,
    purchases_and_charges, remaining_balance, skipped_count, source_filename,
    total_credits, total_debits, total_payment_due, transaction_count,
    updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.available_credit, NEW.created_at, NEW.credit_limit,
    NEW.currency_code, NEW.final_balance, NEW.id, NEW.imported_count,
    NEW.initial_amount, NEW.installments_in_default, NEW.interest_charged,
    NEW.interest_rate, NEW.late_interest_rate,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.loan_number) ELSE zeta_encrypt_as(NEW.loan_number, NEW.user_id) END,
    NEW.minimum_payment, NEW.payment_due_date, NEW.period_from, NEW.period_to,
    NEW.previous_balance, NEW.purchases_and_charges, NEW.remaining_balance,
    NEW.skipped_count,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.source_filename) ELSE zeta_encrypt_as(NEW.source_filename, NEW.user_id) END,
    NEW.total_credits, NEW.total_debits, NEW.total_payment_due,
    NEW.transaction_count, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."statement_snapshots_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."statement_snapshots_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."statement_snapshots_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_subscription_on_template_active_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = false THEN
      UPDATE subscriptions
        SET status = 'cancelled', updated_at = now()
        WHERE recurring_template_id = NEW.id
          AND user_id = NEW.user_id
          AND status NOT IN ('cancelled', 'dismissed');
    ELSE
      UPDATE subscriptions
        SET status = 'active', updated_at = now()
        WHERE id = (
          SELECT id FROM subscriptions
          WHERE recurring_template_id = NEW.id
            AND user_id = NEW.user_id
            AND status = 'cancelled'
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions x
          WHERE x.user_id = NEW.user_id
            AND x.recurring_template_id = NEW.id
            AND x.status NOT IN ('cancelled', 'dismissed')
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_subscription_on_template_active_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transaction_locations_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.transaction_locations_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."transaction_locations_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transaction_locations_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."transaction_locations_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transaction_locations_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  has_auth BOOLEAN;
  _old public.transaction_locations_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM public.transaction_locations_enc WHERE id = OLD.id;
  END IF;

  UPDATE public.transaction_locations_enc SET
    user_id = NEW.user_id,
    latitude = CASE WHEN has_auth THEN zeta_encrypt(NEW.latitude::TEXT) ELSE _old.latitude END,
    longitude = CASE WHEN has_auth THEN zeta_encrypt(NEW.longitude::TEXT) ELSE _old.longitude END,
    accuracy_m = NEW.accuracy_m,
    place_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.place_name) ELSE _old.place_name END,
    place_locality = CASE WHEN has_auth THEN zeta_encrypt(NEW.place_locality) ELSE _old.place_locality END,
    place_country = NEW.place_country,
    captured_at = NEW.captured_at,
    linked_transaction_id = NEW.linked_transaction_id,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."transaction_locations_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transactions_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.transactions_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."transactions_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transactions_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
    personal_debt_id, pd_role, split_group_id, split_repaid_amount,
    flow_class, flow_class_override, flow_class_override_source,
    flow_class_version, source_pattern,
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
    NEW.personal_debt_id, NEW.pd_role, NEW.split_group_id, NEW.split_repaid_amount,
    NEW.flow_class, NEW.flow_class_override, NEW.flow_class_override_source,
    NEW.flow_class_version, NEW.source_pattern,
    NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."transactions_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transactions_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
    split_repaid_amount = NEW.split_repaid_amount,
    flow_class = NEW.flow_class,
    flow_class_override = NEW.flow_class_override,
    flow_class_override_source = NEW.flow_class_override_source,
    flow_class_version = NEW.flow_class_version,
    source_pattern = NEW.source_pattern,
    -- flow_class_effective intentionally omitted: GENERATED ALWAYS.
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."transactions_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wishlist_items_view_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM wishlist_items_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."wishlist_items_view_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wishlist_items_view_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
    id, user_id, account_id, amount, bought_at, category_id, created_at,
    currency_code, desire_type, enriched, enriched_at, funding_type, image_url,
    installments, last_nudge_dismissed_at, last_score, last_scored_at,
    last_verdict, name, ready_at, status, transaction_id, updated_at, urgency,
    url, why
  ) VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.amount, NEW.bought_at,
    NEW.category_id, NEW.created_at, NEW.currency_code, NEW.desire_type,
    NEW.enriched, NEW.enriched_at, NEW.funding_type, NEW.image_url,
    NEW.installments, NEW.last_nudge_dismissed_at, NEW.last_score,
    NEW.last_scored_at, NEW.last_verdict,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE zeta_encrypt_as(NEW.name, NEW.user_id) END,
    NEW.ready_at, NEW.status, NEW.transaction_id, NEW.updated_at, NEW.urgency,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.url) ELSE zeta_encrypt_as(NEW.url, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.why) ELSE zeta_encrypt_as(NEW.why, NEW.user_id) END
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."wishlist_items_view_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wishlist_items_view_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."wishlist_items_view_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_decrypt"("ciphertext" "bytea") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  user_dek TEXT;
  master_key TEXT;
  current_uid UUID;
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;

  current_uid := (SELECT auth.uid());

  -- Try cached DEK first (transaction-local)
  user_dek := current_setting('zeta.cached_dek', true);

  -- Validate cache belongs to current user
  IF user_dek IS NOT NULL AND current_setting('zeta.cached_uid', true) = current_uid::text THEN
    RETURN pgp_sym_decrypt(ciphertext, user_dek);
  END IF;

  -- Cache miss: fetch master key + decrypt DEK
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = current_uid;

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  -- Cache for remainder of this transaction
  PERFORM set_config('zeta.cached_dek', user_dek, true);
  PERFORM set_config('zeta.cached_uid', current_uid::text, true);

  RETURN pgp_sym_decrypt(ciphertext, user_dek);
END;
$$;


ALTER FUNCTION "public"."zeta_decrypt"("ciphertext" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_decrypt_as"("ciphertext" "bytea", "target_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = target_user_id;

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  RETURN pgp_sym_decrypt(ciphertext, user_dek);
END;
$$;


ALTER FUNCTION "public"."zeta_decrypt_as"("ciphertext" "bytea", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_encrypt"("plaintext" "text") RETURNS "bytea"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  user_dek TEXT;
  master_key TEXT;
  current_uid UUID;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  current_uid := (SELECT auth.uid());

  -- Try cached DEK first
  user_dek := current_setting('zeta.cached_dek', true);

  IF user_dek IS NOT NULL AND current_setting('zeta.cached_uid', true) = current_uid::text THEN
    RETURN pgp_sym_encrypt(plaintext, user_dek);
  END IF;

  -- Cache miss
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = current_uid;

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', current_uid;
  END IF;

  PERFORM set_config('zeta.cached_dek', user_dek, true);
  PERFORM set_config('zeta.cached_uid', current_uid::text, true);

  RETURN pgp_sym_encrypt(plaintext, user_dek);
END;
$$;


ALTER FUNCTION "public"."zeta_encrypt"("plaintext" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_encrypt_as"("plaintext" "text", "target_user_id" "uuid") RETURNS "bytea"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = target_user_id;

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', target_user_id;
  END IF;

  RETURN pgp_sym_encrypt(plaintext, user_dek);
END;
$$;


ALTER FUNCTION "public"."zeta_encrypt_as"("plaintext" "text", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_flow_class"("p_direction" "text", "p_account_type" "text", "p_description" "text", "p_transfer_group_id" "uuid" DEFAULT NULL::"uuid", "p_counterpart_account_type" "text" DEFAULT NULL::"text", "p_matched_account_type" "text" DEFAULT NULL::"text", "p_source_pattern" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  WITH d AS (SELECT public.zeta_norm_text(p_description) AS descr),
       h AS (SELECT public.zeta_flow_class_from_pattern(p_source_pattern) AS hint)
  SELECT CASE
    WHEN (SELECT hint FROM h) IS NOT NULL THEN (SELECT hint FROM h)
    WHEN p_transfer_group_id IS NOT NULL AND p_direction = 'INFLOW'
         AND p_account_type IN ('CREDIT_CARD','LOAN')                  THEN 'DEBT_CREDIT'
    WHEN p_transfer_group_id IS NOT NULL AND p_direction = 'OUTFLOW'
         AND p_counterpart_account_type IN ('CREDIT_CARD','LOAN')       THEN 'DEBT_PAYMENT'
    WHEN p_transfer_group_id IS NOT NULL                                THEN 'SELF_TRANSFER'
    WHEN (SELECT descr FROM d) ~ '^(avance|adelanto)|avance\s+(sucursal|cajero)'
                                                                        THEN 'DEBT_DRAWDOWN'
    WHEN p_direction = 'INFLOW' AND p_account_type IN ('CREDIT_CARD','LOAN')
                                                                        THEN 'DEBT_CREDIT'
    WHEN p_direction = 'INFLOW' AND (SELECT descr FROM d) ~
         'desembolso\s+de\s+credito|desembolso\s+prestamo|abono\s+desembolso'
                                                                        THEN 'DEBT_DRAWDOWN'
    WHEN p_direction = 'INFLOW'                                         THEN 'INCOME'
    WHEN p_account_type NOT IN ('CREDIT_CARD','LOAN')
         AND p_matched_account_type IN ('CREDIT_CARD','LOAN')           THEN 'DEBT_PAYMENT'
    WHEN p_matched_account_type IS NOT NULL
         AND (SELECT descr FROM d) ~
             '^(transferencia|transferencias\s+a\s|traslado|envio\s+de\s+dinero)'
                                                                        THEN 'SELF_TRANSFER'
    WHEN (SELECT descr FROM d) ~
         'pago\s+(suc\s+virt\s+)?tc\y|pago\s+tarjeta|pago\s+alternativo\s+tarj|abono\s+a\s+capital|abono\s+mora|pago\s+cuota|pago\s+pse\s+nu\y|mora\s+tarjeta|renegociado|ampliacion\s+de\s+plazo'
                                                                        THEN 'DEBT_PAYMENT'
    WHEN (SELECT descr FROM d) ~ 'retiro\s+(cajero|atm|corresponsal)'    THEN 'CASH_WITHDRAWAL'
    WHEN (SELECT descr FROM d) ~
         'impto\s+gobierno|4x1000|cuota\s+(de\s+)?manejo|comision|interes(es)?\s+corriente|interes(es)?\s+mora|cobro\s+transf|ajuste\s+interes'
                                                                        THEN 'BANK_FEE'
    ELSE 'SPEND'
  END;
$$;


ALTER FUNCTION "public"."zeta_flow_class"("p_direction" "text", "p_account_type" "text", "p_description" "text", "p_transfer_group_id" "uuid", "p_counterpart_account_type" "text", "p_matched_account_type" "text", "p_source_pattern" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."zeta_flow_class"("p_direction" "text", "p_account_type" "text", "p_description" "text", "p_transfer_group_id" "uuid", "p_counterpart_account_type" "text", "p_matched_account_type" "text", "p_source_pattern" "text") IS 'Flow classifier, rules version 2. SQL mirror of classifyFlow() in packages/shared/src/utils/flow-class.ts - keep the two in step.';



CREATE OR REPLACE FUNCTION "public"."zeta_flow_class_candidates"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "transaction_date" "date", "amount" numeric, "direction" "text", "account_type" "text", "description" "text", "transfer_group_id" "uuid", "counterpart_account_type" "text", "matched_account_id" "uuid", "matched_account_type" "text", "matched_by" "text", "source_pattern" "text", "current_flow_class" "text", "new_flow_class" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
  WITH own_accounts AS MATERIALIZED (
    SELECT
      a2.id,
      a2.account_type::text AS account_type,
      public.zeta_norm_text(nullif(zeta_decrypt_as(a2.name, a2.user_id), '')) AS nm,
      regexp_replace(
        coalesce(nullif(zeta_decrypt_as(a2.mask, a2.user_id), ''), ''),
        '[^0-9]', '', 'g'
      ) AS mk
    FROM public.accounts_enc a2
    WHERE a2.user_id = p_user_id
  )
  SELECT
    t.id,
    t.transaction_date,
    coalesce(t.amount_in_base_currency, t.amount) AS amount,
    t.direction::text,
    a.account_type::text,
    dsc.descr,
    t.transfer_group_id,
    cp.account_type::text,
    dest.id,
    dest.account_type,
    dest.kind,
    t.source_pattern,
    t.flow_class,
    public.zeta_flow_class(
      t.direction::text,
      a.account_type::text,
      dsc.descr,
      t.transfer_group_id,
      cp.account_type::text,
      dest.account_type,
      t.source_pattern
    )
  FROM public.transactions_enc t
  JOIN public.accounts_enc a ON a.id = t.account_id
  CROSS JOIN LATERAL (
    SELECT d.raw AS descr, public.zeta_norm_text(d.raw) AS descr_norm
    FROM (
      SELECT coalesce(
        nullif(zeta_decrypt_as(t.merchant_name,     t.user_id), ''),
        nullif(zeta_decrypt_as(t.clean_description, t.user_id), ''),
        nullif(zeta_decrypt_as(t.raw_description,   t.user_id), ''),
        ''
      ) AS raw
    ) d
  ) dsc
  LEFT JOIN LATERAL (
    SELECT a2.account_type
    FROM public.transactions_enc t2
    JOIN public.accounts_enc a2 ON a2.id = t2.account_id
    WHERE t.transfer_group_id IS NOT NULL
      AND t2.transfer_group_id = t.transfer_group_id
      AND t2.user_id = t.user_id
      AND t2.id <> t.id
    ORDER BY t2.created_at
    LIMIT 1
  ) cp ON true
  LEFT JOIN LATERAL (
    SELECT oa.id, oa.account_type, m.kind
    FROM own_accounts oa
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN length(oa.mk) >= 4
             AND dsc.descr_norm ~ ('(^|[^0-9])' || oa.mk || '([^0-9]|$)')
          THEN 'mask'
        WHEN length(oa.nm) >= 4
             AND (' ' || dsc.descr_norm || ' ') LIKE
                 ('% ' || replace(replace(replace(oa.nm,'\','\\'),'%','\%'),'_','\_') || ' %')
          THEN 'name'
        ELSE NULL
      END AS kind
    ) m
    WHERE m.kind IS NOT NULL
      AND oa.id <> t.account_id
    ORDER BY (m.kind = 'mask') DESC, length(oa.nm) DESC NULLS LAST
    LIMIT 1
  ) dest ON true
  WHERE t.user_id = p_user_id;
$_$;


ALTER FUNCTION "public"."zeta_flow_class_candidates"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_flow_class_from_pattern"("p_pattern" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE p_pattern
    WHEN 'retiro'                  THEN 'CASH_WITHDRAWAL'
    WHEN 'compra_debito'           THEN 'SPEND'
    WHEN 'compra_credito'          THEN 'SPEND'
    WHEN 'qr_pago'                 THEN 'SPEND'
    WHEN 'boton_bancolombia'       THEN 'SPEND'
    WHEN 'pago_pse'                THEN 'SPEND'
    WHEN 'bre_b'                   THEN 'SPEND'
    WHEN 'qr_transferencia'        THEN 'SPEND'
    WHEN 'avance'                  THEN 'DEBT_DRAWDOWN'
    WHEN 'nomina'                  THEN 'INCOME'
    WHEN 'pago_recibido'           THEN 'INCOME'
    WHEN 'pago_recibido_cuenta'    THEN 'INCOME'
    WHEN 'qr_recibido'             THEN 'INCOME'
    WHEN 'transferencia_recibida'  THEN 'INCOME'
    WHEN 'PAYMENT'                 THEN 'DEBT_PAYMENT'
    WHEN 'PURCHASE'                THEN 'SPEND'
    WHEN 'CASH_ADVANCE'            THEN 'DEBT_DRAWDOWN'
    WHEN 'INTEREST'                THEN 'BANK_FEE'
    WHEN 'FEE'                     THEN 'BANK_FEE'
    WHEN 'DISBURSEMENT'            THEN 'DEBT_DRAWDOWN'
    WHEN 'INSTALLMENT'             THEN 'SPEND'
    ELSE NULL
  END;
$$;


ALTER FUNCTION "public"."zeta_flow_class_from_pattern"("p_pattern" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."zeta_flow_class_from_pattern"("p_pattern" "text") IS 'Maps a raw parser signal to a flow class. Mirrors EMAIL_PATTERN_TO_FLOW + PY_HINT_TO_FLOW in flow-class.ts. Outbound bare `transferencia` is deliberately absent.';



CREATE OR REPLACE FUNCTION "public"."zeta_hmac"("plaintext" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  user_dek TEXT;
  master_key TEXT;
  current_uid UUID;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  current_uid := (SELECT auth.uid());

  -- Try cached DEK first
  user_dek := current_setting('zeta.cached_dek', true);

  IF user_dek IS NOT NULL AND current_setting('zeta.cached_uid', true) = current_uid::text THEN
    RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
  END IF;

  -- Cache miss
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = current_uid;

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  PERFORM set_config('zeta.cached_dek', user_dek, true);
  PERFORM set_config('zeta.cached_uid', current_uid::text, true);

  RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
END;
$$;


ALTER FUNCTION "public"."zeta_hmac"("plaintext" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_hmac_as"("plaintext" "text", "target_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = target_user_id;

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', target_user_id;
  END IF;

  RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
END;
$$;


ALTER FUNCTION "public"."zeta_hmac_as"("plaintext" "text", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_mcp_accounts"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "account_type" "text", "institution" "text", "mask" "text", "current_balance" numeric, "currency_code" "text", "credit_limit" numeric, "interest_rate" numeric, "monthly_payment" numeric, "cutoff_day" smallint, "payment_day" smallint, "is_active" boolean, "last_movement" "date", "movements_90d" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    a.id,
    nullif(zeta_decrypt_as(a.name, a.user_id), '') as name,
    a.account_type::text,
    nullif(zeta_decrypt_as(a.institution_name, a.user_id), '') as institution,
    nullif(zeta_decrypt_as(a.mask, a.user_id), '') as mask,
    a.current_balance,
    a.currency_code::text,
    a.credit_limit,
    a.interest_rate,
    a.monthly_payment,
    a.cutoff_day,
    a.payment_day,
    a.is_active,
    m.last_movement,
    coalesce(m.movements_90d, 0) as movements_90d
  from accounts_enc a
  left join lateral (
    select max(t.transaction_date) as last_movement,
           count(*) filter (where t.transaction_date >= current_date - 90) as movements_90d
    from transactions_enc t
    where t.account_id = a.id and t.user_id = a.user_id
  ) m on true
  where a.user_id = p_user_id
  order by a.is_active desc, a.display_order nulls last, a.account_type;
$$;


ALTER FUNCTION "public"."zeta_mcp_accounts"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_mcp_breakdown"("p_user_id" "uuid", "p_from" "date", "p_to" "date") RETURNS TABLE("flow_class" "text", "parent_category" "text", "category" "text", "expense_type" "text", "is_essential" boolean, "tx_count" bigint, "total" numeric, "monthly_avg" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with months as (
    select greatest(
      1,
      (date_part('year', age(p_to, p_from)) * 12 + date_part('month', age(p_to, p_from)) + 1)::int
    ) as n
  )
  select
    b.flow_class,
    b.parent_category,
    coalesce(b.category, '(sin categoría)') as category,
    b.expense_type,
    coalesce(b.is_essential, false) as is_essential,
    count(*) as tx_count,
    sum(b.amount) as total,
    round(sum(b.amount) / (select n from months)) as monthly_avg
  from zeta_mcp_tx_base(p_user_id, p_from, p_to) b
  where b.direction = 'OUTFLOW'
  group by 1, 2, 3, 4, 5
  order by sum(b.amount) desc;
$$;


ALTER FUNCTION "public"."zeta_mcp_breakdown"("p_user_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_mcp_cashflow"("p_user_id" "uuid", "p_months" integer DEFAULT 12) RETURNS TABLE("month" "text", "income" numeric, "spend" numeric, "debt_payments" numeric, "self_transfers" numeric, "cash_withdrawals" numeric, "bank_fees" numeric, "net" numeric, "tx_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    to_char(b.transaction_date, 'YYYY-MM') as month,
    sum(b.amount) filter (where b.flow_class = 'INCOME')          as income,
    sum(b.amount) filter (where b.flow_class = 'SPEND')           as spend,
    sum(b.amount) filter (where b.flow_class = 'DEBT_PAYMENT')    as debt_payments,
    sum(b.amount) filter (where b.flow_class = 'SELF_TRANSFER')   as self_transfers,
    sum(b.amount) filter (where b.flow_class = 'CASH_WITHDRAWAL') as cash_withdrawals,
    sum(b.amount) filter (where b.flow_class = 'BANK_FEE')        as bank_fees,
    coalesce(sum(b.amount) filter (where b.flow_class = 'INCOME'), 0)
      - coalesce(sum(b.amount) filter (where b.direction = 'OUTFLOW'), 0) as net,
    count(*) as tx_count
  from zeta_mcp_tx_base(
    p_user_id,
    (date_trunc('month', current_date) - make_interval(months => greatest(1, coalesce(p_months, 12)) - 1))::date,
    current_date
  ) b
  group by 1
  order by 1 desc;
$$;


ALTER FUNCTION "public"."zeta_mcp_cashflow"("p_user_id" "uuid", "p_months" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_mcp_data_quality"("p_user_id" "uuid", "p_from" "date", "p_to" "date") RETURNS TABLE("check_name" "text", "severity" "text", "affected" bigint, "amount" numeric, "detail" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with b as (select * from zeta_mcp_tx_base(p_user_id, p_from, p_to))

  select
    'gasto_sin_categoria'::text,
    (case when sum(amount) filter (where category_id is null and direction = 'OUTFLOW')
            > 0.25 * nullif(sum(amount) filter (where direction = 'OUTFLOW'), 0)
          then 'alta' else 'media' end)::text,
    count(*) filter (where category_id is null and direction = 'OUTFLOW'),
    coalesce(sum(amount) filter (where category_id is null and direction = 'OUTFLOW'), 0),
    'Movimientos de salida sin categoría asignada. Mientras existan, el desglose por categoría subestima el gasto real.'::text
  from b
  having count(*) filter (where category_id is null and direction = 'OUTFLOW') > 0

  union all

  select
    'transferencias_sin_destino'::text, 'alta'::text,
    count(*), coalesce(sum(amount), 0),
    'Transferencias salientes sin cuenta destino registrada en Zeta. El dinero sale del balance pero no aparece en ninguna otra cuenta.'::text
  from b where flow_class = 'SELF_TRANSFER'
  having count(*) > 0

  union all

  select
    'efectivo_sin_trazar'::text, 'media'::text,
    count(*), coalesce(sum(amount), 0),
    'Retiros en cajero. El monto es real pero no se sabe en qué se gastó, así que no aparece en ninguna categoría.'::text
  from b where flow_class = 'CASH_WITHDRAWAL'
  having count(*) > 0

  union all

  select
    'ajustes_manuales_de_saldo'::text, 'alta'::text,
    count(*), coalesce(sum(amount), 0),
    'Ajustes manuales de saldo. Son un parche: indican que el saldo real no cuadraba con los movimientos registrados.'::text
  from b where description ilike '%ajuste manual%'
  having count(*) > 0

  union all

  select
    'posibles_duplicados'::text, 'media'::text,
    count(*), coalesce(sum(d.dup_amount * (d.c - 1)), 0),
    'Movimientos con mismo monto, misma fecha y misma cuenta. Pueden ser duplicados de importación o compras legítimas repetidas.'::text
  from (
    select transaction_date, account_id, amount as dup_amount, count(*) as c
    from b where direction = 'OUTFLOW'
    group by 1, 2, 3 having count(*) > 1
  ) d
  having count(*) > 0

  union all

  select
    'cuentas_activas_sin_movimiento'::text, 'media'::text,
    count(*), coalesce(sum(abs(a.current_balance)), 0),
    'Cuentas marcadas como activas sin movimientos en los últimos 90 días. O están muertas, o falta importar sus extractos.'::text
  from zeta_mcp_accounts(p_user_id) a
  where a.is_active and a.movements_90d = 0
  having count(*) > 0

  union all

  select
    'tarjeta_sobre_el_cupo'::text, 'alta'::text,
    count(*), coalesce(sum(a.current_balance - a.credit_limit), 0),
    'Tarjetas cuyo saldo supera el cupo registrado. Normalmente significa que el cupo está desactualizado o el saldo quedó mal tras un pago.'::text
  from zeta_mcp_accounts(p_user_id) a
  where a.is_active and a.account_type = 'CREDIT_CARD'
    and a.credit_limit > 0 and a.current_balance > a.credit_limit
  having count(*) > 0

  union all

  select
    'recurrentes_duplicados'::text, 'media'::text,
    count(*), coalesce(sum(r.amount), 0),
    'Pagos recurrentes activos distintos con el mismo monto exacto. Suelen ser el mismo servicio registrado dos veces.'::text
  from zeta_mcp_recurring(p_user_id) r
  where r.is_active
    and r.amount in (
      select amount from zeta_mcp_recurring(p_user_id)
      where is_active group by amount having count(*) > 1
    )
  having count(*) > 0;
$$;


ALTER FUNCTION "public"."zeta_mcp_data_quality"("p_user_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_mcp_recurring"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "amount" numeric, "currency_code" "text", "direction" "text", "frequency" "text", "day_of_month" integer, "category" "text", "is_active" boolean, "monthly_equiv" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    r.id,
    coalesce(
      nullif(zeta_decrypt_as(r.merchant_name, r.user_id), ''),
      nullif(zeta_decrypt_as(r.description, r.user_id), ''),
      'Sin nombre'
    ) as name,
    r.amount,
    r.currency_code::text,
    r.direction::text,
    r.frequency::text,
    r.day_of_month,
    coalesce(c.name_es, c.name) as category,
    r.is_active,
    case r.frequency::text
      when 'WEEKLY'    then r.amount * 52 / 12
      when 'BIWEEKLY'  then r.amount * 2
      when 'MONTHLY'   then r.amount
      when 'QUARTERLY' then r.amount / 3
      when 'ANNUAL'    then r.amount / 12
      else 0
    end as monthly_equiv
  from recurring_transaction_templates_enc r
  left join categories c on c.id = r.category_id
  where r.user_id = p_user_id
  order by r.is_active desc, r.amount desc;
$$;


ALTER FUNCTION "public"."zeta_mcp_recurring"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_mcp_transactions"("p_user_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date", "p_direction" "text" DEFAULT NULL::"text", "p_account_id" "uuid" DEFAULT NULL::"uuid", "p_flow_class" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text", "p_min_amount" numeric DEFAULT NULL::numeric, "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "transaction_date" "date", "amount" numeric, "currency_code" "text", "direction" "text", "description" "text", "category" "text", "parent_category" "text", "account_name" "text", "account_type" "text", "flow_class" "text", "capture_method" "text", "total_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with filtered as (
    select b.*
    from zeta_mcp_tx_base(p_user_id, p_from, p_to) b
    where (p_direction  is null or b.direction = p_direction)
      and (p_account_id is null or b.account_id = p_account_id)
      and (p_flow_class is null or b.flow_class = p_flow_class)
      and (p_min_amount is null or b.amount >= p_min_amount)
      and (p_search is null or b.description ilike '%' || p_search || '%'
           or coalesce(b.category, '') ilike '%' || p_search || '%')
  )
  select
    f.id, f.transaction_date, f.amount, f.currency_code, f.direction,
    f.description, f.category, f.parent_category, f.account_name, f.account_type,
    f.flow_class, f.capture_method,
    count(*) over () as total_count
  from filtered f
  order by f.transaction_date desc, f.amount desc
  limit greatest(1, least(coalesce(p_limit, 50), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;


ALTER FUNCTION "public"."zeta_mcp_transactions"("p_user_id" "uuid", "p_from" "date", "p_to" "date", "p_direction" "text", "p_account_id" "uuid", "p_flow_class" "text", "p_search" "text", "p_min_amount" numeric, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_mcp_tx_base"("p_user_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("id" "uuid", "transaction_date" "date", "amount" numeric, "currency_code" "text", "direction" "text", "description" "text", "merchant" "text", "notes" "text", "category" "text", "parent_category" "text", "category_id" "uuid", "expense_type" "text", "is_essential" boolean, "account_id" "uuid", "account_name" "text", "account_type" "text", "capture_method" "text", "is_subscription" boolean, "installment_current" smallint, "installment_total" smallint, "flow_class" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    t.id,
    t.transaction_date,
    coalesce(t.amount_in_base_currency, t.amount),
    t.currency_code::text,
    t.direction::text,
    coalesce(
      nullif(zeta_decrypt_as(t.merchant_name,     t.user_id), ''),
      nullif(zeta_decrypt_as(t.clean_description, t.user_id), ''),
      nullif(zeta_decrypt_as(t.raw_description,   t.user_id), ''),
      ''
    ),
    nullif(zeta_decrypt_as(t.merchant_name, t.user_id), ''),
    nullif(zeta_decrypt_as(t.notes, t.user_id), ''),
    coalesce(c.name_es, c.name),
    coalesce(p.name_es, p.name),
    t.category_id,
    c.expense_type,
    c.is_essential,
    t.account_id,
    nullif(zeta_decrypt_as(a.name, a.user_id), ''),
    a.account_type::text,
    t.capture_method::text,
    t.is_subscription,
    t.installment_current,
    t.installment_total,
    t.flow_class_effective
  FROM transactions_enc t
  JOIN accounts_enc a ON a.id = t.account_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN categories p ON p.id = c.parent_id
  WHERE t.user_id = p_user_id
    AND coalesce(t.is_excluded, false) = false
    AND t.reconciled_into_transaction_id IS NULL
    AND t.status <> 'CANCELLED'
    AND (p_from IS NULL OR t.transaction_date >= p_from)
    AND (p_to   IS NULL OR t.transaction_date <= p_to);
$$;


ALTER FUNCTION "public"."zeta_mcp_tx_base"("p_user_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zeta_norm_text"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  SELECT regexp_replace(
           regexp_replace(
             translate(lower(coalesce(p_text, '')),
                       'áàäâéèëêíìïîóòöôúùüûñ',
                       'aaaaeeeeiiiioooouuuun'),
             '\s{2,}', ' ', 'g'),
           '^\s+|\s+$', '', 'g');
$_$;


ALTER FUNCTION "public"."zeta_norm_text"("p_text" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."zeta_norm_text"("p_text" "text") IS 'Lowercase + strip diacritics + collapse whitespace. SQL mirror of normalize() in packages/shared/src/utils/flow-class.ts.';



CREATE OR REPLACE FUNCTION "public"."zeta_transactions_fill_flow_class"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_account_type text;
  v_description  text;
BEGIN
  IF NEW.flow_class IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.account_type::text INTO v_account_type
  FROM public.accounts_enc a
  WHERE a.id = NEW.account_id;

  v_description := coalesce(
    nullif(zeta_decrypt_as(NEW.merchant_name,     NEW.user_id), ''),
    nullif(zeta_decrypt_as(NEW.clean_description, NEW.user_id), ''),
    nullif(zeta_decrypt_as(NEW.raw_description,   NEW.user_id), ''),
    ''
  );

  NEW.flow_class := public.zeta_flow_class(
    NEW.direction::text,
    v_account_type,
    v_description,
    NEW.transfer_group_id,
    NULL,
    NULL,
    NEW.source_pattern
  );

  IF NEW.flow_class_version IS NULL THEN
    NEW.flow_class_version := 2;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."zeta_transactions_fill_flow_class"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."product_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "event_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "text",
    "platform" "text" DEFAULT 'web'::"text" NOT NULL,
    "entry_point" "text",
    "flow" "text",
    "step" "text",
    "success" boolean,
    "duration_ms" integer,
    "error_code" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_events_duration_non_negative" CHECK ((("duration_ms" IS NULL) OR ("duration_ms" >= 0)))
);


ALTER TABLE "public"."product_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "analytics"."activation_d7" AS
 WITH "signups" AS (
         SELECT "product_events"."user_id",
            "min"("product_events"."event_time") AS "signup_time"
           FROM "public"."product_events"
          WHERE (("product_events"."event_name" = 'auth_signup_completed'::"text") AND ("product_events"."success" IS TRUE))
          GROUP BY "product_events"."user_id"
        ), "activated" AS (
         SELECT DISTINCT "e"."user_id"
           FROM ("public"."product_events" "e"
             JOIN "signups" "s_1" ON (("s_1"."user_id" = "e"."user_id")))
          WHERE (("e"."event_name" = ANY (ARRAY['import_completed'::"text", 'transaction_categorized'::"text", 'first_financial_insight_rendered'::"text"])) AND ("e"."success" IS TRUE) AND ("e"."event_time" <= ("s_1"."signup_time" + '7 days'::interval)))
        )
 SELECT ("date_trunc"('day'::"text", "s"."signup_time"))::"date" AS "cohort_day",
    "count"(*) AS "signups",
    "count"("a"."user_id") AS "activated_d7",
        CASE
            WHEN ("count"(*) = 0) THEN (0)::numeric
            ELSE "round"(((("count"("a"."user_id"))::numeric / ("count"(*))::numeric) * (100)::numeric), 2)
        END AS "activation_d7_pct"
   FROM ("signups" "s"
     LEFT JOIN "activated" "a" ON (("a"."user_id" = "s"."user_id")))
  GROUP BY (("date_trunc"('day'::"text", "s"."signup_time"))::"date")
  ORDER BY (("date_trunc"('day'::"text", "s"."signup_time"))::"date") DESC;


ALTER VIEW "analytics"."activation_d7" OWNER TO "postgres";


CREATE OR REPLACE VIEW "analytics"."categorization_funnel_daily" AS
 WITH "base" AS (
         SELECT ("date_trunc"('day'::"text", "product_events"."event_time"))::"date" AS "day",
            "product_events"."user_id",
            "max"((("product_events"."event_name" = 'uncategorized_item_seen'::"text"))::integer) AS "seen",
            "max"((("product_events"."event_name" = 'category_picker_opened'::"text"))::integer) AS "picker_opened",
            "max"((("product_events"."event_name" = 'category_selected'::"text"))::integer) AS "selected",
            "max"(((("product_events"."event_name" = 'transaction_categorized'::"text") AND COALESCE("product_events"."success", false)))::integer) AS "categorized",
            "max"(((("product_events"."event_name" = 'bulk_categorize_applied'::"text") AND COALESCE("product_events"."success", false)))::integer) AS "bulk_categorized"
           FROM "public"."product_events"
          WHERE ("product_events"."flow" = 'categorize'::"text")
          GROUP BY (("date_trunc"('day'::"text", "product_events"."event_time"))::"date"), "product_events"."user_id"
        )
 SELECT "day",
    "count"(*) AS "users_with_activity",
    "sum"("seen") AS "seen",
    "sum"("picker_opened") AS "picker_opened",
    "sum"("selected") AS "selected",
    "sum"("categorized") AS "categorized",
    "sum"("bulk_categorized") AS "bulk_categorized",
        CASE
            WHEN ("sum"("seen") = 0) THEN (0)::numeric
            ELSE "round"(((("sum"("categorized"))::numeric / ("sum"("seen"))::numeric) * (100)::numeric), 2)
        END AS "seen_to_categorized_pct"
   FROM "base"
  GROUP BY "day"
  ORDER BY "day" DESC;


ALTER VIEW "analytics"."categorization_funnel_daily" OWNER TO "postgres";


CREATE OR REPLACE VIEW "analytics"."import_funnel_daily" AS
 WITH "base" AS (
         SELECT ("date_trunc"('day'::"text", "product_events"."event_time"))::"date" AS "day",
            "product_events"."user_id",
            COALESCE("product_events"."session_id", "concat"(("product_events"."user_id")::"text", ':', ("date_trunc"('minute'::"text", "product_events"."event_time"))::"text")) AS "sid",
            "max"((("product_events"."event_name" = 'import_flow_opened'::"text"))::integer) AS "opened",
            "max"((("product_events"."event_name" = 'import_file_selected'::"text"))::integer) AS "file_selected",
            "max"((("product_events"."event_name" = 'import_parse_requested'::"text"))::integer) AS "parse_requested",
            "max"((("product_events"."event_name" = 'import_parse_succeeded'::"text"))::integer) AS "parse_succeeded",
            "max"((("product_events"."event_name" = 'import_confirm_submitted'::"text"))::integer) AS "confirm_submitted",
            "max"(((("product_events"."event_name" = 'import_completed'::"text") AND COALESCE("product_events"."success", false)))::integer) AS "completed"
           FROM "public"."product_events"
          WHERE ("product_events"."flow" = 'import'::"text")
          GROUP BY (("date_trunc"('day'::"text", "product_events"."event_time"))::"date"), "product_events"."user_id", COALESCE("product_events"."session_id", "concat"(("product_events"."user_id")::"text", ':', ("date_trunc"('minute'::"text", "product_events"."event_time"))::"text"))
        )
 SELECT "day",
    "count"(*) AS "sessions",
    "sum"("opened") AS "opened",
    "sum"("file_selected") AS "file_selected",
    "sum"("parse_requested") AS "parse_requested",
    "sum"("parse_succeeded") AS "parse_succeeded",
    "sum"("confirm_submitted") AS "confirm_submitted",
    "sum"("completed") AS "completed",
        CASE
            WHEN ("sum"("opened") = 0) THEN (0)::numeric
            ELSE "round"(((("sum"("completed"))::numeric / ("sum"("opened"))::numeric) * (100)::numeric), 2)
        END AS "open_to_complete_pct"
   FROM "base"
  GROUP BY "day"
  ORDER BY "day" DESC;


ALTER VIEW "analytics"."import_funnel_daily" OWNER TO "postgres";


CREATE OR REPLACE VIEW "analytics"."product_event_daily_counts" AS
 SELECT ("date_trunc"('day'::"text", "event_time"))::"date" AS "day",
    "event_name",
    COALESCE("flow", 'unknown'::"text") AS "flow",
    "count"(*) AS "event_count",
    "count"(DISTINCT "user_id") AS "user_count"
   FROM "public"."product_events"
  GROUP BY (("date_trunc"('day'::"text", "event_time"))::"date"), "event_name", COALESCE("flow", 'unknown'::"text");


ALTER VIEW "analytics"."product_event_daily_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounts_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "bytea" NOT NULL,
    "account_type" "public"."account_type" NOT NULL,
    "institution_name" "bytea",
    "mask" "bytea",
    "current_balance" numeric DEFAULT 0 NOT NULL,
    "available_balance" numeric,
    "currency_code" "public"."currency_code" DEFAULT 'COP'::"public"."currency_code" NOT NULL,
    "credit_limit" numeric,
    "interest_rate" numeric,
    "provider" "public"."data_provider" DEFAULT 'MANUAL'::"public"."data_provider" NOT NULL,
    "provider_account_id" "bytea",
    "connection_status" "public"."connection_status" DEFAULT 'CONNECTED'::"public"."connection_status" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "color" "text" DEFAULT '#6366f1'::"text",
    "icon" "text" DEFAULT 'wallet'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cutoff_day" smallint,
    "payment_day" smallint,
    "loan_amount" numeric,
    "monthly_payment" numeric,
    "loan_start_date" "date",
    "loan_end_date" "date",
    "initial_investment" numeric,
    "expected_return_rate" numeric,
    "maturity_date" "date",
    "currency_balances" "jsonb",
    "show_in_dashboard" boolean DEFAULT true NOT NULL,
    "debit_card_mask" "bytea",
    "pdf_password" "bytea",
    "mask_hmac" "text",
    "provider_account_id_hmac" "text",
    "is_demo" boolean DEFAULT false NOT NULL,
    "is_payroll_deducted" boolean DEFAULT false NOT NULL,
    "card_brand" "text",
    "bank_key" "text",
    CONSTRAINT "accounts_cutoff_day_range" CHECK ((("cutoff_day" >= 1) AND ("cutoff_day" <= 31))),
    CONSTRAINT "accounts_expected_return_rate_range" CHECK ((("expected_return_rate" >= (0)::numeric) AND ("expected_return_rate" <= (100)::numeric))),
    CONSTRAINT "accounts_payment_day_range" CHECK ((("payment_day" >= 1) AND ("payment_day" <= 31))),
    CONSTRAINT "accounts_positive_credit_limit" CHECK ((("credit_limit" IS NULL) OR ("credit_limit" >= (0)::numeric))),
    CONSTRAINT "accounts_valid_interest_rate" CHECK ((("interest_rate" IS NULL) OR (("interest_rate" >= (0)::numeric) AND ("interest_rate" <= (100)::numeric))))
);


ALTER TABLE "public"."accounts_enc" OWNER TO "postgres";


COMMENT ON COLUMN "public"."accounts_enc"."currency_balances" IS 'Per-currency balance data: { "COP": { current_balance, credit_limit, available_balance, interest_rate, minimum_payment, total_payment_due }, "USD": { ... } }';



COMMENT ON COLUMN "public"."accounts_enc"."is_demo" IS 'Tags demo/mock accounts created for preview purposes';



COMMENT ON COLUMN "public"."accounts_enc"."is_payroll_deducted" IS 'When true, loan payments are payroll-deducted (libranza) — import flow skips tx creation';



CREATE OR REPLACE VIEW "public"."accounts" WITH ("security_invoker"='true') AS
 SELECT "account_type",
    "available_balance",
    "bank_key",
    "card_brand",
    "color",
    "connection_status",
    "created_at",
    "credit_limit",
    "currency_balances",
    "currency_code",
    "current_balance",
    "cutoff_day",
    "public"."zeta_decrypt"("debit_card_mask") AS "debit_card_mask",
    "display_order",
    "expected_return_rate",
    "icon",
    "id",
    "initial_investment",
    "public"."zeta_decrypt"("institution_name") AS "institution_name",
    "interest_rate",
    "is_active",
    "is_demo",
    "is_payroll_deducted",
    "last_synced_at",
    "loan_amount",
    "loan_end_date",
    "loan_start_date",
    "public"."zeta_decrypt"("mask") AS "mask",
    "mask_hmac",
    "maturity_date",
    "monthly_payment",
    "public"."zeta_decrypt"("name") AS "name",
    "payment_day",
    "public"."zeta_decrypt"("pdf_password") AS "pdf_password",
    "provider",
    "public"."zeta_decrypt"("provider_account_id") AS "provider_account_id",
    "provider_account_id_hmac",
    "show_in_dashboard",
    "updated_at",
    "user_id"
   FROM "public"."accounts_enc";


ALTER VIEW "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_config" (
    "id" "text" NOT NULL,
    "prompt_text" "text"
);


ALTER TABLE "public"."admin_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "draft" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "applied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."budget_scenarios" OWNER TO "postgres";


COMMENT ON TABLE "public"."budget_scenarios" IS 'Editable budget-scenario drafts for the "Simular cambio" feature. Plain table — low-sensitivity names; draft JSONB softly references category/wishlist ids + amounts. applied_at marks when a scenario was applied to real budgets.';



CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "period" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_demo" boolean DEFAULT false NOT NULL,
    CONSTRAINT "budgets_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "budgets_period_check" CHECK (("period" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."budgets"."is_demo" IS 'Tags demo/mock budgets created for preview purposes';



CREATE TABLE IF NOT EXISTS "public"."bug_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'mobile'::"text" NOT NULL,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "route_hint" "text",
    "selected_area_hint" "text",
    "attachment_path" "text",
    "device_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "github_issue_url" "text",
    CONSTRAINT "bug_reports_status_valid" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'TRIAGED'::"text", 'RESOLVED'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."bug_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capture_tokens_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "bytea" NOT NULL,
    "label" "bytea" NOT NULL,
    "default_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "token_hash" "text" NOT NULL
);


ALTER TABLE "public"."capture_tokens_enc" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."capture_tokens" WITH ("security_invoker"='true') AS
 SELECT "created_at",
    "default_account_id",
    "id",
    "public"."zeta_decrypt"("label") AS "label",
    "last_used_at",
    "revoked_at",
    "public"."zeta_decrypt"("token") AS "token",
    "token_hash",
    "user_id"
   FROM "public"."capture_tokens_enc";


ALTER VIEW "public"."capture_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "name_es" "text",
    "slug" "text" NOT NULL,
    "icon" "text" DEFAULT 'tag'::"text" NOT NULL,
    "color" "text" DEFAULT '#6b7280'::"text" NOT NULL,
    "direction" "public"."transaction_direction",
    "is_system" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_essential" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expense_type" "text",
    CONSTRAINT "categories_expense_type_check" CHECK (("expense_type" = ANY (ARRAY['fixed'::"text", 'variable'::"text"]))),
    CONSTRAINT "categories_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 50))),
    CONSTRAINT "categories_no_self_parent" CHECK (("id" <> "parent_id"))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pattern" "text" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "match_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."category_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_tags" (
    "category_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."category_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debt_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "cash_entries" "jsonb" NOT NULL,
    "strategy" "text" DEFAULT 'avalanche'::"text" NOT NULL,
    "allocations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "snapshot_accounts" "jsonb" NOT NULL,
    "results" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."debt_scenarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "severity" "text" DEFAULT 'bug'::"text" NOT NULL,
    "route" "text",
    "component_hint" "text",
    "annotation_path" "text",
    "excalidraw_path" "text",
    "device_context" "jsonb" DEFAULT '{}'::"jsonb",
    "resolved_by" "text",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "design_reviews_resolved_by_check" CHECK (("resolved_by" = ANY (ARRAY['claude'::"text", 'manual'::"text"]))),
    CONSTRAINT "design_reviews_severity_check" CHECK (("severity" = ANY (ARRAY['nit'::"text", 'bug'::"text", 'idea'::"text", 'sketch'::"text"]))),
    CONSTRAINT "design_reviews_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."design_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destinatario_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "destinatario_id" "uuid" NOT NULL,
    "match_type" "text" DEFAULT 'contains'::"text" NOT NULL,
    "pattern" "text" NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "match_count" integer DEFAULT 0 NOT NULL,
    "last_matched_at" timestamp with time zone,
    CONSTRAINT "destinatario_rules_match_type_check" CHECK (("match_type" = ANY (ARRAY['contains'::"text", 'exact'::"text"])))
);


ALTER TABLE "public"."destinatario_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destinatario_tags" (
    "destinatario_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."destinatario_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destinatarios_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "bytea" NOT NULL,
    "default_category_id" "uuid",
    "notes" "bytea",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name_hmac" "text",
    "kind" "public"."destinatario_kind" DEFAULT 'merchant'::"public"."destinatario_kind" NOT NULL,
    "is_ad_hoc" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."destinatarios_enc" OWNER TO "postgres";


COMMENT ON COLUMN "public"."destinatarios_enc"."is_ad_hoc" IS 'True for throwaway counterparties materialized by a split (Pago compartido / Dividir deuda) from a typed name. Hidden from pickers and the destinatarios page; promotable to a real contact. Non-PII, plaintext.';



CREATE OR REPLACE VIEW "public"."destinatarios" WITH ("security_invoker"='true') AS
 SELECT "created_at",
    "default_category_id",
    "id",
    "is_active",
    "is_ad_hoc",
    "kind",
    "public"."zeta_decrypt"("name") AS "name",
    "name_hmac",
    "public"."zeta_decrypt"("notes") AS "notes",
    "updated_at",
    "user_id"
   FROM "public"."destinatarios_enc";


ALTER VIEW "public"."destinatarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_ingest_addresses_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "address_key" "text" NOT NULL,
    "account_id" "uuid",
    "auto_import" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "allowed_sender" "bytea",
    "gmail_verification_url" "bytea",
    "gmail_verification_at" timestamp with time zone,
    "pdf_import_enabled" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."email_ingest_addresses_enc" OWNER TO "postgres";


COMMENT ON COLUMN "public"."email_ingest_addresses_enc"."allowed_sender" IS 'Optional personal email address allowed to forward bank notifications';



CREATE OR REPLACE VIEW "public"."email_ingest_addresses" WITH ("security_invoker"='true') AS
 SELECT "account_id",
    "address_key",
    "public"."zeta_decrypt"("allowed_sender") AS "allowed_sender",
    "auto_import",
    "created_at",
    "gmail_verification_at",
    "public"."zeta_decrypt"("gmail_verification_url") AS "gmail_verification_url",
    "id",
    "is_active",
    "pdf_import_enabled",
    "user_id"
   FROM "public"."email_ingest_addresses_enc";


ALTER VIEW "public"."email_ingest_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_ingest_allowed_senders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sender_email" "text" NOT NULL,
    "label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_ingest_allowed_senders_lowercase_email" CHECK (("sender_email" = "lower"("sender_email")))
);


ALTER TABLE "public"."email_ingest_allowed_senders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_ingest_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email_ingest_id" "uuid",
    "from_address" "text",
    "status" "text" NOT NULL,
    "raw_body" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_ingest_logs_status_check" CHECK (("status" = ANY (ARRAY['parsed'::"text", 'imported'::"text", 'queued'::"text", 'duplicate'::"text", 'parse_failed'::"text", 'sender_rejected'::"text", 'rate_limited'::"text", 'pdf_queued'::"text", 'pdf_parse_failed'::"text", 'pdf_imported'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."email_ingest_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_rate_cache" (
    "pair" "text" NOT NULL,
    "rate" numeric NOT NULL,
    "rates_30d" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "avg_30d" numeric,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."exchange_rate_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "amount" numeric(15,2),
    "currency_code" "text" DEFAULT 'COP'::"text",
    "due_date" "date",
    "is_completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."financial_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modo_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modo_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "destinatario_id" "uuid" NOT NULL,
    "share_value" numeric,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."modo_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modo_tx_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modo_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "modo_tx_reviews_decision_chk" CHECK (("decision" = ANY (ARRAY['included'::"text", 'excluded'::"text"]))),
    CONSTRAINT "modo_tx_reviews_source_chk" CHECK (("source" = ANY (ARRAY['auto'::"text", 'suggested'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."modo_tx_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "emoji" "text",
    "date_from" "date" NOT NULL,
    "date_to" "date" NOT NULL,
    "tag_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_shared" boolean DEFAULT false NOT NULL,
    "split_method" "text" DEFAULT 'equal'::"text" NOT NULL,
    "user_included" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "auto_tag_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "modos_split_method_chk" CHECK (("split_method" = ANY (ARRAY['equal'::"text", 'percent'::"text"])))
);


ALTER TABLE "public"."modos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pdf_passwords_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "alias" "bytea" NOT NULL,
    "password" "bytea" NOT NULL,
    "scope" "text" NOT NULL,
    "bank_key" "text",
    "account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pdf_passwords_enc_scope_check" CHECK (("scope" = ANY (ARRAY['global'::"text", 'bank'::"text", 'account'::"text"]))),
    CONSTRAINT "pdf_passwords_scope_pairing" CHECK (((("scope" = 'account'::"text") AND ("account_id" IS NOT NULL) AND ("bank_key" IS NULL)) OR (("scope" = 'bank'::"text") AND ("bank_key" IS NOT NULL) AND ("account_id" IS NULL)) OR (("scope" = 'global'::"text") AND ("account_id" IS NULL) AND ("bank_key" IS NULL))))
);


ALTER TABLE "public"."pdf_passwords_enc" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."pdf_passwords" WITH ("security_invoker"='true') AS
 SELECT "id",
    "user_id",
    "public"."zeta_decrypt"("alias") AS "alias",
    "public"."zeta_decrypt"("password") AS "password",
    "scope",
    "bank_key",
    "account_id",
    "created_at",
    "updated_at"
   FROM "public"."pdf_passwords_enc";


ALTER VIEW "public"."pdf_passwords" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_email_statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_ingest_id" "uuid" NOT NULL,
    "from_address" "text" NOT NULL,
    "subject" "text",
    "original_filename" "text",
    "storage_path" "text" NOT NULL,
    "file_size_bytes" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "parsed_data" "jsonb",
    "idempotency_hash" "text" NOT NULL,
    "parsed_at" timestamp with time zone,
    "imported_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pending_email_statements_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'parsing'::"text", 'parsed'::"text", 'needs_password'::"text", 'parse_failed'::"text", 'imported'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."pending_email_statements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_email_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_ingest_id" "uuid" NOT NULL,
    "raw_body" "text" NOT NULL,
    "parsed_data" "jsonb" NOT NULL,
    "suggested_account_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid",
    "tag_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "notes" "text",
    "conflict_transaction_id" "uuid",
    CONSTRAINT "pending_email_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'imported'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."pending_email_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personal_debt_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "personal_debt_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "personal_debt_allocations_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."personal_debt_allocations" OWNER TO "postgres";


COMMENT ON TABLE "public"."personal_debt_allocations" IS 'Reparto de un movimiento de abono entre varias deudas personales con la misma persona. transactions.personal_debt_id apunta a la primera (ancla); el monto por deuda vive aquí.';



CREATE TABLE IF NOT EXISTS "public"."transactions_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "currency_code" "public"."currency_code" NOT NULL,
    "direction" "public"."transaction_direction" NOT NULL,
    "exchange_rate" numeric(12,6) DEFAULT 1.000000 NOT NULL,
    "amount_in_base_currency" numeric(15,2),
    "transaction_date" "date" NOT NULL,
    "posting_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."transaction_status" DEFAULT 'POSTED'::"public"."transaction_status" NOT NULL,
    "raw_description" "bytea",
    "clean_description" "bytea",
    "merchant_name" "bytea",
    "merchant_logo_url" "text",
    "merchant_category_code" "text",
    "category_id" "uuid",
    "secondary_category_id" "uuid",
    "categorization_confidence" numeric(3,2),
    "categorization_source" "public"."categorization_source" DEFAULT 'USER_CREATED'::"public"."categorization_source" NOT NULL,
    "is_subscription" boolean DEFAULT false NOT NULL,
    "is_recurring" boolean DEFAULT false NOT NULL,
    "recurrence_group_id" "uuid",
    "notes" "bytea",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "provider" "public"."data_provider" DEFAULT 'MANUAL'::"public"."data_provider" NOT NULL,
    "provider_transaction_id" "text",
    "idempotency_key" "text" NOT NULL,
    "is_excluded" boolean DEFAULT false NOT NULL,
    "installment_current" smallint,
    "installment_total" smallint,
    "installment_group_id" "text",
    "capture_method" "public"."transaction_capture_method" DEFAULT 'MANUAL_FORM'::"public"."transaction_capture_method" NOT NULL,
    "capture_input_text" "bytea",
    "reconciled_into_transaction_id" "uuid",
    "reconciliation_score" numeric,
    "destinatario_id" "uuid",
    "original_amount" numeric,
    "merchant_name_hmac" "text",
    "clean_description_hmac" "text",
    "transfer_group_id" "uuid",
    "transaction_time" time without time zone,
    "location_id" "uuid",
    "title_locked" boolean DEFAULT false NOT NULL,
    "personal_debt_id" "uuid",
    "pd_role" "public"."pd_role",
    "split_group_id" "uuid",
    "split_repaid_amount" numeric,
    "flow_class" "text",
    "flow_class_override" "text",
    "flow_class_override_source" "text",
    "flow_class_version" smallint,
    "source_pattern" "text",
    "flow_class_effective" "text" GENERATED ALWAYS AS (COALESCE("flow_class_override", "flow_class", 'UNCLASSIFIED'::"text")) STORED,
    CONSTRAINT "chk_installment_range" CHECK (((("installment_current" IS NULL) AND ("installment_total" IS NULL)) OR (("installment_current" > 0) AND ("installment_total" > 0) AND ("installment_current" <= "installment_total")))),
    CONSTRAINT "transactions_enc_flow_class_check" CHECK ((("flow_class" IS NULL) OR ("flow_class" = ANY (ARRAY['INCOME'::"text", 'SPEND'::"text", 'DEBT_PAYMENT'::"text", 'DEBT_CREDIT'::"text", 'DEBT_DRAWDOWN'::"text", 'SELF_TRANSFER'::"text", 'CASH_WITHDRAWAL'::"text", 'BANK_FEE'::"text"])))),
    CONSTRAINT "transactions_enc_flow_class_override_check" CHECK ((("flow_class_override" IS NULL) OR ("flow_class_override" = ANY (ARRAY['INCOME'::"text", 'SPEND'::"text", 'DEBT_PAYMENT'::"text", 'DEBT_CREDIT'::"text", 'DEBT_DRAWDOWN'::"text", 'SELF_TRANSFER'::"text", 'CASH_WITHDRAWAL'::"text", 'BANK_FEE'::"text"])))),
    CONSTRAINT "transactions_enc_flow_class_override_provenance_check" CHECK ((("flow_class_override" IS NULL) OR ("flow_class_override_source" IS NOT NULL))),
    CONSTRAINT "transactions_enc_flow_class_override_source_check" CHECK ((("flow_class_override_source" IS NULL) OR ("flow_class_override_source" = ANY (ARRAY['USER'::"text", 'CATEGORY_SEED'::"text"])))),
    CONSTRAINT "transactions_enc_flow_class_version_check" CHECK ((("flow_class" IS NULL) OR ("flow_class_version" IS NOT NULL))),
    CONSTRAINT "transactions_positive_amount" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transactions_valid_confidence" CHECK ((("categorization_confidence" IS NULL) OR (("categorization_confidence" >= (0)::numeric) AND ("categorization_confidence" <= (1)::numeric)))),
    CONSTRAINT "transactions_valid_exchange_rate" CHECK (("exchange_rate" > (0)::numeric))
);


ALTER TABLE "public"."transactions_enc" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transactions_enc"."original_amount" IS 'Full purchase price for installment transactions. amount stores the monthly cuota.';



COMMENT ON COLUMN "public"."transactions_enc"."transaction_time" IS 'Optional time-of-day for the transaction. NULL when the source (e.g. PDF) does not carry it.';



COMMENT ON COLUMN "public"."transactions_enc"."location_id" IS 'Optional FK to the transaction_location captured at the time of this transaction. Set by the mobile app when the user has opted in to location tracking.';



COMMENT ON COLUMN "public"."transactions_enc"."title_locked" IS 'True when the user has manually edited the transaction title (merchant_name). Protects the title from being overwritten by destinatario auto-assign. Non-PII, plaintext.';



COMMENT ON COLUMN "public"."transactions_enc"."personal_debt_id" IS 'FK to personal_debts. Links this transaction to a personal debt as its origin disbursement or a repayment. Non-PII, plaintext.';



COMMENT ON COLUMN "public"."transactions_enc"."pd_role" IS 'origin = the inflow/outflow that created the debt (income/spend-excluded); repayment = normal cashflow toward the debt. Non-PII, plaintext.';



COMMENT ON COLUMN "public"."transactions_enc"."split_group_id" IS 'Groups the user-share leg + N lent-origin legs of one shared payment (Pago compartido). Non-PII, plaintext.';



COMMENT ON COLUMN "public"."transactions_enc"."split_repaid_amount" IS 'Total repaid so far by other participants of a shared payment (Pago compartido). Effective spend of this tx = amount - coalesce(split_repaid_amount, 0). NULL/0 for non-split transactions. Non-PII, plaintext.';



COMMENT ON COLUMN "public"."transactions_enc"."flow_class" IS 'Machine verdict from classifyFlow() / zeta_flow_class(). NULL = not yet classified. Never written by the user — a user correction goes to flow_class_override. Non-PII, plaintext.';



COMMENT ON COLUMN "public"."transactions_enc"."flow_class_override" IS 'Explicit correction. Wins over flow_class. Populated either by the user in the app or, once, by the category backfill — see flow_class_override_source.';



COMMENT ON COLUMN "public"."transactions_enc"."flow_class_override_source" IS 'Who wrote flow_class_override. USER = explicit correction in the app. CATEGORY_SEED = one-time backfill from the user''s Cuota crédito / Tarjeta de crédito category, a strong prior rather than an assertion — safe to clear once the classifier agrees on its own. Only USER may render as a user correction in the UI.';



COMMENT ON COLUMN "public"."transactions_enc"."flow_class_version" IS 'FLOW_CLASS_RULES_VERSION that produced flow_class, so a rules change can re-derive only the stale rows instead of the whole table.';



COMMENT ON COLUMN "public"."transactions_enc"."source_pattern" IS 'Raw parser signal: pattern_type from the Bancolombia email parser, or source_hint from the Python PDF parsers. NULL for every pre-existing row — the signal was discarded at import time.';



COMMENT ON COLUMN "public"."transactions_enc"."flow_class_effective" IS 'GENERATED: coalesce(flow_class_override, flow_class, ''UNCLASSIFIED''). The column every metrics query filters on. Never NULL. NOT WRITABLE — absent from both INSTEAD OF trigger column lists.';



CREATE OR REPLACE VIEW "public"."personal_debt_repayment_amounts" WITH ("security_invoker"='true') AS
 SELECT "t"."user_id",
    "t"."personal_debt_id",
    "t"."id" AS "transaction_id",
    "t"."amount"
   FROM "public"."transactions_enc" "t"
  WHERE (("t"."pd_role" = 'repayment'::"public"."pd_role") AND ("t"."personal_debt_id" IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."personal_debt_allocations" "a"
          WHERE ("a"."transaction_id" = "t"."id")))))
UNION ALL
 SELECT "a"."user_id",
    "a"."personal_debt_id",
    "a"."transaction_id",
    "a"."amount"
   FROM ("public"."personal_debt_allocations" "a"
     JOIN "public"."transactions_enc" "t" ON ((("t"."id" = "a"."transaction_id") AND ("t"."pd_role" = 'repayment'::"public"."pd_role") AND ("t"."personal_debt_id" IS NOT NULL))));


ALTER VIEW "public"."personal_debt_repayment_amounts" OWNER TO "postgres";


COMMENT ON VIEW "public"."personal_debt_repayment_amounts" IS 'Cuánto abona cada movimiento a cada deuda personal: el monto completo si no tiene reparto, o su parte en personal_debt_allocations.';



CREATE TABLE IF NOT EXISTS "public"."personal_debts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "destinatario_id" "uuid" NOT NULL,
    "direction" "public"."personal_debt_direction" NOT NULL,
    "principal_amount" numeric NOT NULL,
    "currency_code" "text" DEFAULT 'COP'::"text" NOT NULL,
    "outstanding_amount" numeric NOT NULL,
    "opened_on" "date" NOT NULL,
    "due_date" "date",
    "status" "public"."personal_debt_status" DEFAULT 'active'::"public"."personal_debt_status" NOT NULL,
    "origin_transaction_id" "uuid",
    "notes" "text",
    "is_demo" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "split_group_id" "uuid",
    "installment_group_id" "text",
    "installment_total" smallint,
    "group_total_amount" numeric(14,2),
    "interest_amount" numeric(14,2),
    "is_general" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."personal_debts" OWNER TO "postgres";


COMMENT ON TABLE "public"."personal_debts" IS 'Person-to-person lend/borrow tracker. Destinatario-anchored (kind=person). outstanding_amount is maintained = principal - sum(linked repayments). Plain table; identity protected via destinatarios_enc FK.';



COMMENT ON COLUMN "public"."personal_debts"."split_group_id" IS 'Groups the N personal_debts (direction=lent) created from one shared payment (Pago compartido). NULL for standalone debts.';



COMMENT ON COLUMN "public"."personal_debts"."installment_group_id" IS 'transactions.installment_group_id de la compra a cuotas de la que salió esta deuda (compra completa cobrada una vez). NULL en repartos normales.';



COMMENT ON COLUMN "public"."personal_debts"."installment_total" IS 'Número de cuotas de la compra. Cuota sugerida para la persona = principal_amount / installment_total.';



COMMENT ON COLUMN "public"."personal_debts"."group_total_amount" IS 'Monto total sobre el que se repartió (precio + interés estimado). Igual en todas las deudas del grupo. NULL → usar el monto de la transacción origen.';



COMMENT ON COLUMN "public"."personal_debts"."interest_amount" IS 'Parte estimada de interés dentro de principal_amount (anualidad francesa con la tasa EA del extracto).';



COMMENT ON COLUMN "public"."personal_debts"."is_general" IS 'Deuda general con la persona: acumula préstamos sueltos vinculados "a la persona en general". Una viva por persona, dirección y moneda.';



CREATE TABLE IF NOT EXISTS "public"."planning_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "income_entry_id" "uuid" NOT NULL,
    "expense_entry_id" "uuid" NOT NULL,
    "assigned_amount" numeric(15,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planning_assignments_assigned_amount_check" CHECK (("assigned_amount" > (0)::numeric))
);


ALTER TABLE "public"."planning_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "entry_type" "public"."planning_entry_type" NOT NULL,
    "label" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "expected_date" "date" NOT NULL,
    "status" "public"."planning_entry_status" DEFAULT 'PLANNED'::"public"."planning_entry_status" NOT NULL,
    "completed_at" timestamp with time zone,
    "recurring_template_id" "uuid",
    "account_id" "uuid",
    "category_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "currency_code" "public"."currency_code" DEFAULT 'COP'::"public"."currency_code" NOT NULL,
    "occurrence_id" "uuid",
    CONSTRAINT "planning_entries_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."planning_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "preset" "public"."planning_period_preset" DEFAULT 'MONTHLY'::"public"."planning_period_preset" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "currency_code" "public"."currency_code" DEFAULT 'COP'::"public"."currency_code" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."planning_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles_enc" (
    "id" "uuid" NOT NULL,
    "email" "bytea" NOT NULL,
    "full_name" "bytea",
    "avatar_url" "text",
    "preferred_currency" "public"."currency_code" DEFAULT 'COP'::"public"."currency_code" NOT NULL,
    "locale" "text" DEFAULT 'es-CO'::"text" NOT NULL,
    "timezone" "text" DEFAULT 'America/Bogota'::"text" NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "app_purpose" "text",
    "estimated_monthly_income" numeric,
    "estimated_monthly_expenses" numeric,
    "monthly_salary" integer,
    "dashboard_config" "jsonb",
    "budget_mode" "text",
    "demo_mode" boolean DEFAULT false NOT NULL,
    "mobile_dashboard_config" "jsonb",
    "nav_focus" "public"."nav_focus" DEFAULT 'PLAN'::"public"."nav_focus" NOT NULL,
    "location_tracking_enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_budget_mode_check" CHECK (("budget_mode" = ANY (ARRAY['per_category'::"text", 'zero_based'::"text"])))
);


ALTER TABLE "public"."profiles_enc" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles_enc" IS 'User profiles extending Supabase Auth. Created automatically via trigger on auth.users insert.';



COMMENT ON COLUMN "public"."profiles_enc"."dashboard_config" IS 'Purpose-driven dashboard configuration: tabs, widgets, purpose. Set during onboarding.';



COMMENT ON COLUMN "public"."profiles_enc"."demo_mode" IS 'When true, dashboard shows demo data instead of real data';



COMMENT ON COLUMN "public"."profiles_enc"."mobile_dashboard_config" IS 'Mobile-only widget layout config (per-user dashboard composition). Not read by webapp.';



COMMENT ON COLUMN "public"."profiles_enc"."nav_focus" IS 'Primary navigation focus for the user (PLAN vs DEBT). Drives surfacing of plan/debt-centric tabs.';



COMMENT ON COLUMN "public"."profiles_enc"."location_tracking_enabled" IS 'Opt-in flag: when TRUE, the mobile app records background location pings and links the nearest one to each new transaction.';



CREATE OR REPLACE VIEW "public"."profiles" WITH ("security_invoker"='true') AS
 SELECT "app_purpose",
    "avatar_url",
    "budget_mode",
    "created_at",
    "dashboard_config",
    "mobile_dashboard_config",
    "demo_mode",
    "public"."zeta_decrypt"("email") AS "email",
    "estimated_monthly_expenses",
    "estimated_monthly_income",
    "public"."zeta_decrypt"("full_name") AS "full_name",
    "id",
    "locale",
    "location_tracking_enabled",
    "monthly_salary",
    "nav_focus",
    "onboarding_completed",
    "preferred_currency",
    "timezone",
    "updated_at"
   FROM "public"."profiles_enc";


ALTER VIEW "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_occurrences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "occurrence_date" "date" NOT NULL,
    "expected_amount" numeric(15,2) NOT NULL,
    "status" "public"."occurrence_status" DEFAULT 'pending'::"public"."occurrence_status" NOT NULL,
    "transaction_id" "uuid",
    "skipped_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linked_manually" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."recurring_occurrences" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recurring_occurrences"."linked_manually" IS 'true when user manually linked a pre-existing transaction; false when system-created via recordRecurringOccurrencePayment or auto-linked via linkTransactionToOccurrence';



CREATE TABLE IF NOT EXISTS "public"."recurring_template_tags" (
    "recurring_template_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recurring_template_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_transaction_templates_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "amount" numeric(15,2) NOT NULL,
    "currency_code" "public"."currency_code" DEFAULT 'COP'::"public"."currency_code" NOT NULL,
    "direction" "public"."transaction_direction" NOT NULL,
    "merchant_name" "bytea",
    "description" "bytea",
    "frequency" "public"."recurrence_frequency" NOT NULL,
    "day_of_month" integer,
    "day_of_week" integer,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "transfer_source_account_id" "uuid",
    "sub_payments" "jsonb",
    "destinatario_id" "uuid",
    CONSTRAINT "recurring_transaction_templates_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "recurring_transaction_templates_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 31))),
    CONSTRAINT "recurring_transaction_templates_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."recurring_transaction_templates_enc" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."recurring_transaction_templates" WITH ("security_invoker"='true') AS
 SELECT "account_id",
    "amount",
    "category_id",
    "created_at",
    "currency_code",
    "day_of_month",
    "day_of_week",
    "public"."zeta_decrypt"("description") AS "description",
    "destinatario_id",
    "direction",
    "end_date",
    "frequency",
    "id",
    "is_active",
    "public"."zeta_decrypt"("merchant_name") AS "merchant_name",
    "start_date",
    "sub_payments",
    "transfer_source_account_id",
    "updated_at",
    "user_id"
   FROM "public"."recurring_transaction_templates_enc";


ALTER VIEW "public"."recurring_transaction_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statement_snapshots_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "period_from" "date",
    "period_to" "date",
    "previous_balance" numeric(15,2),
    "total_credits" numeric(15,2),
    "total_debits" numeric(15,2),
    "final_balance" numeric(15,2),
    "purchases_and_charges" numeric(15,2),
    "interest_charged" numeric(15,2),
    "credit_limit" numeric(15,2),
    "available_credit" numeric(15,2),
    "interest_rate" numeric(6,4),
    "late_interest_rate" numeric(6,4),
    "total_payment_due" numeric(15,2),
    "minimum_payment" numeric(15,2),
    "payment_due_date" "date",
    "transaction_count" integer DEFAULT 0 NOT NULL,
    "imported_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "currency_code" "text" DEFAULT 'COP'::"text" NOT NULL,
    "source_filename" "bytea",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "remaining_balance" numeric,
    "initial_amount" numeric,
    "installments_in_default" integer,
    "loan_number" "bytea",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."statement_snapshots_enc" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."statement_snapshots" WITH ("security_invoker"='true') AS
 SELECT "account_id",
    "available_credit",
    "created_at",
    "credit_limit",
    "currency_code",
    "final_balance",
    "id",
    "imported_count",
    "initial_amount",
    "installments_in_default",
    "interest_charged",
    "interest_rate",
    "late_interest_rate",
    "public"."zeta_decrypt"("loan_number") AS "loan_number",
    "minimum_payment",
    "payment_due_date",
    "period_from",
    "period_to",
    "previous_balance",
    "purchases_and_charges",
    "remaining_balance",
    "skipped_count",
    "public"."zeta_decrypt"("source_filename") AS "source_filename",
    "total_credits",
    "total_debits",
    "total_payment_due",
    "transaction_count",
    "updated_at",
    "user_id"
   FROM "public"."statement_snapshots_enc";


ALTER VIEW "public"."statement_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statement_tray_dismissals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."statement_tray_dismissals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "destinatario_id" "uuid" NOT NULL,
    "recurring_template_id" "uuid",
    "status" "public"."subscription_status" DEFAULT 'active'::"public"."subscription_status" NOT NULL,
    "estimated_amount" numeric,
    "currency_code" "text" DEFAULT 'COP'::"text" NOT NULL,
    "trial_ends_on" "date",
    "cancel_url" "text",
    "detected_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscriptions" IS 'One LIVE subscription per destinatario (cancelled/dismissed kept as history). Plain table — destinatario_id (the identifying field) is protected via the encrypted destinatarios_enc FK. Synced to mobile via this name directly (no _enc/view).';



CREATE TABLE IF NOT EXISTS "public"."tag_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "color" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tag_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "group_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "color" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_locations_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "latitude" "bytea" NOT NULL,
    "longitude" "bytea" NOT NULL,
    "place_name" "bytea",
    "place_locality" "bytea",
    "accuracy_m" real,
    "place_country" "text",
    "captured_at" timestamp with time zone NOT NULL,
    "linked_transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transaction_locations_enc" OWNER TO "postgres";


COMMENT ON TABLE "public"."transaction_locations_enc" IS 'Approximate location captured by the mobile app and linked to a transaction. Lat/lng and place strings are encrypted (zeta_encrypt). Country and accuracy are plaintext.';



CREATE OR REPLACE VIEW "public"."transaction_locations" WITH ("security_invoker"='true') AS
 SELECT "id",
    "user_id",
    ("public"."zeta_decrypt"("latitude"))::double precision AS "latitude",
    ("public"."zeta_decrypt"("longitude"))::double precision AS "longitude",
    "accuracy_m",
    "public"."zeta_decrypt"("place_name") AS "place_name",
    "public"."zeta_decrypt"("place_locality") AS "place_locality",
    "place_country",
    "captured_at",
    "linked_transaction_id",
    "created_at",
    "updated_at"
   FROM "public"."transaction_locations_enc";


ALTER VIEW "public"."transaction_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_tags" (
    "transaction_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."transaction_tags" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."transactions" WITH ("security_invoker"='true') AS
 SELECT "account_id",
    "amount",
    "amount_in_base_currency",
    "public"."zeta_decrypt"("capture_input_text") AS "capture_input_text",
    "capture_method",
    "categorization_confidence",
    "categorization_source",
    "category_id",
    "public"."zeta_decrypt"("clean_description") AS "clean_description",
    "clean_description_hmac",
    "created_at",
    "currency_code",
    "destinatario_id",
    "direction",
    "exchange_rate",
    "id",
    "idempotency_key",
    "installment_current",
    "installment_group_id",
    "installment_total",
    "is_excluded",
    "is_recurring",
    "is_subscription",
    "location_id",
    "merchant_category_code",
    "merchant_logo_url",
    "public"."zeta_decrypt"("merchant_name") AS "merchant_name",
    "merchant_name_hmac",
    "public"."zeta_decrypt"("notes") AS "notes",
    "original_amount",
    "posting_date",
    "provider",
    "provider_transaction_id",
    "public"."zeta_decrypt"("raw_description") AS "raw_description",
    "reconciled_into_transaction_id",
    "reconciliation_score",
    "recurrence_group_id",
    "secondary_category_id",
    "status",
    "tags",
    "title_locked",
    "transaction_date",
    "transaction_time",
    "transfer_group_id",
    "personal_debt_id",
    "pd_role",
    "split_group_id",
    "split_repaid_amount",
    "flow_class",
    "flow_class_override",
    "flow_class_override_source",
    "flow_class_version",
    "source_pattern",
    "flow_class_effective",
    "updated_at",
    "user_id"
   FROM "public"."transactions_enc";


ALTER VIEW "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unrecognized_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_ingest_id" "uuid",
    "from_address" "text" NOT NULL,
    "subject" "text",
    "text_body" "text",
    "html_body" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "unrecognized_emails_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."unrecognized_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_encryption_keys" (
    "user_id" "uuid" NOT NULL,
    "encrypted_dek" "bytea" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_encryption_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlist_items_enc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "bytea" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "currency_code" "text" DEFAULT 'COP'::"text" NOT NULL,
    "url" "bytea",
    "image_url" "text",
    "status" "text" DEFAULT 'wishlist'::"text" NOT NULL,
    "why" "bytea",
    "urgency" "text",
    "desire_type" "text",
    "category_id" "uuid",
    "funding_type" "text",
    "installments" integer,
    "account_id" "uuid",
    "enriched" boolean DEFAULT false NOT NULL,
    "enriched_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "bought_at" timestamp with time zone,
    "transaction_id" "uuid",
    "last_scored_at" timestamp with time zone,
    "last_score" integer,
    "last_verdict" "text",
    "last_nudge_dismissed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wishlist_items_desire_type_check" CHECK (("desire_type" = ANY (ARRAY['long_held'::"text", 'recent'::"text", 'spontaneous'::"text"]))),
    CONSTRAINT "wishlist_items_funding_type_check" CHECK (("funding_type" = ANY (ARRAY['ONE_TIME'::"text", 'INSTALLMENTS'::"text"]))),
    CONSTRAINT "wishlist_items_installments_check" CHECK ((("installments" IS NULL) OR (("installments" >= 2) AND ("installments" <= 36)))),
    CONSTRAINT "wishlist_items_last_score_check" CHECK ((("last_score" IS NULL) OR (("last_score" >= 0) AND ("last_score" <= 100)))),
    CONSTRAINT "wishlist_items_last_verdict_check" CHECK (("last_verdict" = ANY (ARRAY['BUY'::"text", 'BUY_WITH_CAUTION'::"text", 'WAIT'::"text", 'NOT_RECOMMENDED'::"text"]))),
    CONSTRAINT "wishlist_items_status_check" CHECK (("status" = ANY (ARRAY['wishlist'::"text", 'bought'::"text", 'reflected'::"text", 'archived'::"text"]))),
    CONSTRAINT "wishlist_items_urgency_check" CHECK (("urgency" = ANY (ARRAY['NECESSARY'::"text", 'USEFUL'::"text", 'IMPULSE'::"text"])))
);


ALTER TABLE "public"."wishlist_items_enc" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wishlist_items" WITH ("security_invoker"='true') AS
 SELECT "account_id",
    "amount",
    "bought_at",
    "category_id",
    "created_at",
    "currency_code",
    "desire_type",
    "enriched",
    "enriched_at",
    "funding_type",
    "id",
    "image_url",
    "installments",
    "last_nudge_dismissed_at",
    "last_score",
    "last_scored_at",
    "last_verdict",
    "public"."zeta_decrypt"("name") AS "name",
    "ready_at",
    "status",
    "transaction_id",
    "updated_at",
    "urgency",
    "public"."zeta_decrypt"("url") AS "url",
    "user_id",
    "public"."zeta_decrypt"("why") AS "why"
   FROM "public"."wishlist_items_enc";


ALTER VIEW "public"."wishlist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlist_reflections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wishlist_item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "worth_it" boolean NOT NULL,
    "rating" integer NOT NULL,
    "note" "text",
    "reflection_stage" "text" NOT NULL,
    "days_since_purchase" integer NOT NULL,
    "reflected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wishlist_reflections_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "wishlist_reflections_reflection_stage_check" CHECK (("reflection_stage" = ANY (ARRAY['14_day'::"text", '60_day'::"text"])))
);


ALTER TABLE "public"."wishlist_reflections" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."zeta_flow_class_health" AS
 SELECT "user_id",
    "count"(*) FILTER (WHERE ("flow_class" IS NULL)) AS "unclassified_rows",
    "count"(*) FILTER (WHERE (("flow_class_version" IS NULL) AND ("flow_class" IS NOT NULL))) AS "hand_set_rows",
    "count"(*) FILTER (WHERE (("flow_class_version" IS NOT NULL) AND ("flow_class_version" < 2))) AS "stale_version_rows",
    "count"(*) AS "total_rows"
   FROM "public"."transactions_enc" "t"
  WHERE ((COALESCE("is_excluded", false) = false) AND ("reconciled_into_transaction_id" IS NULL))
  GROUP BY "user_id";


ALTER VIEW "public"."zeta_flow_class_health" OWNER TO "postgres";


COMMENT ON VIEW "public"."zeta_flow_class_health" IS 'Rows still unclassified, hand-set, or on a stale rules version. unclassified_rows > 0 means a write path is not calling classifyFlow().';



ALTER TABLE ONLY "public"."accounts_enc"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_config"
    ADD CONSTRAINT "admin_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_scenarios"
    ADD CONSTRAINT "budget_scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_category_id_period_key" UNIQUE ("user_id", "category_id", "period");



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capture_tokens_enc"
    ADD CONSTRAINT "capture_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capture_tokens_enc"
    ADD CONSTRAINT "capture_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_rules"
    ADD CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_rules"
    ADD CONSTRAINT "category_rules_user_id_pattern_key" UNIQUE ("user_id", "pattern");



ALTER TABLE ONLY "public"."category_tags"
    ADD CONSTRAINT "category_tags_pkey" PRIMARY KEY ("category_id", "tag_id");



ALTER TABLE ONLY "public"."debt_scenarios"
    ADD CONSTRAINT "debt_scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_reviews"
    ADD CONSTRAINT "design_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destinatario_rules"
    ADD CONSTRAINT "destinatario_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destinatario_tags"
    ADD CONSTRAINT "destinatario_tags_pkey" PRIMARY KEY ("destinatario_id", "tag_id");



ALTER TABLE ONLY "public"."destinatarios_enc"
    ADD CONSTRAINT "destinatarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_ingest_addresses_enc"
    ADD CONSTRAINT "email_ingest_addresses_address_key_key" UNIQUE ("address_key");



ALTER TABLE ONLY "public"."email_ingest_addresses_enc"
    ADD CONSTRAINT "email_ingest_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_ingest_addresses_enc"
    ADD CONSTRAINT "email_ingest_addresses_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."email_ingest_allowed_senders"
    ADD CONSTRAINT "email_ingest_allowed_senders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_ingest_allowed_senders"
    ADD CONSTRAINT "email_ingest_allowed_senders_user_id_sender_email_key" UNIQUE ("user_id", "sender_email");



ALTER TABLE ONLY "public"."email_ingest_logs"
    ADD CONSTRAINT "email_ingest_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rate_cache"
    ADD CONSTRAINT "exchange_rate_cache_pkey" PRIMARY KEY ("pair");



ALTER TABLE ONLY "public"."financial_reminders"
    ADD CONSTRAINT "financial_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modo_participants"
    ADD CONSTRAINT "modo_participants_modo_id_destinatario_id_key" UNIQUE ("modo_id", "destinatario_id");



ALTER TABLE ONLY "public"."modo_participants"
    ADD CONSTRAINT "modo_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modo_tx_reviews"
    ADD CONSTRAINT "modo_tx_reviews_modo_id_transaction_id_key" UNIQUE ("modo_id", "transaction_id");



ALTER TABLE ONLY "public"."modo_tx_reviews"
    ADD CONSTRAINT "modo_tx_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modos"
    ADD CONSTRAINT "modos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pdf_passwords_enc"
    ADD CONSTRAINT "pdf_passwords_enc_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_email_statements"
    ADD CONSTRAINT "pending_email_statements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_email_transactions"
    ADD CONSTRAINT "pending_email_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_debt_allocations"
    ADD CONSTRAINT "personal_debt_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_debts"
    ADD CONSTRAINT "personal_debts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_assignments"
    ADD CONSTRAINT "planning_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_entries"
    ADD CONSTRAINT "planning_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_periods"
    ADD CONSTRAINT "planning_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_events"
    ADD CONSTRAINT "product_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles_enc"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_occurrences"
    ADD CONSTRAINT "recurring_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_occurrences"
    ADD CONSTRAINT "recurring_occurrences_template_id_occurrence_date_key" UNIQUE ("template_id", "occurrence_date");



ALTER TABLE ONLY "public"."recurring_template_tags"
    ADD CONSTRAINT "recurring_template_tags_pkey" PRIMARY KEY ("recurring_template_id", "tag_id");



ALTER TABLE ONLY "public"."recurring_transaction_templates_enc"
    ADD CONSTRAINT "recurring_transaction_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statement_snapshots_enc"
    ADD CONSTRAINT "statement_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statement_tray_dismissals"
    ADD CONSTRAINT "statement_tray_dismissals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statement_tray_dismissals"
    ADD CONSTRAINT "statement_tray_dismissals_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tag_groups"
    ADD CONSTRAINT "tag_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_locations_enc"
    ADD CONSTRAINT "transaction_locations_enc_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_tags"
    ADD CONSTRAINT "transaction_tags_pkey" PRIMARY KEY ("transaction_id", "tag_id");



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_assignments"
    ADD CONSTRAINT "unique_assignment" UNIQUE ("income_entry_id", "expense_entry_id");



ALTER TABLE ONLY "public"."unrecognized_emails"
    ADD CONSTRAINT "unrecognized_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_debt_allocations"
    ADD CONSTRAINT "uq_personal_debt_allocations_tx_debt" UNIQUE ("transaction_id", "personal_debt_id");



ALTER TABLE ONLY "public"."user_encryption_keys"
    ADD CONSTRAINT "user_encryption_keys_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wishlist_items_enc"
    ADD CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlist_reflections"
    ADD CONSTRAINT "wishlist_reflections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlist_reflections"
    ADD CONSTRAINT "wishlist_reflections_wishlist_item_id_reflection_stage_key" UNIQUE ("wishlist_item_id", "reflection_stage");



CREATE UNIQUE INDEX "accounts_provider_unique" ON "public"."accounts_enc" USING "btree" ("user_id", "provider", "provider_account_id_hmac") WHERE ("provider_account_id_hmac" IS NOT NULL);



CREATE UNIQUE INDEX "categories_user_slug_unique" ON "public"."categories" USING "btree" (COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "slug", COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "idx_accounts_is_demo" ON "public"."accounts_enc" USING "btree" ("user_id", "is_demo") WHERE ("is_active" = true);



CREATE INDEX "idx_accounts_mask_hmac" ON "public"."accounts_enc" USING "btree" ("user_id", "mask_hmac");



CREATE INDEX "idx_accounts_user_active" ON "public"."accounts_enc" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_accounts_user_id" ON "public"."accounts_enc" USING "btree" ("user_id");



CREATE INDEX "idx_budget_scenarios_user_updated" ON "public"."budget_scenarios" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_budgets_is_demo" ON "public"."budgets" USING "btree" ("user_id", "is_demo");



CREATE INDEX "idx_budgets_user_period" ON "public"."budgets" USING "btree" ("user_id", "period");



CREATE INDEX "idx_bug_reports_status" ON "public"."bug_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_bug_reports_user_created" ON "public"."bug_reports" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_capture_tokens_hash" ON "public"."capture_tokens_enc" USING "btree" ("token_hash");



CREATE INDEX "idx_capture_tokens_user_id" ON "public"."capture_tokens_enc" USING "btree" ("user_id");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_system" ON "public"."categories" USING "btree" ("is_system") WHERE ("is_system" = true);



CREATE INDEX "idx_categories_user_active" ON "public"."categories" USING "btree" ("user_id", "is_active") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_categories_user_id" ON "public"."categories" USING "btree" ("user_id");



CREATE INDEX "idx_category_rules_user_id" ON "public"."category_rules" USING "btree" ("user_id");



CREATE INDEX "idx_category_tags_tag_id" ON "public"."category_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_debt_scenarios_user" ON "public"."debt_scenarios" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_design_reviews_status" ON "public"."design_reviews" USING "btree" ("user_id", "status") WHERE ("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text"]));



CREATE INDEX "idx_destinatario_rules_destinatario" ON "public"."destinatario_rules" USING "btree" ("destinatario_id");



CREATE UNIQUE INDEX "idx_destinatario_rules_user_pattern" ON "public"."destinatario_rules" USING "btree" ("user_id", "lower"("pattern"));



CREATE INDEX "idx_destinatario_tags_tag_id" ON "public"."destinatario_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_destinatarios_name_hmac" ON "public"."destinatarios_enc" USING "btree" ("user_id", "name_hmac");



CREATE INDEX "idx_destinatarios_user_id" ON "public"."destinatarios_enc" USING "btree" ("user_id");



CREATE INDEX "idx_email_ingest_logs_user_created" ON "public"."email_ingest_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_financial_reminders_user_pending" ON "public"."financial_reminders" USING "btree" ("user_id", "is_completed", "due_date") WHERE (NOT "is_completed");



CREATE INDEX "idx_pdf_passwords_enc_user" ON "public"."pdf_passwords_enc" USING "btree" ("user_id");



CREATE INDEX "idx_pdf_passwords_enc_user_account" ON "public"."pdf_passwords_enc" USING "btree" ("user_id", "account_id") WHERE ("account_id" IS NOT NULL);



CREATE INDEX "idx_pdf_passwords_enc_user_bank" ON "public"."pdf_passwords_enc" USING "btree" ("user_id", "bank_key") WHERE ("bank_key" IS NOT NULL);



CREATE INDEX "idx_pdf_passwords_enc_user_scope" ON "public"."pdf_passwords_enc" USING "btree" ("user_id", "scope");



CREATE UNIQUE INDEX "idx_pending_email_stmt_idempotency" ON "public"."pending_email_statements" USING "btree" ("user_id", "idempotency_hash") WHERE ("status" <> 'dismissed'::"text");



CREATE INDEX "idx_pending_email_stmt_user_status" ON "public"."pending_email_statements" USING "btree" ("user_id", "status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'parsing'::"text", 'parsed'::"text", 'needs_password'::"text"]));



CREATE UNIQUE INDEX "idx_pending_email_tx_unique_pending_key" ON "public"."pending_email_transactions" USING "btree" ("user_id", "idempotency_key") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_pending_email_tx_user_status" ON "public"."pending_email_transactions" USING "btree" ("user_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_personal_debt_allocations_debt" ON "public"."personal_debt_allocations" USING "btree" ("personal_debt_id");



CREATE INDEX "idx_personal_debt_allocations_user_id" ON "public"."personal_debt_allocations" USING "btree" ("user_id");



CREATE INDEX "idx_personal_debts_destinatario_id" ON "public"."personal_debts" USING "btree" ("destinatario_id");



CREATE INDEX "idx_personal_debts_installment_group" ON "public"."personal_debts" USING "btree" ("user_id", "installment_group_id") WHERE ("installment_group_id" IS NOT NULL);



CREATE INDEX "idx_personal_debts_origin_transaction_id" ON "public"."personal_debts" USING "btree" ("origin_transaction_id") WHERE ("origin_transaction_id" IS NOT NULL);



CREATE INDEX "idx_personal_debts_split_group_id" ON "public"."personal_debts" USING "btree" ("split_group_id") WHERE ("split_group_id" IS NOT NULL);



CREATE INDEX "idx_personal_debts_status" ON "public"."personal_debts" USING "btree" ("status");



CREATE INDEX "idx_personal_debts_user_id" ON "public"."personal_debts" USING "btree" ("user_id");



CREATE INDEX "idx_planning_assignments_expense" ON "public"."planning_assignments" USING "btree" ("expense_entry_id");



CREATE INDEX "idx_planning_assignments_income" ON "public"."planning_assignments" USING "btree" ("income_entry_id");



CREATE INDEX "idx_planning_entries_period" ON "public"."planning_entries" USING "btree" ("period_id", "entry_type", "expected_date");



CREATE INDEX "idx_planning_periods_user_active" ON "public"."planning_periods" USING "btree" ("user_id", "is_active", "start_date" DESC);



CREATE INDEX "idx_product_events_flow_time" ON "public"."product_events" USING "btree" ("flow", "event_time" DESC);



CREATE INDEX "idx_product_events_metadata_gin" ON "public"."product_events" USING "gin" ("metadata");



CREATE INDEX "idx_product_events_name_time" ON "public"."product_events" USING "btree" ("event_name", "event_time" DESC);



CREATE INDEX "idx_product_events_user_time" ON "public"."product_events" USING "btree" ("user_id", "event_time" DESC);



CREATE INDEX "idx_recurring_occurrences_template" ON "public"."recurring_occurrences" USING "btree" ("template_id", "occurrence_date");



CREATE INDEX "idx_recurring_occurrences_transaction" ON "public"."recurring_occurrences" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "idx_recurring_occurrences_user_pending_date" ON "public"."recurring_occurrences" USING "btree" ("user_id", "occurrence_date") WHERE ("status" = 'pending'::"public"."occurrence_status");



CREATE INDEX "idx_recurring_occurrences_user_status" ON "public"."recurring_occurrences" USING "btree" ("user_id", "status") WHERE ("status" = 'pending'::"public"."occurrence_status");



CREATE INDEX "idx_recurring_template_tags_tag_id" ON "public"."recurring_template_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_recurring_template_tags_user_id" ON "public"."recurring_template_tags" USING "btree" ("user_id");



CREATE INDEX "idx_recurring_templates_destinatario_id" ON "public"."recurring_transaction_templates_enc" USING "btree" ("destinatario_id") WHERE ("destinatario_id" IS NOT NULL);



CREATE INDEX "idx_recurring_templates_transfer_source" ON "public"."recurring_transaction_templates_enc" USING "btree" ("transfer_source_account_id");



CREATE INDEX "idx_statement_snapshots_account_period" ON "public"."statement_snapshots_enc" USING "btree" ("account_id", "period_to" DESC);



CREATE INDEX "idx_statement_snapshots_enc_user_created" ON "public"."statement_snapshots_enc" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_statement_snapshots_enc_user_period" ON "public"."statement_snapshots_enc" USING "btree" ("user_id", "period_to" DESC NULLS LAST);



CREATE UNIQUE INDEX "idx_statement_snapshots_unique_period" ON "public"."statement_snapshots_enc" USING "btree" ("account_id", "currency_code", COALESCE("period_from", '1970-01-01'::"date"), COALESCE("period_to", '1970-01-01'::"date"));



CREATE INDEX "idx_subscriptions_destinatario_id" ON "public"."subscriptions" USING "btree" ("destinatario_id");



CREATE INDEX "idx_subscriptions_recurring_template_id" ON "public"."subscriptions" USING "btree" ("recurring_template_id") WHERE ("recurring_template_id" IS NOT NULL);



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_tag_groups_user_id" ON "public"."tag_groups" USING "btree" ("user_id");



CREATE INDEX "idx_tags_group_id" ON "public"."tags" USING "btree" ("group_id");



CREATE INDEX "idx_tags_user_id" ON "public"."tags" USING "btree" ("user_id");



CREATE INDEX "idx_transaction_tags_tag_id" ON "public"."transaction_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_transaction_tags_transaction_id" ON "public"."transaction_tags" USING "btree" ("transaction_id");



CREATE INDEX "idx_transaction_tags_user_id" ON "public"."transaction_tags" USING "btree" ("user_id");



CREATE INDEX "idx_transactions_account_id" ON "public"."transactions_enc" USING "btree" ("account_id");



CREATE INDEX "idx_transactions_capture_method" ON "public"."transactions_enc" USING "btree" ("user_id", "capture_method", "transaction_date");



CREATE INDEX "idx_transactions_category_id" ON "public"."transactions_enc" USING "btree" ("category_id");



CREATE INDEX "idx_transactions_category_user" ON "public"."transactions_enc" USING "btree" ("category_id", "user_id") WHERE ("reconciled_into_transaction_id" IS NULL);



CREATE INDEX "idx_transactions_date" ON "public"."transactions_enc" USING "btree" ("user_id", "transaction_date" DESC);



CREATE INDEX "idx_transactions_description_hmac" ON "public"."transactions_enc" USING "btree" ("user_id", "clean_description_hmac");



CREATE INDEX "idx_transactions_destinatario" ON "public"."transactions_enc" USING "btree" ("destinatario_id") WHERE ("destinatario_id" IS NOT NULL);



CREATE INDEX "idx_transactions_enc_location" ON "public"."transactions_enc" USING "btree" ("user_id", "location_id") WHERE ("location_id" IS NOT NULL);



CREATE INDEX "idx_transactions_enc_user_date_time" ON "public"."transactions_enc" USING "btree" ("user_id", "transaction_date" DESC, "transaction_time" DESC NULLS LAST);



CREATE INDEX "idx_transactions_enc_user_flow_date" ON "public"."transactions_enc" USING "btree" ("user_id", "flow_class_effective", "transaction_date" DESC);



CREATE INDEX "idx_transactions_installment_group" ON "public"."transactions_enc" USING "btree" ("installment_group_id", "user_id") WHERE ("installment_group_id" IS NOT NULL);



CREATE INDEX "idx_transactions_is_excluded" ON "public"."transactions_enc" USING "btree" ("is_excluded") WHERE ("is_excluded" = true);



CREATE INDEX "idx_transactions_merchant_hmac" ON "public"."transactions_enc" USING "btree" ("user_id", "merchant_name_hmac");



CREATE INDEX "idx_transactions_personal_debt" ON "public"."transactions_enc" USING "btree" ("personal_debt_id") WHERE ("personal_debt_id" IS NOT NULL);



CREATE INDEX "idx_transactions_reconciled_into" ON "public"."transactions_enc" USING "btree" ("user_id", "reconciled_into_transaction_id");



CREATE INDEX "idx_transactions_recurring" ON "public"."transactions_enc" USING "btree" ("user_id", "recurrence_group_id") WHERE ("is_recurring" = true);



CREATE INDEX "idx_transactions_secondary_category_id" ON "public"."transactions_enc" USING "btree" ("secondary_category_id");



CREATE INDEX "idx_transactions_split_group_id" ON "public"."transactions_enc" USING "btree" ("split_group_id") WHERE ("split_group_id" IS NOT NULL);



CREATE INDEX "idx_transactions_subscription" ON "public"."transactions_enc" USING "btree" ("user_id") WHERE ("is_subscription" = true);



CREATE INDEX "idx_transactions_tags" ON "public"."transactions_enc" USING "gin" ("tags");



CREATE INDEX "idx_transactions_transfer_group" ON "public"."transactions_enc" USING "btree" ("transfer_group_id") WHERE ("transfer_group_id" IS NOT NULL);



CREATE INDEX "idx_transactions_user_date" ON "public"."transactions_enc" USING "btree" ("user_id", "transaction_date" DESC);



CREATE INDEX "idx_transactions_user_date_range" ON "public"."transactions_enc" USING "btree" ("user_id", "transaction_date", "direction");



CREATE INDEX "idx_transactions_user_id" ON "public"."transactions_enc" USING "btree" ("user_id");



CREATE INDEX "idx_transactions_user_status" ON "public"."transactions_enc" USING "btree" ("user_id", "status") WHERE ("status" = 'PENDING'::"public"."transaction_status");



CREATE INDEX "idx_tx_locations_enc_linked_tx" ON "public"."transaction_locations_enc" USING "btree" ("user_id", "linked_transaction_id") WHERE ("linked_transaction_id" IS NOT NULL);



CREATE INDEX "idx_tx_locations_enc_user_captured" ON "public"."transaction_locations_enc" USING "btree" ("user_id", "captured_at" DESC);



CREATE INDEX "idx_unrecognized_emails_user_status" ON "public"."unrecognized_emails" USING "btree" ("user_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_wishlist_items_user_active" ON "public"."wishlist_items_enc" USING "btree" ("user_id", "created_at" DESC) WHERE ("status" = 'wishlist'::"text");



CREATE INDEX "idx_wishlist_items_user_status" ON "public"."wishlist_items_enc" USING "btree" ("user_id", "status", "last_score" DESC NULLS LAST);



CREATE INDEX "idx_wishlist_reflections_item" ON "public"."wishlist_reflections" USING "btree" ("wishlist_item_id");



CREATE INDEX "modo_participants_modo_id_idx" ON "public"."modo_participants" USING "btree" ("modo_id");



CREATE INDEX "modo_participants_user_id_idx" ON "public"."modo_participants" USING "btree" ("user_id");



CREATE INDEX "modo_tx_reviews_modo_id_idx" ON "public"."modo_tx_reviews" USING "btree" ("modo_id");



CREATE INDEX "modo_tx_reviews_transaction_id_idx" ON "public"."modo_tx_reviews" USING "btree" ("transaction_id");



CREATE INDEX "modo_tx_reviews_user_id_idx" ON "public"."modo_tx_reviews" USING "btree" ("user_id");



CREATE UNIQUE INDEX "modos_one_active_per_user" ON "public"."modos" USING "btree" ("user_id") WHERE "is_active";



CREATE INDEX "modos_user_id_idx" ON "public"."modos" USING "btree" ("user_id");



CREATE UNIQUE INDEX "pdf_passwords_enc_user_scope_target_unique" ON "public"."pdf_passwords_enc" USING "btree" ("user_id", "scope", COALESCE("account_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("bank_key", ''::"text"));



CREATE UNIQUE INDEX "planning_entries_occurrence_id_key" ON "public"."planning_entries" USING "btree" ("occurrence_id") WHERE ("occurrence_id" IS NOT NULL);



CREATE INDEX "statement_tray_dismissals_user_idx" ON "public"."statement_tray_dismissals" USING "btree" ("user_id");



CREATE UNIQUE INDEX "subscriptions_one_live_per_template" ON "public"."subscriptions" USING "btree" ("user_id", "recurring_template_id") WHERE (("status" <> ALL (ARRAY['cancelled'::"public"."subscription_status", 'dismissed'::"public"."subscription_status"])) AND ("recurring_template_id" IS NOT NULL));



CREATE UNIQUE INDEX "subscriptions_one_suggestion_per_destinatario" ON "public"."subscriptions" USING "btree" ("user_id", "destinatario_id") WHERE ("status" = 'suggested'::"public"."subscription_status");



CREATE UNIQUE INDEX "tags_user_slug_unique" ON "public"."tags" USING "btree" (COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "slug");



CREATE UNIQUE INDEX "transactions_idempotency_unique" ON "public"."transactions_enc" USING "btree" ("user_id", "idempotency_key");



CREATE UNIQUE INDEX "transactions_provider_id_unique" ON "public"."transactions_enc" USING "btree" ("user_id", "provider", "provider_transaction_id") WHERE ("provider_transaction_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_personal_debts_general" ON "public"."personal_debts" USING "btree" ("user_id", "destinatario_id", "direction", "currency_code") WHERE ("is_general" AND ("status" <> 'cancelled'::"public"."personal_debt_status"));



CREATE UNIQUE INDEX "uq_personal_debts_installment_group_person" ON "public"."personal_debts" USING "btree" ("user_id", "installment_group_id", "destinatario_id") WHERE ("installment_group_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_recurring_templates_active_inflow_monthly" ON "public"."recurring_transaction_templates_enc" USING "btree" ("user_id", "account_id") WHERE (("direction" = 'INFLOW'::"public"."transaction_direction") AND ("frequency" = 'MONTHLY'::"public"."recurrence_frequency") AND ("is_active" = true));



CREATE OR REPLACE TRIGGER "accounts_updated_at" BEFORE UPDATE ON "public"."accounts_enc" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "accounts_view_delete_trg" INSTEAD OF DELETE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."accounts_view_delete"();



CREATE OR REPLACE TRIGGER "accounts_view_insert_trg" INSTEAD OF INSERT ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."accounts_view_insert"();



CREATE OR REPLACE TRIGGER "accounts_view_update_trg" INSTEAD OF UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."accounts_view_update"();



CREATE OR REPLACE TRIGGER "capture_tokens_view_delete_trg" INSTEAD OF DELETE ON "public"."capture_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."capture_tokens_view_delete"();



CREATE OR REPLACE TRIGGER "capture_tokens_view_insert_trg" INSTEAD OF INSERT ON "public"."capture_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."capture_tokens_view_insert"();



CREATE OR REPLACE TRIGGER "capture_tokens_view_update_trg" INSTEAD OF UPDATE ON "public"."capture_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."capture_tokens_view_update"();



CREATE OR REPLACE TRIGGER "categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "destinatarios_view_delete_trg" INSTEAD OF DELETE ON "public"."destinatarios" FOR EACH ROW EXECUTE FUNCTION "public"."destinatarios_view_delete"();



CREATE OR REPLACE TRIGGER "destinatarios_view_insert_trg" INSTEAD OF INSERT ON "public"."destinatarios" FOR EACH ROW EXECUTE FUNCTION "public"."destinatarios_view_insert"();



CREATE OR REPLACE TRIGGER "destinatarios_view_update_trg" INSTEAD OF UPDATE ON "public"."destinatarios" FOR EACH ROW EXECUTE FUNCTION "public"."destinatarios_view_update"();



CREATE OR REPLACE TRIGGER "email_ingest_addresses_view_delete_trg" INSTEAD OF DELETE ON "public"."email_ingest_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."email_ingest_addresses_view_delete"();



CREATE OR REPLACE TRIGGER "email_ingest_addresses_view_insert_trg" INSTEAD OF INSERT ON "public"."email_ingest_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."email_ingest_addresses_view_insert"();



CREATE OR REPLACE TRIGGER "email_ingest_addresses_view_update_trg" INSTEAD OF UPDATE ON "public"."email_ingest_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."email_ingest_addresses_view_update"();



CREATE OR REPLACE TRIGGER "pdf_passwords_view_delete_trg" INSTEAD OF DELETE ON "public"."pdf_passwords" FOR EACH ROW EXECUTE FUNCTION "public"."pdf_passwords_view_delete"();



CREATE OR REPLACE TRIGGER "pdf_passwords_view_insert_trg" INSTEAD OF INSERT ON "public"."pdf_passwords" FOR EACH ROW EXECUTE FUNCTION "public"."pdf_passwords_view_insert"();



CREATE OR REPLACE TRIGGER "pdf_passwords_view_update_trg" INSTEAD OF UPDATE ON "public"."pdf_passwords" FOR EACH ROW EXECUTE FUNCTION "public"."pdf_passwords_view_update"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles_enc" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "profiles_view_delete_trg" INSTEAD OF DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_view_delete"();



CREATE OR REPLACE TRIGGER "profiles_view_insert_trg" INSTEAD OF INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_view_insert"();



CREATE OR REPLACE TRIGGER "profiles_view_update_trg" INSTEAD OF UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_view_update"();



CREATE OR REPLACE TRIGGER "recurring_templates_enc_generate_occurrences_ins" AFTER INSERT ON "public"."recurring_transaction_templates_enc" FOR EACH ROW EXECUTE FUNCTION "public"."recurring_templates_enc_generate_occurrences_fn"();



CREATE OR REPLACE TRIGGER "recurring_templates_enc_generate_occurrences_upd" AFTER UPDATE ON "public"."recurring_transaction_templates_enc" FOR EACH ROW WHEN (("new"."is_active" AND ((NOT "old"."is_active") OR ("old"."start_date" IS DISTINCT FROM "new"."start_date") OR ("old"."frequency" IS DISTINCT FROM "new"."frequency") OR ("old"."end_date" IS DISTINCT FROM "new"."end_date")))) EXECUTE FUNCTION "public"."recurring_templates_enc_generate_occurrences_fn"();



CREATE OR REPLACE TRIGGER "recurring_templates_view_delete_trg" INSTEAD OF DELETE ON "public"."recurring_transaction_templates" FOR EACH ROW EXECUTE FUNCTION "public"."recurring_templates_view_delete"();



CREATE OR REPLACE TRIGGER "recurring_templates_view_insert_trg" INSTEAD OF INSERT ON "public"."recurring_transaction_templates" FOR EACH ROW EXECUTE FUNCTION "public"."recurring_templates_view_insert"();



CREATE OR REPLACE TRIGGER "recurring_templates_view_update_trg" INSTEAD OF UPDATE ON "public"."recurring_transaction_templates" FOR EACH ROW EXECUTE FUNCTION "public"."recurring_templates_view_update"();



CREATE OR REPLACE TRIGGER "set_bug_reports_updated_at" BEFORE UPDATE ON "public"."bug_reports" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_category_rules_updated_at" BEFORE UPDATE ON "public"."category_rules" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_debt_scenarios_updated_at" BEFORE UPDATE ON "public"."debt_scenarios" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_destinatarios_updated_at" BEFORE UPDATE ON "public"."destinatarios_enc" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_planning_assignments_updated_at" BEFORE UPDATE ON "public"."planning_assignments" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_planning_entries_updated_at" BEFORE UPDATE ON "public"."planning_entries" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_planning_periods_updated_at" BEFORE UPDATE ON "public"."planning_periods" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_product_events_updated_at" BEFORE UPDATE ON "public"."product_events" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."budget_scenarios" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."modos" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."personal_debts" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."recurring_transaction_templates_enc" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "statement_snapshots_view_delete_trg" INSTEAD OF DELETE ON "public"."statement_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."statement_snapshots_view_delete"();



CREATE OR REPLACE TRIGGER "statement_snapshots_view_insert_trg" INSTEAD OF INSERT ON "public"."statement_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."statement_snapshots_view_insert"();



CREATE OR REPLACE TRIGGER "statement_snapshots_view_update_trg" INSTEAD OF UPDATE ON "public"."statement_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."statement_snapshots_view_update"();



CREATE OR REPLACE TRIGGER "transaction_locations_view_delete_trg" INSTEAD OF DELETE ON "public"."transaction_locations" FOR EACH ROW EXECUTE FUNCTION "public"."transaction_locations_view_delete"();



CREATE OR REPLACE TRIGGER "transaction_locations_view_insert_trg" INSTEAD OF INSERT ON "public"."transaction_locations" FOR EACH ROW EXECUTE FUNCTION "public"."transaction_locations_view_insert"();



CREATE OR REPLACE TRIGGER "transaction_locations_view_update_trg" INSTEAD OF UPDATE ON "public"."transaction_locations" FOR EACH ROW EXECUTE FUNCTION "public"."transaction_locations_view_update"();



CREATE OR REPLACE TRIGGER "transactions_fill_flow_class" BEFORE INSERT ON "public"."transactions_enc" FOR EACH ROW EXECUTE FUNCTION "public"."zeta_transactions_fill_flow_class"();



CREATE OR REPLACE TRIGGER "transactions_updated_at" BEFORE UPDATE ON "public"."transactions_enc" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "transactions_view_delete_trg" INSTEAD OF DELETE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."transactions_view_delete"();



CREATE OR REPLACE TRIGGER "transactions_view_insert_trg" INSTEAD OF INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."transactions_view_insert"();



CREATE OR REPLACE TRIGGER "transactions_view_update_trg" INSTEAD OF UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."transactions_view_update"();



CREATE OR REPLACE TRIGGER "trg_statement_snapshots_updated_at" BEFORE UPDATE ON "public"."statement_snapshots_enc" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_sync_subscription_on_template_active" AFTER UPDATE ON "public"."recurring_transaction_templates_enc" FOR EACH ROW EXECUTE FUNCTION "public"."sync_subscription_on_template_active_change"();



CREATE OR REPLACE TRIGGER "update_budgets_updated_at" BEFORE UPDATE ON "public"."budgets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "wishlist_items_view_delete_trg" INSTEAD OF DELETE ON "public"."wishlist_items" FOR EACH ROW EXECUTE FUNCTION "public"."wishlist_items_view_delete"();



CREATE OR REPLACE TRIGGER "wishlist_items_view_insert_trg" INSTEAD OF INSERT ON "public"."wishlist_items" FOR EACH ROW EXECUTE FUNCTION "public"."wishlist_items_view_insert"();



CREATE OR REPLACE TRIGGER "wishlist_items_view_update_trg" INSTEAD OF UPDATE ON "public"."wishlist_items" FOR EACH ROW EXECUTE FUNCTION "public"."wishlist_items_view_update"();



ALTER TABLE ONLY "public"."accounts_enc"
    ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_scenarios"
    ADD CONSTRAINT "budget_scenarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."capture_tokens_enc"
    ADD CONSTRAINT "capture_tokens_default_account_id_fkey" FOREIGN KEY ("default_account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."capture_tokens_enc"
    ADD CONSTRAINT "capture_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_rules"
    ADD CONSTRAINT "category_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_rules"
    ADD CONSTRAINT "category_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_tags"
    ADD CONSTRAINT "category_tags_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_tags"
    ADD CONSTRAINT "category_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."debt_scenarios"
    ADD CONSTRAINT "debt_scenarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_reviews"
    ADD CONSTRAINT "design_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."destinatario_rules"
    ADD CONSTRAINT "destinatario_rules_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "public"."destinatarios_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."destinatario_rules"
    ADD CONSTRAINT "destinatario_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."destinatario_tags"
    ADD CONSTRAINT "destinatario_tags_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "public"."destinatarios_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."destinatario_tags"
    ADD CONSTRAINT "destinatario_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."destinatarios_enc"
    ADD CONSTRAINT "destinatarios_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."destinatarios_enc"
    ADD CONSTRAINT "destinatarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_ingest_addresses_enc"
    ADD CONSTRAINT "email_ingest_addresses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_ingest_addresses_enc"
    ADD CONSTRAINT "email_ingest_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_ingest_allowed_senders"
    ADD CONSTRAINT "email_ingest_allowed_senders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_ingest_logs"
    ADD CONSTRAINT "email_ingest_logs_email_ingest_id_fkey" FOREIGN KEY ("email_ingest_id") REFERENCES "public"."email_ingest_addresses_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_ingest_logs"
    ADD CONSTRAINT "email_ingest_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_reminders"
    ADD CONSTRAINT "financial_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modo_participants"
    ADD CONSTRAINT "modo_participants_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "public"."destinatarios_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modo_participants"
    ADD CONSTRAINT "modo_participants_modo_id_fkey" FOREIGN KEY ("modo_id") REFERENCES "public"."modos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modo_participants"
    ADD CONSTRAINT "modo_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modo_tx_reviews"
    ADD CONSTRAINT "modo_tx_reviews_modo_id_fkey" FOREIGN KEY ("modo_id") REFERENCES "public"."modos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modo_tx_reviews"
    ADD CONSTRAINT "modo_tx_reviews_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modo_tx_reviews"
    ADD CONSTRAINT "modo_tx_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modos"
    ADD CONSTRAINT "modos_auto_tag_id_fkey" FOREIGN KEY ("auto_tag_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."modos"
    ADD CONSTRAINT "modos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pdf_passwords_enc"
    ADD CONSTRAINT "pdf_passwords_enc_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pdf_passwords_enc"
    ADD CONSTRAINT "pdf_passwords_enc_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_email_statements"
    ADD CONSTRAINT "pending_email_statements_email_ingest_id_fkey" FOREIGN KEY ("email_ingest_id") REFERENCES "public"."email_ingest_addresses_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_email_statements"
    ADD CONSTRAINT "pending_email_statements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_email_transactions"
    ADD CONSTRAINT "pending_email_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_email_transactions"
    ADD CONSTRAINT "pending_email_transactions_conflict_transaction_id_fkey" FOREIGN KEY ("conflict_transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_email_transactions"
    ADD CONSTRAINT "pending_email_transactions_email_ingest_id_fkey" FOREIGN KEY ("email_ingest_id") REFERENCES "public"."email_ingest_addresses_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_email_transactions"
    ADD CONSTRAINT "pending_email_transactions_suggested_account_id_fkey" FOREIGN KEY ("suggested_account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_email_transactions"
    ADD CONSTRAINT "pending_email_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_debt_allocations"
    ADD CONSTRAINT "personal_debt_allocations_personal_debt_id_fkey" FOREIGN KEY ("personal_debt_id") REFERENCES "public"."personal_debts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_debt_allocations"
    ADD CONSTRAINT "personal_debt_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_debt_allocations"
    ADD CONSTRAINT "personal_debt_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_debts"
    ADD CONSTRAINT "personal_debts_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "public"."destinatarios_enc"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."personal_debts"
    ADD CONSTRAINT "personal_debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_assignments"
    ADD CONSTRAINT "planning_assignments_expense_entry_id_fkey" FOREIGN KEY ("expense_entry_id") REFERENCES "public"."planning_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_assignments"
    ADD CONSTRAINT "planning_assignments_income_entry_id_fkey" FOREIGN KEY ("income_entry_id") REFERENCES "public"."planning_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_assignments"
    ADD CONSTRAINT "planning_assignments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."planning_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_assignments"
    ADD CONSTRAINT "planning_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_entries"
    ADD CONSTRAINT "planning_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_entries"
    ADD CONSTRAINT "planning_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_entries"
    ADD CONSTRAINT "planning_entries_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "public"."recurring_occurrences"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_entries"
    ADD CONSTRAINT "planning_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."planning_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_entries"
    ADD CONSTRAINT "planning_entries_recurring_template_id_fkey" FOREIGN KEY ("recurring_template_id") REFERENCES "public"."recurring_transaction_templates_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_entries"
    ADD CONSTRAINT "planning_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_periods"
    ADD CONSTRAINT "planning_periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_events"
    ADD CONSTRAINT "product_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles_enc"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_occurrences"
    ADD CONSTRAINT "recurring_occurrences_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."recurring_transaction_templates_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_occurrences"
    ADD CONSTRAINT "recurring_occurrences_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_occurrences"
    ADD CONSTRAINT "recurring_occurrences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_template_tags"
    ADD CONSTRAINT "recurring_template_tags_recurring_template_id_fkey" FOREIGN KEY ("recurring_template_id") REFERENCES "public"."recurring_transaction_templates_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_template_tags"
    ADD CONSTRAINT "recurring_template_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_template_tags"
    ADD CONSTRAINT "recurring_template_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_transaction_templates_enc"
    ADD CONSTRAINT "recurring_transaction_templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_transaction_templates_enc"
    ADD CONSTRAINT "recurring_transaction_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_transaction_templates_enc"
    ADD CONSTRAINT "recurring_transaction_templates_enc_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "public"."destinatarios_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_transaction_templates_enc"
    ADD CONSTRAINT "recurring_transaction_templates_transfer_source_account_id_fkey" FOREIGN KEY ("transfer_source_account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_transaction_templates_enc"
    ADD CONSTRAINT "recurring_transaction_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_snapshots_enc"
    ADD CONSTRAINT "statement_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_snapshots_enc"
    ADD CONSTRAINT "statement_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_tray_dismissals"
    ADD CONSTRAINT "statement_tray_dismissals_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."statement_tray_dismissals"
    ADD CONSTRAINT "statement_tray_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "public"."destinatarios_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_recurring_template_id_fkey" FOREIGN KEY ("recurring_template_id") REFERENCES "public"."recurring_transaction_templates_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tag_groups"
    ADD CONSTRAINT "tag_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."tag_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_locations_enc"
    ADD CONSTRAINT "transaction_locations_enc_linked_transaction_id_fkey" FOREIGN KEY ("linked_transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transaction_locations_enc"
    ADD CONSTRAINT "transaction_locations_enc_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_tags"
    ADD CONSTRAINT "transaction_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_tags"
    ADD CONSTRAINT "transaction_tags_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_tags"
    ADD CONSTRAINT "transaction_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "public"."destinatarios_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_enc_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."transaction_locations_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_enc_personal_debt_id_fkey" FOREIGN KEY ("personal_debt_id") REFERENCES "public"."personal_debts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_reconciled_into_transaction_id_fkey" FOREIGN KEY ("reconciled_into_transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_secondary_category_id_fkey" FOREIGN KEY ("secondary_category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions_enc"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unrecognized_emails"
    ADD CONSTRAINT "unrecognized_emails_email_ingest_id_fkey" FOREIGN KEY ("email_ingest_id") REFERENCES "public"."email_ingest_addresses_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."unrecognized_emails"
    ADD CONSTRAINT "unrecognized_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles_enc"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_encryption_keys"
    ADD CONSTRAINT "user_encryption_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_items_enc"
    ADD CONSTRAINT "wishlist_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wishlist_items_enc"
    ADD CONSTRAINT "wishlist_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wishlist_items_enc"
    ADD CONSTRAINT "wishlist_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions_enc"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wishlist_items_enc"
    ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_reflections"
    ADD CONSTRAINT "wishlist_reflections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_reflections"
    ADD CONSTRAINT "wishlist_reflections_wishlist_item_id_fkey" FOREIGN KEY ("wishlist_item_id") REFERENCES "public"."wishlist_items_enc"("id") ON DELETE CASCADE;



CREATE POLICY "Service role can insert logs" ON "public"."email_ingest_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create their own accounts" ON "public"."accounts_enc" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create their own categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_system" = false)));



CREATE POLICY "Users can create their own transactions" ON "public"."transactions_enc" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own bug reports" ON "public"."bug_reports" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own categories" ON "public"."categories" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can delete own pdf_passwords" ON "public"."pdf_passwords_enc" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own product events" ON "public"."product_events" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own recurring template tags" ON "public"."recurring_template_tags" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete own rules" ON "public"."category_rules" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own tag groups" ON "public"."tag_groups" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can delete own tags" ON "public"."tags" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can delete own transaction tags" ON "public"."transaction_tags" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own accounts" ON "public"."accounts_enc" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own allowed senders" ON "public"."email_ingest_allowed_senders" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own budgets" ON "public"."budgets" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own categories" ON "public"."categories" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_system" = false)));



CREATE POLICY "Users can delete their own transactions" ON "public"."transactions_enc" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own bug reports" ON "public"."bug_reports" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own categories" ON "public"."categories" FOR INSERT WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can insert own pdf_passwords" ON "public"."pdf_passwords_enc" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own product events" ON "public"."product_events" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own recurring template tags" ON "public"."recurring_template_tags" FOR INSERT WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."recurring_transaction_templates_enc" "t"
  WHERE (("t"."id" = "recurring_template_tags"."recurring_template_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can insert own reviews" ON "public"."design_reviews" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own rules" ON "public"."category_rules" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own snapshots" ON "public"."statement_snapshots_enc" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own tag groups" ON "public"."tag_groups" FOR INSERT WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can insert own tags" ON "public"."tags" FOR INSERT WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can insert own transaction tags" ON "public"."transaction_tags" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."transactions_enc" "t"
  WHERE (("t"."id" = "transaction_tags"."transaction_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can insert their own allowed senders" ON "public"."email_ingest_allowed_senders" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own budgets" ON "public"."budgets" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage destinatario tags for own destinatarios" ON "public"."destinatario_tags" USING ((EXISTS ( SELECT 1
   FROM "public"."destinatarios_enc" "d"
  WHERE (("d"."id" = "destinatario_tags"."destinatario_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can manage own category tags" ON "public"."category_tags" USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_tags"."category_id") AND ("c"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_tags"."category_id") AND ("c"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can manage own recurring templates" ON "public"."recurring_transaction_templates_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own capture tokens" ON "public"."capture_tokens_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own ingest address" ON "public"."email_ingest_addresses_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own pending statements" ON "public"."pending_email_statements" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own pending transactions" ON "public"."pending_email_transactions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own unrecognized emails" ON "public"."unrecognized_emails" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read category tags" ON "public"."category_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_tags"."category_id") AND (("c"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("c"."user_id" IS NULL))))));



CREATE POLICY "Users can read own bug reports" ON "public"."bug_reports" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own product events" ON "public"."product_events" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own reviews" ON "public"."design_reviews" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read own rules" ON "public"."category_rules" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can select own pdf_passwords" ON "public"."pdf_passwords_enc" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own bug reports" ON "public"."bug_reports" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own categories" ON "public"."categories" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can update own pdf_passwords" ON "public"."pdf_passwords_enc" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own product events" ON "public"."product_events" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own reviews" ON "public"."design_reviews" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own rules" ON "public"."category_rules" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own snapshots" ON "public"."statement_snapshots_enc" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own tag groups" ON "public"."tag_groups" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can update own tags" ON "public"."tags" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("is_system" = false)));



CREATE POLICY "Users can update own transaction tags" ON "public"."transaction_tags" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."transactions_enc" "t"
  WHERE (("t"."id" = "transaction_tags"."transaction_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can update their own accounts" ON "public"."accounts_enc" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own allowed senders" ON "public"."email_ingest_allowed_senders" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own budgets" ON "public"."budgets" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_system" = false))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("is_system" = false)));



CREATE POLICY "Users can update their own ingest logs" ON "public"."email_ingest_logs" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles_enc" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update their own transactions" ON "public"."transactions_enc" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view category tags for accessible categories" ON "public"."category_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."categories" "c"
  WHERE (("c"."id" = "category_tags"."category_id") AND (("c"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("c"."user_id" IS NULL))))));



CREATE POLICY "Users can view destinatario tags for own destinatarios" ON "public"."destinatario_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."destinatarios_enc" "d"
  WHERE (("d"."id" = "destinatario_tags"."destinatario_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own and system categories" ON "public"."categories" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL)));



CREATE POLICY "Users can view own and system tag groups" ON "public"."tag_groups" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL)));



CREATE POLICY "Users can view own and system tags" ON "public"."tags" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL)));



CREATE POLICY "Users can view own recurring template tags" ON "public"."recurring_template_tags" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own snapshots" ON "public"."statement_snapshots_enc" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own transaction tags" ON "public"."transaction_tags" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view system and own categories" ON "public"."categories" FOR SELECT TO "authenticated" USING ((("user_id" IS NULL) OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "Users can view their own accounts" ON "public"."accounts_enc" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own allowed senders" ON "public"."email_ingest_allowed_senders" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own budgets" ON "public"."budgets" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own ingest logs" ON "public"."email_ingest_logs" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles_enc" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view their own transactions" ON "public"."transactions_enc" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own occurrences" ON "public"."recurring_occurrences" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own planning assignments" ON "public"."planning_assignments" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own planning entries" ON "public"."planning_entries" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own planning periods" ON "public"."planning_periods" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own reflections" ON "public"."wishlist_reflections" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own reminders" ON "public"."financial_reminders" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own scenarios" ON "public"."debt_scenarios" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own wishlist items" ON "public"."wishlist_items_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."accounts_enc" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anyone_can_read_rates" ON "public"."exchange_rate_cache" FOR SELECT USING (true);



CREATE POLICY "authenticated_can_upsert_rates" ON "public"."exchange_rate_cache" TO "authenticated" USING (true);



ALTER TABLE "public"."budget_scenarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_scenarios_delete" ON "public"."budget_scenarios" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "budget_scenarios_insert" ON "public"."budget_scenarios" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "budget_scenarios_select" ON "public"."budget_scenarios" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "budget_scenarios_update" ON "public"."budget_scenarios" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bug_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."capture_tokens_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debt_scenarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destinatario_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destinatario_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destinatarios_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_ingest_addresses_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_ingest_allowed_senders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_ingest_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exchange_rate_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modo_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modo_participants_delete_own" ON "public"."modo_participants" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modo_participants_insert_own" ON "public"."modo_participants" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modo_participants_select_own" ON "public"."modo_participants" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modo_participants_update_own" ON "public"."modo_participants" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."modo_tx_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modo_tx_reviews_delete_own" ON "public"."modo_tx_reviews" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modo_tx_reviews_insert_own" ON "public"."modo_tx_reviews" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modo_tx_reviews_select_own" ON "public"."modo_tx_reviews" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modo_tx_reviews_update_own" ON "public"."modo_tx_reviews" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."modos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modos_delete_own" ON "public"."modos" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modos_insert_own" ON "public"."modos" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modos_select_own" ON "public"."modos" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "modos_update_own" ON "public"."modos" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own accounts" ON "public"."accounts_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own destinatario_rules" ON "public"."destinatario_rules" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own destinatarios" ON "public"."destinatarios_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own profile" ON "public"."profiles_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "own transaction_locations" ON "public"."transaction_locations_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own transactions" ON "public"."transactions_enc" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "own_key" ON "public"."user_encryption_keys" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."pdf_passwords_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_email_statements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_email_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personal_debt_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "personal_debt_allocations_delete" ON "public"."personal_debt_allocations" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "personal_debt_allocations_insert" ON "public"."personal_debt_allocations" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."transactions_enc" "t"
  WHERE (("t"."id" = "personal_debt_allocations"."transaction_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) AND (EXISTS ( SELECT 1
   FROM "public"."personal_debts" "d"
  WHERE (("d"."id" = "personal_debt_allocations"."personal_debt_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "personal_debt_allocations_select" ON "public"."personal_debt_allocations" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "personal_debt_allocations_update" ON "public"."personal_debt_allocations" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."transactions_enc" "t"
  WHERE (("t"."id" = "personal_debt_allocations"."transaction_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) AND (EXISTS ( SELECT 1
   FROM "public"."personal_debts" "d"
  WHERE (("d"."id" = "personal_debt_allocations"."personal_debt_id") AND ("d"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."personal_debts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "personal_debts_delete" ON "public"."personal_debts" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "personal_debts_insert" ON "public"."personal_debts" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "personal_debts_select" ON "public"."personal_debts" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "personal_debts_update" ON "public"."personal_debts" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."planning_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_occurrences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_template_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_transaction_templates_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."statement_snapshots_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."statement_tray_dismissals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "statement_tray_dismissals_delete_own" ON "public"."statement_tray_dismissals" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "statement_tray_dismissals_insert_own" ON "public"."statement_tray_dismissals" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "statement_tray_dismissals_select_own" ON "public"."statement_tray_dismissals" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_delete" ON "public"."subscriptions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "subscriptions_insert" ON "public"."subscriptions" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "subscriptions_select" ON "public"."subscriptions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "subscriptions_update" ON "public"."subscriptions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."tag_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_locations_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unrecognized_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_encryption_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlist_items_enc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlist_reflections" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."accounts_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."accounts_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accounts_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."accounts_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."accounts_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accounts_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."accounts_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."accounts_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accounts_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_tokens_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_tokens_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_tokens_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_tokens_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_tokens_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_tokens_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_tokens_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_tokens_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_tokens_view_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_anonymous_demo_users"("p_older_than" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_anonymous_demo_users"("p_older_than" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_anonymous_demo_users"("p_older_than" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_anonymous_demo_users"("p_older_than" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_user_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."destinatarios_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."destinatarios_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."destinatarios_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."destinatarios_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."destinatarios_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."destinatarios_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."destinatarios_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."destinatarios_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."destinatarios_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."email_ingest_addresses_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_occurrences_for_template"("p_template_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_occurrences_for_template"("p_template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_occurrences_for_template"("p_template_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_accounts_with_masks"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_accounts_with_masks"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_accounts_with_masks"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accounts_with_masks"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_email_ingest_settings"("p_address_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_email_ingest_settings"("p_address_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_email_ingest_settings"("p_address_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_email_ingest_settings"("p_address_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_encryption_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_encryption_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_encryption_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pdf_passwords_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."pdf_passwords_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pdf_passwords_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pdf_passwords_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."pdf_passwords_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pdf_passwords_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pdf_passwords_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."pdf_passwords_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pdf_passwords_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."quincenal_occurrence_at"("p_start" "date", "p_k" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."quincenal_occurrence_at"("p_start" "date", "p_k" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."quincenal_occurrence_at"("p_start" "date", "p_k" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recurring_templates_enc_generate_occurrences_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."recurring_templates_enc_generate_occurrences_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_templates_enc_generate_occurrences_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recurring_templates_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."recurring_templates_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_templates_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recurring_templates_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."recurring_templates_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_templates_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recurring_templates_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."recurring_templates_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_templates_view_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_user_data"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_user_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_user_data"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_gmail_verification"("p_ingest_id" "uuid", "p_user_id" "uuid", "p_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_gmail_verification"("p_ingest_id" "uuid", "p_user_id" "uuid", "p_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_gmail_verification"("p_ingest_id" "uuid", "p_user_id" "uuid", "p_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_gmail_verification"("p_ingest_id" "uuid", "p_user_id" "uuid", "p_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."statement_snapshots_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."statement_snapshots_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."statement_snapshots_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."statement_snapshots_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."statement_snapshots_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."statement_snapshots_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."statement_snapshots_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."statement_snapshots_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."statement_snapshots_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_subscription_on_template_active_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_subscription_on_template_active_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_subscription_on_template_active_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transaction_locations_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."transaction_locations_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."transaction_locations_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transaction_locations_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."transaction_locations_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."transaction_locations_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transaction_locations_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."transaction_locations_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."transaction_locations_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transactions_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."transactions_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."transactions_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transactions_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."transactions_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."transactions_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transactions_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."transactions_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."transactions_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."wishlist_items_view_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."wishlist_items_view_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wishlist_items_view_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."wishlist_items_view_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."wishlist_items_view_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wishlist_items_view_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."wishlist_items_view_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."wishlist_items_view_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wishlist_items_view_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."zeta_decrypt"("ciphertext" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_decrypt"("ciphertext" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_decrypt"("ciphertext" "bytea") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_decrypt_as"("ciphertext" "bytea", "target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_decrypt_as"("ciphertext" "bytea", "target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_decrypt_as"("ciphertext" "bytea", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_decrypt_as"("ciphertext" "bytea", "target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."zeta_encrypt"("plaintext" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_encrypt"("plaintext" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_encrypt"("plaintext" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_encrypt_as"("plaintext" "text", "target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_encrypt_as"("plaintext" "text", "target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_encrypt_as"("plaintext" "text", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_encrypt_as"("plaintext" "text", "target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."zeta_flow_class"("p_direction" "text", "p_account_type" "text", "p_description" "text", "p_transfer_group_id" "uuid", "p_counterpart_account_type" "text", "p_matched_account_type" "text", "p_source_pattern" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_flow_class"("p_direction" "text", "p_account_type" "text", "p_description" "text", "p_transfer_group_id" "uuid", "p_counterpart_account_type" "text", "p_matched_account_type" "text", "p_source_pattern" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_flow_class"("p_direction" "text", "p_account_type" "text", "p_description" "text", "p_transfer_group_id" "uuid", "p_counterpart_account_type" "text", "p_matched_account_type" "text", "p_source_pattern" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_flow_class_candidates"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_flow_class_candidates"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."zeta_flow_class_from_pattern"("p_pattern" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_flow_class_from_pattern"("p_pattern" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_flow_class_from_pattern"("p_pattern" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."zeta_hmac"("plaintext" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_hmac"("plaintext" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_hmac"("plaintext" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_hmac_as"("plaintext" "text", "target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_hmac_as"("plaintext" "text", "target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_hmac_as"("plaintext" "text", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_hmac_as"("plaintext" "text", "target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_mcp_accounts"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_mcp_accounts"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_mcp_breakdown"("p_user_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_mcp_breakdown"("p_user_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_mcp_cashflow"("p_user_id" "uuid", "p_months" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_mcp_cashflow"("p_user_id" "uuid", "p_months" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_mcp_data_quality"("p_user_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_mcp_data_quality"("p_user_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_mcp_recurring"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_mcp_recurring"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_mcp_transactions"("p_user_id" "uuid", "p_from" "date", "p_to" "date", "p_direction" "text", "p_account_id" "uuid", "p_flow_class" "text", "p_search" "text", "p_min_amount" numeric, "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_mcp_transactions"("p_user_id" "uuid", "p_from" "date", "p_to" "date", "p_direction" "text", "p_account_id" "uuid", "p_flow_class" "text", "p_search" "text", "p_min_amount" numeric, "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."zeta_mcp_tx_base"("p_user_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."zeta_mcp_tx_base"("p_user_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."zeta_norm_text"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_norm_text"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_norm_text"("p_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."zeta_transactions_fill_flow_class"() TO "anon";
GRANT ALL ON FUNCTION "public"."zeta_transactions_fill_flow_class"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."zeta_transactions_fill_flow_class"() TO "service_role";












GRANT ALL ON TABLE "public"."product_events" TO "anon";
GRANT ALL ON TABLE "public"."product_events" TO "authenticated";
GRANT ALL ON TABLE "public"."product_events" TO "service_role";















GRANT ALL ON TABLE "public"."accounts_enc" TO "anon";
GRANT ALL ON TABLE "public"."accounts_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts_enc" TO "service_role";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."admin_config" TO "anon";
GRANT ALL ON TABLE "public"."admin_config" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_config" TO "service_role";



GRANT ALL ON TABLE "public"."budget_scenarios" TO "anon";
GRANT ALL ON TABLE "public"."budget_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_scenarios" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."bug_reports" TO "anon";
GRANT ALL ON TABLE "public"."bug_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."bug_reports" TO "service_role";



GRANT ALL ON TABLE "public"."capture_tokens_enc" TO "anon";
GRANT ALL ON TABLE "public"."capture_tokens_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."capture_tokens_enc" TO "service_role";



GRANT ALL ON TABLE "public"."capture_tokens" TO "anon";
GRANT ALL ON TABLE "public"."capture_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."capture_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_rules" TO "anon";
GRANT ALL ON TABLE "public"."category_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."category_rules" TO "service_role";



GRANT ALL ON TABLE "public"."category_tags" TO "anon";
GRANT ALL ON TABLE "public"."category_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."category_tags" TO "service_role";



GRANT ALL ON TABLE "public"."debt_scenarios" TO "anon";
GRANT ALL ON TABLE "public"."debt_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."debt_scenarios" TO "service_role";



GRANT ALL ON TABLE "public"."design_reviews" TO "anon";
GRANT ALL ON TABLE "public"."design_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."design_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."destinatario_rules" TO "anon";
GRANT ALL ON TABLE "public"."destinatario_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."destinatario_rules" TO "service_role";



GRANT ALL ON TABLE "public"."destinatario_tags" TO "anon";
GRANT ALL ON TABLE "public"."destinatario_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."destinatario_tags" TO "service_role";



GRANT ALL ON TABLE "public"."destinatarios_enc" TO "anon";
GRANT ALL ON TABLE "public"."destinatarios_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."destinatarios_enc" TO "service_role";



GRANT ALL ON TABLE "public"."destinatarios" TO "anon";
GRANT ALL ON TABLE "public"."destinatarios" TO "authenticated";
GRANT ALL ON TABLE "public"."destinatarios" TO "service_role";



GRANT ALL ON TABLE "public"."email_ingest_addresses_enc" TO "anon";
GRANT ALL ON TABLE "public"."email_ingest_addresses_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."email_ingest_addresses_enc" TO "service_role";



GRANT ALL ON TABLE "public"."email_ingest_addresses" TO "anon";
GRANT ALL ON TABLE "public"."email_ingest_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."email_ingest_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."email_ingest_allowed_senders" TO "anon";
GRANT ALL ON TABLE "public"."email_ingest_allowed_senders" TO "authenticated";
GRANT ALL ON TABLE "public"."email_ingest_allowed_senders" TO "service_role";



GRANT ALL ON TABLE "public"."email_ingest_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_ingest_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_ingest_logs" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rate_cache" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rate_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rate_cache" TO "service_role";



GRANT ALL ON TABLE "public"."financial_reminders" TO "anon";
GRANT ALL ON TABLE "public"."financial_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."modo_participants" TO "anon";
GRANT ALL ON TABLE "public"."modo_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."modo_participants" TO "service_role";



GRANT ALL ON TABLE "public"."modo_tx_reviews" TO "anon";
GRANT ALL ON TABLE "public"."modo_tx_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."modo_tx_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."modos" TO "anon";
GRANT ALL ON TABLE "public"."modos" TO "authenticated";
GRANT ALL ON TABLE "public"."modos" TO "service_role";



GRANT ALL ON TABLE "public"."pdf_passwords_enc" TO "anon";
GRANT ALL ON TABLE "public"."pdf_passwords_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."pdf_passwords_enc" TO "service_role";



GRANT ALL ON TABLE "public"."pdf_passwords" TO "anon";
GRANT ALL ON TABLE "public"."pdf_passwords" TO "authenticated";
GRANT ALL ON TABLE "public"."pdf_passwords" TO "service_role";



GRANT ALL ON TABLE "public"."pending_email_statements" TO "anon";
GRANT ALL ON TABLE "public"."pending_email_statements" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_email_statements" TO "service_role";



GRANT ALL ON TABLE "public"."pending_email_transactions" TO "anon";
GRANT ALL ON TABLE "public"."pending_email_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_email_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."personal_debt_allocations" TO "anon";
GRANT ALL ON TABLE "public"."personal_debt_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_debt_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."transactions_enc" TO "anon";
GRANT ALL ON TABLE "public"."transactions_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions_enc" TO "service_role";



GRANT ALL ON TABLE "public"."personal_debt_repayment_amounts" TO "anon";
GRANT ALL ON TABLE "public"."personal_debt_repayment_amounts" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_debt_repayment_amounts" TO "service_role";



GRANT ALL ON TABLE "public"."personal_debts" TO "anon";
GRANT ALL ON TABLE "public"."personal_debts" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_debts" TO "service_role";



GRANT ALL ON TABLE "public"."planning_assignments" TO "anon";
GRANT ALL ON TABLE "public"."planning_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."planning_entries" TO "anon";
GRANT ALL ON TABLE "public"."planning_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_entries" TO "service_role";



GRANT ALL ON TABLE "public"."planning_periods" TO "anon";
GRANT ALL ON TABLE "public"."planning_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_periods" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_enc" TO "anon";
GRANT ALL ON TABLE "public"."profiles_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_enc" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_occurrences" TO "anon";
GRANT ALL ON TABLE "public"."recurring_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_occurrences" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_template_tags" TO "anon";
GRANT ALL ON TABLE "public"."recurring_template_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_template_tags" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_transaction_templates_enc" TO "anon";
GRANT ALL ON TABLE "public"."recurring_transaction_templates_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_transaction_templates_enc" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_transaction_templates" TO "anon";
GRANT ALL ON TABLE "public"."recurring_transaction_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_transaction_templates" TO "service_role";



GRANT ALL ON TABLE "public"."statement_snapshots_enc" TO "anon";
GRANT ALL ON TABLE "public"."statement_snapshots_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."statement_snapshots_enc" TO "service_role";



GRANT ALL ON TABLE "public"."statement_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."statement_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."statement_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."statement_tray_dismissals" TO "anon";
GRANT ALL ON TABLE "public"."statement_tray_dismissals" TO "authenticated";
GRANT ALL ON TABLE "public"."statement_tray_dismissals" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tag_groups" TO "anon";
GRANT ALL ON TABLE "public"."tag_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."tag_groups" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_locations_enc" TO "anon";
GRANT ALL ON TABLE "public"."transaction_locations_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_locations_enc" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_locations" TO "anon";
GRANT ALL ON TABLE "public"."transaction_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_locations" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_tags" TO "anon";
GRANT ALL ON TABLE "public"."transaction_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_tags" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."unrecognized_emails" TO "anon";
GRANT ALL ON TABLE "public"."unrecognized_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."unrecognized_emails" TO "service_role";



GRANT ALL ON TABLE "public"."user_encryption_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_encryption_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_encryption_keys" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist_items_enc" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_items_enc" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_items_enc" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist_items" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_items" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist_reflections" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_reflections" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_reflections" TO "service_role";



GRANT ALL ON TABLE "public"."zeta_flow_class_health" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































