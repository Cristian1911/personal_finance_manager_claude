-- ===========================================================================
-- Fix: accounts INSERT and UPDATE triggers to support admin client
--
-- Same pattern as 20260411043607 (transactions triggers): when auth.uid()
-- is NULL (admin/service_role client), fall back to zeta_encrypt_as() /
-- zeta_hmac_as() with explicit user_id from NEW.user_id.
--
-- The email webhook updates accounts.current_balance via admin client.
-- Without this fix, the UPDATE trigger re-encrypts ALL columns using
-- zeta_encrypt() which fails when auth.uid() is NULL, or — worse — the
-- OLD values from the view are NULL (admin can't decrypt), causing
-- encrypted column data (name, mask, etc.) to be overwritten with NULL.
-- ===========================================================================

-- 1. Fix INSERT trigger
CREATE OR REPLACE FUNCTION accounts_view_insert() RETURNS TRIGGER AS $$
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

  INSERT INTO accounts_enc (
    account_type, available_balance, color, connection_status, created_at,
    credit_limit, currency_balances, currency_code, current_balance, cutoff_day,
    debit_card_mask, display_order, expected_return_rate, icon, id,
    initial_investment, institution_name, interest_rate, is_active, is_demo,
    is_payroll_deducted, last_synced_at, loan_amount, loan_end_date,
    loan_start_date, mask, mask_hmac, maturity_date, monthly_payment, name,
    payment_day, pdf_password, provider, provider_account_id,
    provider_account_id_hmac, show_in_dashboard, updated_at, user_id
  ) VALUES (
    NEW.account_type, NEW.available_balance, NEW.color, NEW.connection_status,
    NEW.created_at, NEW.credit_limit, NEW.currency_balances, NEW.currency_code,
    NEW.current_balance, NEW.cutoff_day,
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
$$ LANGUAGE plpgsql;

-- 2. Fix UPDATE trigger
CREATE OR REPLACE FUNCTION accounts_view_update() RETURNS TRIGGER AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE accounts_enc SET
    account_type = NEW.account_type,
    available_balance = NEW.available_balance,
    color = NEW.color,
    connection_status = NEW.connection_status,
    created_at = NEW.created_at,
    credit_limit = NEW.credit_limit,
    currency_balances = NEW.currency_balances,
    currency_code = NEW.currency_code,
    current_balance = NEW.current_balance,
    cutoff_day = NEW.cutoff_day,
    debit_card_mask = CASE WHEN has_auth THEN zeta_encrypt(NEW.debit_card_mask) ELSE zeta_encrypt_as(NEW.debit_card_mask, NEW.user_id) END,
    display_order = NEW.display_order,
    expected_return_rate = NEW.expected_return_rate,
    icon = NEW.icon,
    initial_investment = NEW.initial_investment,
    institution_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.institution_name) ELSE zeta_encrypt_as(NEW.institution_name, NEW.user_id) END,
    interest_rate = NEW.interest_rate,
    is_active = NEW.is_active,
    is_demo = NEW.is_demo,
    is_payroll_deducted = NEW.is_payroll_deducted,
    last_synced_at = NEW.last_synced_at,
    loan_amount = NEW.loan_amount,
    loan_end_date = NEW.loan_end_date,
    loan_start_date = NEW.loan_start_date,
    mask = CASE WHEN has_auth THEN zeta_encrypt(NEW.mask) ELSE zeta_encrypt_as(NEW.mask, NEW.user_id) END,
    mask_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.mask) ELSE zeta_hmac_as(NEW.mask, NEW.user_id) END,
    maturity_date = NEW.maturity_date,
    monthly_payment = NEW.monthly_payment,
    name = CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE zeta_encrypt_as(NEW.name, NEW.user_id) END,
    payment_day = NEW.payment_day,
    pdf_password = CASE WHEN has_auth THEN zeta_encrypt(NEW.pdf_password) ELSE zeta_encrypt_as(NEW.pdf_password, NEW.user_id) END,
    provider = NEW.provider,
    provider_account_id = CASE WHEN has_auth THEN zeta_encrypt(NEW.provider_account_id) ELSE zeta_encrypt_as(NEW.provider_account_id, NEW.user_id) END,
    provider_account_id_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.provider_account_id) ELSE zeta_hmac_as(NEW.provider_account_id, NEW.user_id) END,
    show_in_dashboard = NEW.show_in_dashboard,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
