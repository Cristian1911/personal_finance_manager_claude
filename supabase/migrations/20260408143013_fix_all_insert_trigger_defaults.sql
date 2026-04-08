-- ===========================================================================
-- Fix: INSERT triggers assign defaults to NEW before INSERT, no RETURNING
--
-- Previous approach used COALESCE inline + RETURNING * INTO NEW, but
-- RETURNING * from _enc tables has BYTEA columns that don't match the
-- view's TEXT structure → "returned row structure does not match"
--
-- Correct approach: assign COALESCE'd defaults to NEW fields first,
-- then INSERT using NEW.* (already defaulted), RETURN NEW as-is.
-- ===========================================================================

-- 1. transactions
CREATE OR REPLACE FUNCTION transactions_view_insert() RETURNS TRIGGER AS $$
BEGIN
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

-- 2. accounts
CREATE OR REPLACE FUNCTION accounts_view_insert() RETURNS TRIGGER AS $$
BEGIN
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

  INSERT INTO accounts_enc (
    account_type, color, connection_status, created_at, credit_limit,
    currency_balances, currency_code, current_balance, debit_card_mask,
    display_order, expected_return_rate, icon, id, institution_name,
    interest_rate, is_active, mask, monthly_payment, name, pdf_password,
    provider, provider_account_id, provider_account_id_hmac,
    show_in_dashboard, updated_at, user_id, mask_hmac
  ) VALUES (
    NEW.account_type, NEW.color, NEW.connection_status, NEW.created_at,
    NEW.credit_limit, NEW.currency_balances, NEW.currency_code,
    NEW.current_balance, zeta_encrypt(NEW.debit_card_mask),
    NEW.display_order, NEW.expected_return_rate, NEW.icon, NEW.id,
    zeta_encrypt(NEW.institution_name), NEW.interest_rate, NEW.is_active,
    zeta_encrypt(NEW.mask), NEW.monthly_payment, zeta_encrypt(NEW.name),
    zeta_encrypt(NEW.pdf_password), NEW.provider,
    zeta_encrypt(NEW.provider_account_id),
    zeta_hmac(NEW.provider_account_id), NEW.show_in_dashboard,
    NEW.updated_at, NEW.user_id, zeta_hmac(NEW.mask)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. profiles (id is auth.users FK — never defaulted)
CREATE OR REPLACE FUNCTION profiles_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.preferred_currency := COALESCE(NEW.preferred_currency, 'COP'::currency_code);
  NEW.locale := COALESCE(NEW.locale, 'es-CO'::text);
  NEW.timezone := COALESCE(NEW.timezone, 'America/Bogota'::text);
  NEW.onboarding_completed := COALESCE(NEW.onboarding_completed, false);

  INSERT INTO profiles_enc (
    id, full_name, email, preferred_currency, locale, timezone,
    onboarding_completed, created_at, updated_at, dashboard_config,
    monthly_salary, estimated_monthly_income, salary_currency
  ) VALUES (
    NEW.id, zeta_encrypt(NEW.full_name), zeta_encrypt(NEW.email),
    NEW.preferred_currency, NEW.locale, NEW.timezone,
    NEW.onboarding_completed, NEW.created_at, NEW.updated_at,
    NEW.dashboard_config, NEW.monthly_salary,
    NEW.estimated_monthly_income, NEW.salary_currency
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. destinatarios
CREATE OR REPLACE FUNCTION destinatarios_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.is_active := COALESCE(NEW.is_active, true);

  INSERT INTO destinatarios_enc (
    id, user_id, name, name_hmac, notes, default_category_id,
    is_active, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id, zeta_encrypt(NEW.name), zeta_hmac(NEW.name),
    zeta_encrypt(NEW.notes), NEW.default_category_id, NEW.is_active,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. statement_snapshots
CREATE OR REPLACE FUNCTION statement_snapshots_view_insert() RETURNS TRIGGER AS $$
BEGIN
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
    NEW.skipped_count, zeta_encrypt(NEW.loan_number),
    zeta_encrypt(NEW.source_filename), NEW.currency_code,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. capture_tokens
CREATE OR REPLACE FUNCTION capture_tokens_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());

  INSERT INTO capture_tokens_enc (
    id, user_id, token, token_hash, label, default_account_id, created_at
  ) VALUES (
    NEW.id, NEW.user_id, zeta_encrypt(NEW.token),
    encode(digest(NEW.token, 'sha256'), 'hex'),
    zeta_encrypt(NEW.label), NEW.default_account_id, NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. email_ingest_addresses
CREATE OR REPLACE FUNCTION email_ingest_addresses_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.auto_import := COALESCE(NEW.auto_import, false);
  NEW.is_active := COALESCE(NEW.is_active, true);
  NEW.pdf_import_enabled := COALESCE(NEW.pdf_import_enabled, false);

  INSERT INTO email_ingest_addresses_enc (
    id, user_id, address_key, allowed_sender, default_account_id,
    auto_import, is_active, gmail_verification_url, created_at,
    pdf_import_enabled
  ) VALUES (
    NEW.id, NEW.user_id, NEW.address_key,
    zeta_encrypt(NEW.allowed_sender), NEW.default_account_id,
    NEW.auto_import, NEW.is_active,
    zeta_encrypt(NEW.gmail_verification_url), NEW.created_at,
    NEW.pdf_import_enabled
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. recurring_transaction_templates
CREATE OR REPLACE FUNCTION recurring_templates_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP'::currency_code);
  NEW.is_active := COALESCE(NEW.is_active, true);

  INSERT INTO recurring_transaction_templates_enc (
    id, user_id, account_id, amount, currency_code, direction,
    frequency, day_of_month, day_of_week, merchant_name, description,
    category_id, is_active, start_date, end_date, last_occurrence_date,
    next_occurrence_date, created_at, updated_at,
    transfer_source_account_id
  ) VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.amount, NEW.currency_code,
    NEW.direction, NEW.frequency, NEW.day_of_month, NEW.day_of_week,
    zeta_encrypt(NEW.merchant_name), zeta_encrypt(NEW.description),
    NEW.category_id, NEW.is_active, NEW.start_date, NEW.end_date,
    NEW.last_occurrence_date, NEW.next_occurrence_date,
    NEW.created_at, NEW.updated_at, NEW.transfer_source_account_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. wishlist_items
CREATE OR REPLACE FUNCTION wishlist_items_view_insert() RETURNS TRIGGER AS $$
BEGIN
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
    NEW.id, NEW.user_id, zeta_encrypt(NEW.name), zeta_encrypt(NEW.url),
    NEW.price, NEW.currency_code, zeta_encrypt(NEW.why),
    NEW.status, NEW.enriched, NEW.enrichment_data, NEW.score_data,
    NEW.created_at, NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
