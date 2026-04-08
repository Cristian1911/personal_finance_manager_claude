-- ===========================================================================
-- Fix: INSERT triggers must COALESCE ALL columns that have NOT NULL + DEFAULT
-- constraints on the _enc tables.
--
-- Problem: The previous migration (20260408143012) only added COALESCE for
-- id, created_at, updated_at. But many more columns have NOT NULL + DEFAULT
-- constraints (exchange_rate, status, is_excluded, provider, etc.) and pass
-- NULL when the INSERT omits them, violating NOT NULL constraints.
--
-- Fix: Add COALESCE for every NOT NULL + DEFAULT column in each _enc table.
-- ===========================================================================

-- 1. transactions_view_insert
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
    COALESCE(NEW.capture_method, 'MANUAL_FORM'::transaction_capture_method),
    NEW.categorization_confidence,
    COALESCE(NEW.categorization_source, 'USER_CREATED'::categorization_source),
    NEW.category_id,
    zeta_encrypt(NEW.clean_description),
    zeta_hmac(NEW.clean_description),
    COALESCE(NEW.created_at, now()), NEW.currency_code, NEW.destinatario_id,
    NEW.direction,
    COALESCE(NEW.exchange_rate, 1.000000),
    COALESCE(NEW.id, gen_random_uuid()), NEW.idempotency_key,
    NEW.installment_current, NEW.installment_group_id,
    NEW.installment_total,
    COALESCE(NEW.is_excluded, false),
    COALESCE(NEW.is_recurring, false),
    COALESCE(NEW.is_subscription, false),
    NEW.merchant_category_code,
    NEW.merchant_logo_url,
    zeta_encrypt(NEW.merchant_name),
    zeta_hmac(NEW.merchant_name),
    zeta_encrypt(NEW.notes),
    NEW.original_amount, NEW.posting_date,
    COALESCE(NEW.provider, 'MANUAL'::data_provider),
    NEW.provider_transaction_id,
    zeta_encrypt(NEW.raw_description),
    NEW.reconciled_into_transaction_id, NEW.reconciliation_score,
    NEW.recurrence_group_id, NEW.secondary_category_id,
    COALESCE(NEW.status, 'POSTED'::transaction_status),
    NEW.tags, NEW.transaction_date, COALESCE(NEW.updated_at, now()), NEW.user_id
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. accounts_view_insert
CREATE OR REPLACE FUNCTION accounts_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO accounts_enc (
    account_type, available_balance, color, connection_status, created_at,
    credit_limit, currency_balances, currency_code, current_balance, cutoff_day,
    debit_card_mask, display_order, expected_return_rate, icon, id,
    initial_investment, institution_name, interest_rate, is_active,
    last_synced_at, loan_amount, loan_end_date, loan_start_date, mask,
    mask_hmac, maturity_date, monthly_payment, name, payment_day,
    pdf_password, provider, provider_account_id, provider_account_id_hmac,
    show_in_dashboard, updated_at, user_id
  ) VALUES (
    NEW.account_type, NEW.available_balance, NEW.color,
    COALESCE(NEW.connection_status, 'CONNECTED'::connection_status),
    COALESCE(NEW.created_at, now()), NEW.credit_limit, NEW.currency_balances,
    COALESCE(NEW.currency_code, 'COP'::currency_code),
    COALESCE(NEW.current_balance, 0),
    NEW.cutoff_day,
    zeta_encrypt(NEW.debit_card_mask),
    COALESCE(NEW.display_order, 0),
    NEW.expected_return_rate, NEW.icon, COALESCE(NEW.id, gen_random_uuid()),
    NEW.initial_investment,
    zeta_encrypt(NEW.institution_name),
    NEW.interest_rate,
    COALESCE(NEW.is_active, true),
    NEW.last_synced_at, NEW.loan_amount,
    NEW.loan_end_date, NEW.loan_start_date,
    zeta_encrypt(NEW.mask),
    zeta_hmac(NEW.mask),
    NEW.maturity_date, NEW.monthly_payment,
    zeta_encrypt(NEW.name),
    NEW.payment_day,
    zeta_encrypt(NEW.pdf_password),
    COALESCE(NEW.provider, 'MANUAL'::data_provider),
    zeta_encrypt(NEW.provider_account_id),
    zeta_hmac(NEW.provider_account_id),
    COALESCE(NEW.show_in_dashboard, true),
    COALESCE(NEW.updated_at, now()), NEW.user_id
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. profiles_view_insert (id is NOT defaulted — references auth.users)
CREATE OR REPLACE FUNCTION profiles_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles_enc (
    app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
    email, estimated_monthly_expenses, estimated_monthly_income, full_name,
    id, locale, monthly_salary, onboarding_completed, preferred_currency,
    timezone, updated_at
  ) VALUES (
    NEW.app_purpose, NEW.avatar_url, NEW.budget_mode, COALESCE(NEW.created_at, now()),
    NEW.dashboard_config,
    zeta_encrypt(NEW.email),
    NEW.estimated_monthly_expenses, NEW.estimated_monthly_income,
    zeta_encrypt(NEW.full_name),
    NEW.id,
    COALESCE(NEW.locale, 'es-CO'::text),
    NEW.monthly_salary,
    COALESCE(NEW.onboarding_completed, false),
    COALESCE(NEW.preferred_currency, 'COP'::currency_code),
    COALESCE(NEW.timezone, 'America/Bogota'::text),
    COALESCE(NEW.updated_at, now())
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. destinatarios_view_insert
CREATE OR REPLACE FUNCTION destinatarios_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO destinatarios_enc (
    created_at, default_category_id, id, is_active, name, name_hmac,
    notes, updated_at, user_id
  ) VALUES (
    COALESCE(NEW.created_at, now()), NEW.default_category_id, COALESCE(NEW.id, gen_random_uuid()),
    COALESCE(NEW.is_active, true),
    zeta_encrypt(NEW.name),
    zeta_hmac(NEW.name),
    zeta_encrypt(NEW.notes),
    COALESCE(NEW.updated_at, now()), NEW.user_id
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. statement_snapshots_view_insert
CREATE OR REPLACE FUNCTION statement_snapshots_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO statement_snapshots_enc (
    account_id, available_credit, created_at, credit_limit, currency_code,
    final_balance, id, imported_count, initial_amount, installments_in_default,
    interest_charged, interest_rate, late_interest_rate, loan_number,
    minimum_payment, payment_due_date, period_from, period_to, previous_balance,
    purchases_and_charges, remaining_balance, skipped_count, source_filename,
    total_credits, total_debits, total_payment_due, transaction_count,
    updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.available_credit, COALESCE(NEW.created_at, now()), NEW.credit_limit,
    COALESCE(NEW.currency_code, 'COP'::text),
    NEW.final_balance, COALESCE(NEW.id, gen_random_uuid()),
    COALESCE(NEW.imported_count, 0),
    NEW.initial_amount, NEW.installments_in_default, NEW.interest_charged,
    NEW.interest_rate, NEW.late_interest_rate,
    zeta_encrypt(NEW.loan_number),
    NEW.minimum_payment, NEW.payment_due_date, NEW.period_from, NEW.period_to,
    NEW.previous_balance, NEW.purchases_and_charges, NEW.remaining_balance,
    COALESCE(NEW.skipped_count, 0),
    zeta_encrypt(NEW.source_filename),
    NEW.total_credits, NEW.total_debits, NEW.total_payment_due,
    COALESCE(NEW.transaction_count, 0),
    COALESCE(NEW.updated_at, now()), NEW.user_id
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. capture_tokens_view_insert (no updated_at column)
CREATE OR REPLACE FUNCTION capture_tokens_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO capture_tokens_enc (
    created_at, default_account_id, id, label, last_used_at, revoked_at,
    token, token_hash, user_id
  ) VALUES (
    COALESCE(NEW.created_at, now()), NEW.default_account_id, COALESCE(NEW.id, gen_random_uuid()),
    zeta_encrypt(NEW.label),
    NEW.last_used_at, NEW.revoked_at,
    zeta_encrypt(NEW.token),
    encode(digest(NEW.token, 'sha256'), 'hex'),
    NEW.user_id
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. email_ingest_addresses_view_insert (no updated_at column)
CREATE OR REPLACE FUNCTION email_ingest_addresses_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO email_ingest_addresses_enc (
    account_id, address_key, allowed_sender, auto_import, created_at,
    gmail_verification_at, gmail_verification_url, id, is_active,
    pdf_import_enabled, user_id
  ) VALUES (
    NEW.account_id, NEW.address_key,
    zeta_encrypt(NEW.allowed_sender),
    COALESCE(NEW.auto_import, false),
    COALESCE(NEW.created_at, now()), NEW.gmail_verification_at,
    zeta_encrypt(NEW.gmail_verification_url),
    COALESCE(NEW.id, gen_random_uuid()),
    COALESCE(NEW.is_active, true),
    COALESCE(NEW.pdf_import_enabled, false),
    NEW.user_id
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. recurring_templates_view_insert (table: recurring_transaction_templates_enc)
CREATE OR REPLACE FUNCTION recurring_templates_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO recurring_transaction_templates_enc (
    account_id, amount, category_id, created_at, currency_code,
    day_of_month, day_of_week, description, direction, end_date,
    frequency, id, is_active, merchant_name, start_date,
    transfer_source_account_id, updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.category_id, COALESCE(NEW.created_at, now()),
    COALESCE(NEW.currency_code, 'COP'::currency_code),
    NEW.day_of_month, NEW.day_of_week,
    zeta_encrypt(NEW.description),
    NEW.direction, NEW.end_date, NEW.frequency, COALESCE(NEW.id, gen_random_uuid()),
    COALESCE(NEW.is_active, true),
    zeta_encrypt(NEW.merchant_name),
    NEW.start_date, NEW.transfer_source_account_id, COALESCE(NEW.updated_at, now()),
    NEW.user_id
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. wishlist_items_view_insert
CREATE OR REPLACE FUNCTION wishlist_items_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wishlist_items_enc (
    account_id, amount, bought_at, category_id, created_at, currency_code,
    desire_type, enriched, enriched_at, funding_type, id, image_url,
    installments, last_nudge_dismissed_at, last_score, last_scored_at,
    last_verdict, name, ready_at, status, transaction_id, updated_at,
    urgency, url, user_id, why
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.bought_at, NEW.category_id,
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.currency_code, 'COP'::text),
    NEW.desire_type,
    COALESCE(NEW.enriched, false),
    NEW.enriched_at, NEW.funding_type, COALESCE(NEW.id, gen_random_uuid()), NEW.image_url,
    NEW.installments, NEW.last_nudge_dismissed_at, NEW.last_score,
    NEW.last_scored_at, NEW.last_verdict,
    zeta_encrypt(NEW.name),
    NEW.ready_at,
    COALESCE(NEW.status, 'wishlist'::text),
    NEW.transaction_id, COALESCE(NEW.updated_at, now()),
    NEW.urgency,
    zeta_encrypt(NEW.url),
    NEW.user_id,
    zeta_encrypt(NEW.why)
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
