-- ==================================================
-- Encrypt profiles table (2 encrypted)
-- ==================================================

ALTER TABLE profiles RENAME TO profiles_enc;

ALTER TABLE profiles_enc
  ALTER COLUMN full_name TYPE BYTEA USING zeta_encrypt_as(full_name, id);
ALTER TABLE profiles_enc
  ALTER COLUMN email TYPE BYTEA USING zeta_encrypt_as(email, id);

CREATE VIEW profiles WITH (security_invoker = true) AS
SELECT
  app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
  zeta_decrypt(email) AS email,
  estimated_monthly_expenses, estimated_monthly_income,
  zeta_decrypt(full_name) AS full_name,
  id, locale, monthly_salary, onboarding_completed, preferred_currency,
  timezone, updated_at
FROM profiles_enc;

CREATE OR REPLACE FUNCTION profiles_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles_enc (
    app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
    email, estimated_monthly_expenses, estimated_monthly_income, full_name,
    id, locale, monthly_salary, onboarding_completed, preferred_currency,
    timezone, updated_at
  ) VALUES (
    NEW.app_purpose, NEW.avatar_url, NEW.budget_mode, NEW.created_at,
    NEW.dashboard_config,
    zeta_encrypt(NEW.email),
    NEW.estimated_monthly_expenses, NEW.estimated_monthly_income,
    zeta_encrypt(NEW.full_name),
    NEW.id, NEW.locale, NEW.monthly_salary, NEW.onboarding_completed,
    NEW.preferred_currency, NEW.timezone, NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_view_insert_trg
  INSTEAD OF INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_view_insert();

CREATE OR REPLACE FUNCTION profiles_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles_enc SET
    app_purpose = NEW.app_purpose,
    avatar_url = NEW.avatar_url,
    budget_mode = NEW.budget_mode,
    created_at = NEW.created_at,
    dashboard_config = NEW.dashboard_config,
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

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT ALL ON profiles TO postgres, service_role;
