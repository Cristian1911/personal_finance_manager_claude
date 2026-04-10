-- Add payroll-deducted flag for loan accounts (libranza, descuento de nómina).
-- When true, the import flow skips transaction creation and recurring template
-- sync because payments are deducted from salary before deposit.
--
-- is_payroll_deducted is NOT PII — plain boolean, no encryption needed.
-- But accounts is a view over accounts_enc, so we must:
--   1. ALTER accounts_enc
--   2. DROP triggers
--   3. DROP + recreate view
--   4. Rebuild INSERT trigger function
--   5. Rebuild UPDATE trigger function
--   6. Recreate triggers

-- ─── Step 1: Add column to real table ──────────────────────────────────────
ALTER TABLE accounts_enc
  ADD COLUMN is_payroll_deducted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.accounts_enc.is_payroll_deducted
  IS 'When true, loan payments are payroll-deducted (libranza) — import flow skips tx creation';

-- ─── Step 2: Drop INSTEAD OF triggers ──────────────────────────────────────
DROP TRIGGER IF EXISTS accounts_view_insert_trg ON accounts;
DROP TRIGGER IF EXISTS accounts_view_update_trg ON accounts;
DROP TRIGGER IF EXISTS accounts_view_delete_trg ON accounts;

-- ─── Step 3: Drop and recreate view with new column ────────────────────────
DROP VIEW IF EXISTS accounts;

CREATE VIEW accounts WITH (security_invoker = true) AS
SELECT
  account_type, available_balance, color, connection_status, created_at,
  credit_limit, currency_balances, currency_code, current_balance, cutoff_day,
  zeta_decrypt(debit_card_mask) AS debit_card_mask,
  display_order, expected_return_rate, icon, id, initial_investment,
  zeta_decrypt(institution_name) AS institution_name,
  interest_rate, is_active, is_demo, is_payroll_deducted, last_synced_at,
  loan_amount, loan_end_date, loan_start_date,
  zeta_decrypt(mask) AS mask,
  mask_hmac, maturity_date, monthly_payment,
  zeta_decrypt(name) AS name,
  payment_day,
  zeta_decrypt(pdf_password) AS pdf_password,
  provider,
  zeta_decrypt(provider_account_id) AS provider_account_id,
  provider_account_id_hmac, show_in_dashboard, updated_at, user_id
FROM accounts_enc;

-- ─── Step 4: Rebuild INSERT trigger function ───────────────────────────────
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
  NEW.is_demo := COALESCE(NEW.is_demo, false);
  NEW.is_payroll_deducted := COALESCE(NEW.is_payroll_deducted, false);

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
    zeta_encrypt(NEW.debit_card_mask),
    NEW.display_order, NEW.expected_return_rate, NEW.icon, NEW.id,
    NEW.initial_investment,
    zeta_encrypt(NEW.institution_name),
    NEW.interest_rate, NEW.is_active, NEW.is_demo, NEW.is_payroll_deducted,
    NEW.last_synced_at, NEW.loan_amount, NEW.loan_end_date, NEW.loan_start_date,
    zeta_encrypt(NEW.mask),
    zeta_hmac(NEW.mask),
    NEW.maturity_date, NEW.monthly_payment,
    zeta_encrypt(NEW.name),
    NEW.payment_day,
    zeta_encrypt(NEW.pdf_password),
    NEW.provider,
    zeta_encrypt(NEW.provider_account_id),
    zeta_hmac(NEW.provider_account_id),
    NEW.show_in_dashboard, NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Step 5: Rebuild UPDATE trigger function ───────────────────────────────
CREATE OR REPLACE FUNCTION accounts_view_update() RETURNS TRIGGER AS $$
BEGIN
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
    debit_card_mask = zeta_encrypt(NEW.debit_card_mask),
    display_order = NEW.display_order,
    expected_return_rate = NEW.expected_return_rate,
    icon = NEW.icon,
    initial_investment = NEW.initial_investment,
    institution_name = zeta_encrypt(NEW.institution_name),
    interest_rate = NEW.interest_rate,
    is_active = NEW.is_active,
    is_demo = NEW.is_demo,
    is_payroll_deducted = NEW.is_payroll_deducted,
    last_synced_at = NEW.last_synced_at,
    loan_amount = NEW.loan_amount,
    loan_end_date = NEW.loan_end_date,
    loan_start_date = NEW.loan_start_date,
    mask = zeta_encrypt(NEW.mask),
    mask_hmac = zeta_hmac(NEW.mask),
    maturity_date = NEW.maturity_date,
    monthly_payment = NEW.monthly_payment,
    name = zeta_encrypt(NEW.name),
    payment_day = NEW.payment_day,
    pdf_password = zeta_encrypt(NEW.pdf_password),
    provider = NEW.provider,
    provider_account_id = zeta_encrypt(NEW.provider_account_id),
    provider_account_id_hmac = zeta_hmac(NEW.provider_account_id),
    show_in_dashboard = NEW.show_in_dashboard,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Step 6: Recreate all three triggers ───────────────────────────────────
CREATE TRIGGER accounts_view_insert_trg
  INSTEAD OF INSERT ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_insert();

CREATE TRIGGER accounts_view_update_trg
  INSTEAD OF UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_update();

CREATE OR REPLACE FUNCTION accounts_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM accounts_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_view_delete_trg
  INSTEAD OF DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_delete();

-- ─── Permissions ───────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO authenticated;
GRANT ALL ON accounts TO postgres, service_role;
