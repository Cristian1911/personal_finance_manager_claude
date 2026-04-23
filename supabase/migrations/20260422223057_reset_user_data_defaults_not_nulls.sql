-- Fix: `profiles_enc.locale` (and likely `timezone`) carry NOT NULL
-- constraints inherited from the pre-encryption schema. Setting them to
-- NULL during reset raised:
--     null value in column "locale" of relation "profiles_enc" violates
--     not-null constraint
-- Use the same defaults the onboarding flow writes on first run —
-- locale `es-CO`, timezone `America/Bogota`, preferred_currency `COP` —
-- so post-reset the account looks identical to a freshly signed-up user.

CREATE OR REPLACE FUNCTION public.reset_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_table   text;
  v_user_scoped_tables constant text[] := ARRAY[
    'transaction_tags',
    'recurring_template_tags',
    'planning_assignments',
    'planning_entries',
    'planning_periods',
    'budgets',
    'debt_scenarios',
    'financial_reminders',
    'recurring_occurrence_skips',
    'obligation_skips',
    'recurring_occurrences',
    'wishlist_reflections',
    'wishlist_items',
    'pending_email_transactions',
    'pending_email_statements',
    'email_ingest_allowed_senders',
    'email_ingest_logs',
    'email_ingest_addresses',
    'unrecognized_emails',
    'capture_tokens',
    'product_events',
    'destinatarios',
    'category_rules',
    'accounts'
  ];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

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

  FOREACH v_table IN ARRAY v_user_scoped_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table)
        USING v_user_id;
    END IF;
  END LOOP;

  IF to_regclass('public.tags') IS NOT NULL THEN
    DELETE FROM public.tags
      WHERE user_id = v_user_id AND is_system = false;
  END IF;
  IF to_regclass('public.tag_groups') IS NOT NULL THEN
    DELETE FROM public.tag_groups
      WHERE user_id = v_user_id AND is_system = false;
  END IF;

  UPDATE public.profiles SET
    full_name                   = NULL,
    app_purpose                 = NULL,
    avatar_url                  = NULL,
    budget_mode                 = NULL,
    estimated_monthly_income    = NULL,
    estimated_monthly_expenses  = NULL,
    monthly_salary              = NULL,
    preferred_currency          = 'COP',
    timezone                    = 'America/Bogota',
    locale                      = 'es-CO',
    onboarding_completed        = false,
    dashboard_config            = NULL,
    mobile_dashboard_config     = NULL,
    updated_at                  = now()
  WHERE id = v_user_id;
END;
$$;
