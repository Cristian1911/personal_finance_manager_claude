-- ===========================================================================
-- Fix: User signup broken after envelope encryption migration
--
-- Three cascading issues:
--   1. profiles_view_insert() references non-existent salary_currency column
--      and is missing app_purpose, avatar_url, budget_mode, estimated_monthly_expenses
--   2. zeta_encrypt() uses auth.uid() which is NULL during signup triggers
--   3. Trigger ordering: on_auth_user_created fires before DEK creation
--
-- Fix: Replace handle_new_user() to create DEK inline and insert directly
-- into profiles_enc using pgp_sym_encrypt (bypasses view + zeta_encrypt).
-- Also fix profiles_view_insert() to restore full column list.
-- ===========================================================================

-- 1. Replace handle_new_user() — creates DEK + profile in one atomic trigger
--    (this function was originally created via the Supabase dashboard, not tracked
--    in migrations — using CREATE OR REPLACE + defensive DROP TRIGGER below)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- 2. Ensure on_auth_user_created trigger exists and points to fixed function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Make handle_new_user_encryption_key() idempotent (ON CONFLICT DO NOTHING)
--    so it doesn't fail if handle_new_user() already created the DEK
CREATE OR REPLACE FUNCTION handle_new_user_encryption_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

-- 4. Fix profiles_view_insert() — restore full column list from 20260408120000
--    (the version from 20260408143013 dropped app_purpose, avatar_url, budget_mode,
--    demo_mode, estimated_monthly_expenses and added non-existent salary_currency)
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
