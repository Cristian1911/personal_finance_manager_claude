-- Add demo mode support: profile toggle + account/budget tagging
-- profiles and accounts are encrypted views — columns go on _enc tables,
-- then views and triggers must be rebuilt to include the new columns.

-- ─── 1. profiles_enc: add demo_mode ─────────────────────────────────────────

ALTER TABLE public.profiles_enc
  ADD COLUMN demo_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles_enc.demo_mode IS 'When true, dashboard shows demo data instead of real data';

-- Must drop + recreate view (can't add column mid-view with CREATE OR REPLACE)
DROP TRIGGER IF EXISTS profiles_view_insert_trg ON profiles;
DROP TRIGGER IF EXISTS profiles_view_update_trg ON profiles;
DROP TRIGGER IF EXISTS profiles_view_delete_trg ON profiles;
DROP VIEW IF EXISTS profiles;

CREATE VIEW profiles WITH (security_invoker = true) AS
SELECT
  app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
  demo_mode,
  zeta_decrypt(email) AS email,
  estimated_monthly_expenses, estimated_monthly_income,
  zeta_decrypt(full_name) AS full_name,
  id, locale, monthly_salary, onboarding_completed, preferred_currency,
  timezone, updated_at
FROM profiles_enc;

-- Rebuild INSERT trigger to include demo_mode
CREATE OR REPLACE FUNCTION profiles_view_insert() RETURNS TRIGGER AS $$
BEGIN
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
    zeta_encrypt(NEW.email),
    NEW.estimated_monthly_expenses, NEW.estimated_monthly_income,
    zeta_encrypt(NEW.full_name),
    NEW.id, NEW.locale, NEW.monthly_salary, NEW.onboarding_completed,
    NEW.preferred_currency, NEW.timezone, NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Rebuild UPDATE trigger to include demo_mode
CREATE OR REPLACE FUNCTION profiles_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles_enc SET
    app_purpose = NEW.app_purpose,
    avatar_url = NEW.avatar_url,
    budget_mode = NEW.budget_mode,
    created_at = NEW.created_at,
    dashboard_config = NEW.dashboard_config,
    demo_mode = NEW.demo_mode,
    email = zeta_encrypt(NEW.email),
    estimated_monthly_expenses = NEW.estimated_monthly_expenses,
    estimated_monthly_income = NEW.estimated_monthly_income,
    full_name = zeta_encrypt(NEW.full_name),
    locale = NEW.locale,
    monthly_salary = NEW.monthly_salary,
    onboarding_completed = NEW.onboarding_completed,
    preferred_currency = NEW.preferred_currency,
    timezone = NEW.timezone,
    updated_at = NEW.updated_at
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_view_insert_trg
  INSTEAD OF INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_insert();

CREATE TRIGGER profiles_view_update_trg
  INSTEAD OF UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_update();

CREATE OR REPLACE FUNCTION profiles_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM profiles_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_view_delete_trg
  INSTEAD OF DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_delete();

-- ─── 2. accounts_enc: add is_demo ──────────────────────────────────────────

ALTER TABLE public.accounts_enc
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.accounts_enc.is_demo IS 'Tags demo/mock accounts created for preview purposes';

-- Must drop + recreate view (can't add column mid-view with CREATE OR REPLACE)
DROP TRIGGER IF EXISTS accounts_view_insert_trg ON accounts;
DROP TRIGGER IF EXISTS accounts_view_update_trg ON accounts;
DROP TRIGGER IF EXISTS accounts_view_delete_trg ON accounts;
DROP VIEW IF EXISTS accounts;

CREATE VIEW accounts WITH (security_invoker = true) AS
SELECT
  account_type, available_balance, color, connection_status, created_at,
  credit_limit, currency_balances, currency_code, current_balance, cutoff_day,
  zeta_decrypt(debit_card_mask) AS debit_card_mask,
  display_order, expected_return_rate, icon, id, initial_investment,
  zeta_decrypt(institution_name) AS institution_name,
  interest_rate, is_active, is_demo, last_synced_at, loan_amount, loan_end_date,
  loan_start_date,
  zeta_decrypt(mask) AS mask,
  mask_hmac, maturity_date, monthly_payment,
  zeta_decrypt(name) AS name,
  payment_day,
  zeta_decrypt(pdf_password) AS pdf_password,
  provider,
  zeta_decrypt(provider_account_id) AS provider_account_id,
  provider_account_id_hmac, show_in_dashboard, updated_at, user_id
FROM accounts_enc;

-- Rebuild INSERT trigger to include is_demo
CREATE OR REPLACE FUNCTION accounts_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at := COALESCE(NEW.created_at, now()::text);
  NEW.updated_at := COALESCE(NEW.updated_at, now()::text);
  NEW.is_active := COALESCE(NEW.is_active, true);
  NEW.is_demo := COALESCE(NEW.is_demo, false);
  NEW.show_in_dashboard := COALESCE(NEW.show_in_dashboard, true);
  NEW.display_order := COALESCE(NEW.display_order, 0);
  NEW.connection_status := COALESCE(NEW.connection_status, 'CONNECTED');
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP');
  NEW.provider := COALESCE(NEW.provider, 'MANUAL');
  INSERT INTO accounts_enc (
    account_type, available_balance, color, connection_status, created_at,
    credit_limit, currency_balances, currency_code, current_balance, cutoff_day,
    debit_card_mask, display_order, expected_return_rate, icon, id,
    initial_investment, institution_name, interest_rate, is_active, is_demo,
    last_synced_at, loan_amount, loan_end_date, loan_start_date, mask,
    mask_hmac, maturity_date, monthly_payment, name, payment_day,
    pdf_password, provider, provider_account_id, provider_account_id_hmac,
    show_in_dashboard, updated_at, user_id
  ) VALUES (
    NEW.account_type, NEW.available_balance, NEW.color, NEW.connection_status,
    NEW.created_at, NEW.credit_limit, NEW.currency_balances, NEW.currency_code,
    NEW.current_balance, NEW.cutoff_day,
    zeta_encrypt(NEW.debit_card_mask),
    NEW.display_order, NEW.expected_return_rate, NEW.icon, NEW.id,
    NEW.initial_investment,
    zeta_encrypt(NEW.institution_name),
    NEW.interest_rate, NEW.is_active, NEW.is_demo, NEW.last_synced_at,
    NEW.loan_amount, NEW.loan_end_date, NEW.loan_start_date,
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

-- Rebuild UPDATE trigger to include is_demo
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

-- ─── 3. budgets: add is_demo (not encrypted, simple ALTER) ─────────────────

ALTER TABLE public.budgets
  ADD COLUMN is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.budgets.is_demo IS 'Tags demo/mock budgets created for preview purposes';

-- ─── 4. Indexes ────────────────────────────────────────────────────────────

CREATE INDEX idx_accounts_is_demo ON public.accounts_enc (user_id, is_demo) WHERE is_active = true;
CREATE INDEX idx_budgets_is_demo ON public.budgets (user_id, is_demo);
