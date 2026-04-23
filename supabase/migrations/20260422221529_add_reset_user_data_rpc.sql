-- ============================================================================
-- public.reset_user_data() — wipe all user-scoped data for the calling user
--
-- Keeps auth.users, user_encryption_keys, and the profile row (reset) so the
-- user can re-run onboarding from the same account. The webapp and mobile
-- clients call this via `supabase.rpc('reset_user_data')` from a "Reset
-- account" action in Settings.
--
-- Ordering strategy:
--   1. Delete from dependent / leaf tables first (tags join tables, rules,
--      email ingest, planning, debt, reminders, etc.).
--   2. Delete from `destinatarios` (cascades to destinatario_rules,
--      destinatario_tags) — must run BEFORE accounts because
--      recurring_transaction_templates has destinatario_id ON DELETE SET NULL
--      and we want a clean cascade from accounts next.
--   3. Delete from `accounts` (view → accounts_enc) which cascades to
--      transactions_enc, statement_snapshots, recurring_transaction_templates_enc
--      (→ recurring_occurrences, recurring_occurrence_skips,
--      recurring_template_tags), pdf_passwords_enc. It also SET NULLs
--      account_id on email_ingest rows, planning_entries, wishlist_items,
--      capture_tokens — but we've already deleted those above.
--   4. Delete user tag rows (is_system = false) — system tags stay intact.
--   5. Reset the profile via the `profiles` view so the INSTEAD OF UPDATE
--      trigger re-encrypts cleared fields under the user's DEK.
--
-- Categories are NOT re-seeded: they are system rows (user_id NULL) shared
-- across all users. No per-user seed function exists in this project, so
-- once transactions/budgets/etc. are gone the user starts from a clean slate.
--
-- Granted to `authenticated` only so PostgREST exposes it via rpc(). All
-- deletes run under SECURITY DEFINER but each DELETE is scoped by
-- `user_id = v_user_id`, so a caller can only wipe their own data.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- --------------------------------------------------------------------------
  -- 1. Leaf tables / tag joins (no inbound user cascades to wait for)
  -- --------------------------------------------------------------------------

  -- Tag join tables: these don't all have a user_id column, so scope via
  -- the parent. category_tags has no user_id — it references `categories`
  -- (shared) AND `tags` (user-owned); clear rows where the tag is the user's.
  DELETE FROM public.category_tags
    WHERE tag_id IN (
      SELECT id FROM public.tags WHERE user_id = v_user_id
    );

  -- transaction_tags, destinatario_tags, recurring_template_tags: these
  -- cascade from transactions / destinatarios / recurring_templates and
  -- will be wiped when we delete those parents. We still delete explicitly
  -- (defensive, cheap, and guards against missing cascades):
  DELETE FROM public.transaction_tags       WHERE user_id = v_user_id;
  DELETE FROM public.destinatario_tags
    WHERE destinatario_id IN (
      SELECT id FROM public.destinatarios WHERE user_id = v_user_id
    );
  DELETE FROM public.recurring_template_tags WHERE user_id = v_user_id;

  -- --------------------------------------------------------------------------
  -- 2. Planning / budgets / debt / reminders / wishlist
  -- --------------------------------------------------------------------------
  DELETE FROM public.planning_assignments     WHERE user_id = v_user_id;
  DELETE FROM public.planning_entries         WHERE user_id = v_user_id;
  DELETE FROM public.planning_periods         WHERE user_id = v_user_id;

  DELETE FROM public.budgets                  WHERE user_id = v_user_id;

  DELETE FROM public.debt_scenarios           WHERE user_id = v_user_id;

  DELETE FROM public.financial_reminders      WHERE user_id = v_user_id;

  DELETE FROM public.obligation_skips         WHERE user_id = v_user_id;
  -- recurring_occurrence_skips + recurring_occurrences cascade from the
  -- recurring template delete (via accounts), but delete defensively:
  DELETE FROM public.recurring_occurrence_skips WHERE user_id = v_user_id;
  DELETE FROM public.recurring_occurrences    WHERE user_id = v_user_id;

  DELETE FROM public.wishlist_reflections     WHERE user_id = v_user_id;
  DELETE FROM public.wishlist_items           WHERE user_id = v_user_id;

  -- --------------------------------------------------------------------------
  -- 3. Email ingest / capture / unrecognized
  -- --------------------------------------------------------------------------
  DELETE FROM public.pending_email_transactions  WHERE user_id = v_user_id;
  DELETE FROM public.pending_email_statements    WHERE user_id = v_user_id;
  DELETE FROM public.email_ingest_allowed_senders WHERE user_id = v_user_id;
  -- email_ingest_logs.user_id is nullable (ON DELETE SET NULL) — still clear:
  DELETE FROM public.email_ingest_logs           WHERE user_id = v_user_id;
  DELETE FROM public.email_ingest_addresses      WHERE user_id = v_user_id;

  DELETE FROM public.unrecognized_emails         WHERE user_id = v_user_id;

  DELETE FROM public.capture_tokens              WHERE user_id = v_user_id;

  -- Analytics — clear to keep the reset clean. bug_reports intentionally
  -- preserved (support value).
  DELETE FROM public.product_events              WHERE user_id = v_user_id;

  -- --------------------------------------------------------------------------
  -- 4. Destinatarios (cascades to destinatario_rules + destinatario_tags)
  --    Must run before accounts so recurring_template.destinatario_id
  --    references are cleared before the templates themselves are cascade-
  --    deleted (SET NULL would fire otherwise — harmless but noisier).
  -- --------------------------------------------------------------------------
  DELETE FROM public.destinatarios               WHERE user_id = v_user_id;

  -- Any orphan category_rules (user-owned regex rules) — predates destinatarios
  DELETE FROM public.category_rules              WHERE user_id = v_user_id;

  -- --------------------------------------------------------------------------
  -- 5. Accounts (view → accounts_enc). Cascade chain:
  --      accounts_enc
  --        → transactions_enc (→ transaction_tags)
  --        → statement_snapshots
  --        → recurring_transaction_templates_enc
  --            → recurring_occurrences
  --            → recurring_occurrence_skips
  --            → recurring_template_tags
  --        → pdf_passwords_enc
  -- --------------------------------------------------------------------------
  DELETE FROM public.accounts                    WHERE user_id = v_user_id;

  -- --------------------------------------------------------------------------
  -- 6. User-owned tags + tag groups (preserve system rows where
  --    is_system = true and user_id IS NULL)
  -- --------------------------------------------------------------------------
  DELETE FROM public.tags        WHERE user_id = v_user_id AND is_system = false;
  DELETE FROM public.tag_groups  WHERE user_id = v_user_id AND is_system = false;

  -- --------------------------------------------------------------------------
  -- 7. Reset profile via the view — INSTEAD OF UPDATE trigger handles the
  --    re-encryption under the caller's DEK. PRESERVE: id, email, created_at,
  --    demo_mode, monthly_salary (ambiguous — cleared for clean slate too).
  -- --------------------------------------------------------------------------
  UPDATE public.profiles SET
    full_name                   = NULL,
    app_purpose                 = NULL,
    avatar_url                  = NULL,
    budget_mode                 = NULL,
    estimated_monthly_income    = NULL,
    estimated_monthly_expenses  = NULL,
    monthly_salary              = NULL,
    preferred_currency          = 'COP',
    timezone                    = NULL,
    locale                      = NULL,
    onboarding_completed        = false,
    dashboard_config            = NULL,
    mobile_dashboard_config     = NULL,
    updated_at                  = now()::text
  WHERE id = v_user_id;
END;
$$;

-- Expose to authenticated clients only. Deny public/anon explicitly.
REVOKE ALL ON FUNCTION public.reset_user_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_user_data() FROM anon;
GRANT  EXECUTE ON FUNCTION public.reset_user_data() TO authenticated;

COMMENT ON FUNCTION public.reset_user_data() IS
  'Wipes all user-scoped data for the calling user (auth.uid()) and resets '
  'the profile to onboarding defaults. Keeps auth.users + encryption DEK so '
  'the user can re-run onboarding from the same account. Callable from '
  'clients via supabase.rpc(''reset_user_data'').';
