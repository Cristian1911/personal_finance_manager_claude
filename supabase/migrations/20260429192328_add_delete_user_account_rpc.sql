-- ============================================================================
-- public.delete_user_account() — self-service account deletion for the
-- calling user. Required by Apple App Review Guideline 5.1.1(v): apps that
-- support account creation must offer in-app account deletion (not just an
-- email-based request flow).
--
-- Strategy:
--   1. Reuse public.reset_user_data() to wipe app-scoped tables that don't
--      have ON DELETE CASCADE from auth.users (defense in depth).
--   2. DELETE the auth.users row. Cascades handle profiles_enc, accounts,
--      transactions_enc, budgets, destinatarios_enc, recurring_*, etc.
--
-- SECURITY DEFINER + ownership stays with the migration runner (postgres /
-- supabase_admin) so the function has privilege to DELETE from auth.users.
-- The body re-checks `auth.uid()` so a caller can only delete THEIR OWN
-- account — never another user's.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Wipe app-scoped tables (idempotent; safe to call before delete).
  PERFORM public.reset_user_data();

  -- Cascade-delete the auth row. profiles_enc, accounts, transactions_enc,
  -- budgets, etc. all REFERENCE auth.users(id) ON DELETE CASCADE.
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account() FROM anon;
GRANT  EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

COMMENT ON FUNCTION public.delete_user_account() IS
  'Self-service account deletion for the calling auth.uid(). Wipes app data '
  'via reset_user_data() then deletes the auth.users row (cascades the rest). '
  'Required by Apple App Store Guideline 5.1.1(v).';
