-- ==================================================
-- Encrypt accounts table (6 encrypted, 1 HMAC)
-- ==================================================

-- 1. Rename
ALTER TABLE accounts RENAME TO accounts_enc;

-- 2. Drop indexes that reference encrypted columns (incompatible with BYTEA)
DROP INDEX IF EXISTS accounts_provider_unique;
DROP INDEX IF EXISTS idx_accounts_user_debit_card_mask;

-- 3. Add HMAC columns and backfill
ALTER TABLE accounts_enc ADD COLUMN mask_hmac TEXT;
ALTER TABLE accounts_enc ADD COLUMN provider_account_id_hmac TEXT;
UPDATE accounts_enc SET mask_hmac = zeta_hmac_as(mask, user_id) WHERE mask IS NOT NULL;
UPDATE accounts_enc SET provider_account_id_hmac = zeta_hmac_as(provider_account_id, user_id) WHERE provider_account_id IS NOT NULL;

-- 4. Encrypt columns
ALTER TABLE accounts_enc
  ALTER COLUMN name TYPE BYTEA USING zeta_encrypt_as(name, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN institution_name TYPE BYTEA USING zeta_encrypt_as(institution_name, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN mask TYPE BYTEA USING zeta_encrypt_as(mask, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN debit_card_mask TYPE BYTEA USING zeta_encrypt_as(debit_card_mask, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN pdf_password TYPE BYTEA USING zeta_encrypt_as(pdf_password, user_id);
ALTER TABLE accounts_enc
  ALTER COLUMN provider_account_id TYPE BYTEA USING zeta_encrypt_as(provider_account_id, user_id);

-- 4. Create decrypted view
CREATE VIEW accounts WITH (security_invoker = true) AS
SELECT
  account_type, available_balance, color, connection_status, created_at,
  credit_limit, currency_balances, currency_code, current_balance, cutoff_day,
  zeta_decrypt(debit_card_mask) AS debit_card_mask,
  display_order, expected_return_rate, icon, id, initial_investment,
  zeta_decrypt(institution_name) AS institution_name,
  interest_rate, is_active, last_synced_at, loan_amount, loan_end_date,
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

-- 5. INSTEAD OF INSERT
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
    NEW.account_type, NEW.available_balance, NEW.color, NEW.connection_status,
    NEW.created_at, NEW.credit_limit, NEW.currency_balances, NEW.currency_code,
    NEW.current_balance, NEW.cutoff_day,
    zeta_encrypt(NEW.debit_card_mask),
    NEW.display_order, NEW.expected_return_rate, NEW.icon, NEW.id,
    NEW.initial_investment,
    zeta_encrypt(NEW.institution_name),
    NEW.interest_rate, NEW.is_active, NEW.last_synced_at, NEW.loan_amount,
    NEW.loan_end_date, NEW.loan_start_date,
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

CREATE TRIGGER accounts_view_insert_trg
  INSTEAD OF INSERT ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_insert();

-- 6. INSTEAD OF UPDATE
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
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_view_update_trg
  INSTEAD OF UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_update();

-- 7. INSTEAD OF DELETE
CREATE OR REPLACE FUNCTION accounts_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM accounts_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_view_delete_trg
  INSTEAD OF DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounts_view_delete();

-- 8. Recreate unique constraint using HMAC (original used plaintext provider_account_id)
CREATE UNIQUE INDEX accounts_provider_unique
  ON accounts_enc (user_id, provider, provider_account_id_hmac)
  WHERE provider_account_id_hmac IS NOT NULL;

-- 9. Grant
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO authenticated;
GRANT ALL ON accounts TO postgres, service_role;
