-- ============================================================================
-- Replace `public.reset_user_data()` with a version that guards every DELETE
-- with `to_regclass()`, so renamed/dropped tables (like the skips tables that
-- went through the obligation_skips rename and were later deleted entirely)
-- don't abort the whole wipe.
--
-- Parent-scoped join tables (`category_tags`, `destinatario_tags`) get their
-- own branch. Everything else is a simple `WHERE user_id = $1` delete driven
-- by a single array so future schema additions are a one-line change.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_table   text;
  -- Ordered so parent tables come AFTER their dependents where it matters,
  -- but cascades do most of the heavy lifting — we only enumerate tables we
  -- want to wipe explicitly so nothing is left behind by a missing cascade.
  v_user_scoped_tables constant text[] := ARRAY[
    -- Tag joins scoped by user_id directly
    'transaction_tags',
    'recurring_template_tags',

    -- Planning / budgets / debt / reminders
    'planning_assignments',
    'planning_entries',
    'planning_periods',
    'budgets',
    'debt_scenarios',
    'financial_reminders',

    -- Recurring occurrences & any legacy skip tables (historical churn)
    'recurring_occurrence_skips',
    'obligation_skips',
    'recurring_occurrences',

    -- Wishlist
    'wishlist_reflections',
    'wishlist_items',

    -- Email ingest / capture / analytics
    'pending_email_transactions',
    'pending_email_statements',
    'email_ingest_allowed_senders',
    'email_ingest_logs',
    'email_ingest_addresses',
    'unrecognized_emails',
    'capture_tokens',
    'product_events',

    -- Destinatarios (cascades destinatario_rules + destinatario_tags)
    'destinatarios',
    'category_rules',

    -- Accounts last: cascades transactions_enc, statement_snapshots,
    -- recurring_transaction_templates_enc, pdf_passwords_enc, etc.
    'accounts'
  ];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Parent-scoped joins (no user_id column of their own)
  IF to_regclass('public.category_tags') IS NOT NULL THEN
    DELETE FROM public.category_tags
      WHERE tag_id IN (
        SELECT id FROM public.tags WHERE user_id = v_user_id
      );
  END IF;

  IF to_regclass('public.destinatario_tags') IS NOT NULL THEN
    DELETE FROM public.destinatario_tags
      WHERE destinatario_id IN (
        SELECT id FROM public.destinatarios WHERE user_id = v_user_id
      );
  END IF;

  -- Simple user_id-scoped deletes
  FOREACH v_table IN ARRAY v_user_scoped_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table)
        USING v_user_id;
    END IF;
  END LOOP;

  -- User-owned tags + tag groups (preserve is_system rows)
  IF to_regclass('public.tags') IS NOT NULL THEN
    DELETE FROM public.tags
      WHERE user_id = v_user_id AND is_system = false;
  END IF;
  IF to_regclass('public.tag_groups') IS NOT NULL THEN
    DELETE FROM public.tag_groups
      WHERE user_id = v_user_id AND is_system = false;
  END IF;

  -- Reset profile via the view (INSTEAD OF UPDATE trigger re-encrypts).
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
