-- ===========================================================================
-- Scheduled cleanup of abandoned anonymous demo users
--
-- PRs #205/#206 added two landing-page CTAs that create anonymous Supabase
-- users ("Ver demo" and "Usar sin cuenta"). Each click inserts a real
-- auth.users row + encrypted profile + (optional) seeded demo data.
-- Without cleanup these accumulate forever and count against MAU billing.
--
-- Policy: delete anonymous users that haven't signed in during the last
-- 7 days. Short enough to stop MAU creep, long enough that a visitor
-- returning the next day still has their session.
--
-- FK cascades handle the rest — profiles_enc, accounts, transactions,
-- budgets, user_encryption_keys, destinatarios_enc, recurring_*, etc. all
-- reference auth.users(id) ON DELETE CASCADE.
-- ===========================================================================

-- The original budgets table predates ON DELETE CASCADE as a default and was
-- created with plain `REFERENCES auth.users` (NO ACTION). That blocks any
-- DELETE on auth.users that belongs to a user with seeded demo budgets,
-- which would defeat the cron below. Fix it here so the cascade works.
ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_user_id_fkey,
  ADD CONSTRAINT budgets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- SECURITY DEFINER so it can DELETE from auth.users. Ownership stays with
-- the migration runner (postgres / supabase_admin), execution restricted to
-- service_role + the cron invoker below.
CREATE OR REPLACE FUNCTION public.cleanup_anonymous_demo_users(
  p_older_than INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

COMMENT ON FUNCTION public.cleanup_anonymous_demo_users(INTERVAL) IS
  'Deletes anonymous users idle longer than p_older_than. Scheduled daily via pg_cron; safe to invoke manually too.';

REVOKE ALL ON FUNCTION public.cleanup_anonymous_demo_users(INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_anonymous_demo_users(INTERVAL) TO service_role;

-- Reschedule idempotently: drop any prior job with this name, then create fresh.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-anonymous-demo-users') THEN
    PERFORM cron.unschedule('cleanup-anonymous-demo-users');
  END IF;
END $$;

-- Daily at 07:00 UTC (02:00 Colombia time) — off-peak for the app.
SELECT cron.schedule(
  'cleanup-anonymous-demo-users',
  '0 7 * * *',
  $$SELECT public.cleanup_anonymous_demo_users(interval '7 days')$$
);
