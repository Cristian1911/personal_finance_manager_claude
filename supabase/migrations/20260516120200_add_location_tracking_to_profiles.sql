-- ============================================================================
-- Add location_tracking_enabled to profiles
--
-- Plain boolean column on profiles_enc, passed through unencrypted in the view
-- + INSTEAD OF triggers. Drives whether the mobile app records location pings
-- in the background and links them to new transactions.
--
-- Default FALSE — opt-in only.
--
-- Pattern (mirrors 20260428120000_add_nav_focus_to_profiles.sql).
-- ============================================================================

ALTER TABLE public.profiles_enc
  ADD COLUMN location_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles_enc.location_tracking_enabled IS
  'Opt-in flag: when TRUE, the mobile app records background location pings and links the nearest one to each new transaction.';

-- Drop triggers + view so we can recreate with the new column
DROP TRIGGER IF EXISTS profiles_view_insert_trg ON public.profiles;
DROP TRIGGER IF EXISTS profiles_view_update_trg ON public.profiles;
DROP TRIGGER IF EXISTS profiles_view_delete_trg ON public.profiles;
DROP VIEW IF EXISTS public.profiles;

-- Recreate view including location_tracking_enabled (plain passthrough)
CREATE VIEW public.profiles WITH (security_invoker = true) AS
SELECT
  app_purpose, avatar_url, budget_mode, created_at, dashboard_config,
  mobile_dashboard_config,
  demo_mode,
  zeta_decrypt(email) AS email,
  estimated_monthly_expenses, estimated_monthly_income,
  zeta_decrypt(full_name) AS full_name,
  id, locale, location_tracking_enabled, monthly_salary, nav_focus,
  onboarding_completed, preferred_currency, timezone, updated_at
FROM public.profiles_enc;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO postgres, service_role;

-- Rebuild INSERT trigger fn — preserves has_auth guard from 20260417193237
CREATE OR REPLACE FUNCTION public.profiles_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
$function$;

-- Rebuild UPDATE trigger fn — preserves has_auth + SELECT INTO refactor
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
$function$;

-- DELETE fn unchanged — recreate triggers only
CREATE TRIGGER profiles_view_insert_trg
  INSTEAD OF INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_view_insert();

CREATE TRIGGER profiles_view_update_trg
  INSTEAD OF UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_view_update();

CREATE TRIGGER profiles_view_delete_trg
  INSTEAD OF DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_view_delete();
