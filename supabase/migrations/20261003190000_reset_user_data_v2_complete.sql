-- ============================================================================
-- reset_user_data(): complete the wipe for v2 ("Empezar de nuevo", S10-4).
--
-- Found 2026-10-03 against zeta-dev (same function on prod):
--   * Fixed payments created by v2 have no account_id, so deleting accounts
--     didn't cascade them: recurring_transaction_templates_enc is now wiped.
--   * personal_debts → destinatarios is ON DELETE RESTRICT: a user with a
--     personal debt made the whole reset fail. Debts (and their allocations)
--     are now deleted before destinatarios.
--   * Modos, budget scenarios, statement tray dismissals, subscriptions and
--     transaction locations were left behind.
-- Same signature, same grants; only the table list changes. Additive: no
-- table, column or policy changes. 'commands' is intentionally kept.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_user_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_table   text;
  v_user_scoped_tables constant text[] := ARRAY[
    -- v2 settings and sync memory (S8/S9); 'commands' stays on purpose: its ids
    -- keep an old phone's queued commands from replaying the wiped data back.
    'bill_reservations',
    'account_settings',
    'user_cycle_settings',
    'field_versions',
    'statement_tray_dismissals',
    'modo_tx_reviews',
    'modo_participants',
    'modos',
    'transaction_tags',
    'recurring_template_tags',
    'planning_assignments',
    'planning_entries',
    'planning_periods',
    'budgets',
    'budget_scenarios',
    'debt_scenarios',
    'financial_reminders',
    'recurring_occurrence_skips',
    'obligation_skips',
    'recurring_occurrences',
    'subscriptions',
    -- Fixed payments with no account (v2 creates them) don't cascade from accounts.
    'recurring_transaction_templates_enc',
    -- Before destinatarios: personal_debts → destinatarios is ON DELETE RESTRICT.
    'personal_debt_allocations',
    'personal_debts',
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
    'design_reviews',
    'destinatarios',
    'category_rules',
    'transaction_locations_enc',
    -- Last: cascades transactions_enc, statement_snapshots_enc, pdf_passwords_enc.
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
$function$;

-- ============================================================================
-- restart_financial_data(): v2 Ajustes › "Empezar de nuevo" (S10-4).
--
-- Owner decision (2026-10-03): wipe only the financial data, so onboarding can
-- run again; keep what took effort to set up:
--   kept:  profile, categories, tags, destinatarios + destinatario_rules +
--          category_rules (learned merchants), the email forwarding address,
--          its allowed senders and logs, capture tokens, encryption keys,
--          commands (ids keep old queued commands from replaying the data).
--   wiped: accounts (cascades transactions, statement snapshots, PDF
--          passwords), fixed payments and occurrences, cycle settings, account
--          settings, reservations, personal debts, budgets, planning, modos,
--          wishlist, pending email transactions/statements, and field versions
--          except the ones for kept destinatarios.
-- SECURITY DEFINER, own rows only (auth.uid()), same pattern as
-- reset_user_data().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.restart_financial_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_table   text;
  v_tables  constant text[] := ARRAY[
    'bill_reservations',
    'account_settings',
    'user_cycle_settings',
    'statement_tray_dismissals',
    'modo_tx_reviews',
    'modo_participants',
    'modos',
    'transaction_tags',
    'recurring_template_tags',
    'planning_assignments',
    'planning_entries',
    'planning_periods',
    'budgets',
    'budget_scenarios',
    'debt_scenarios',
    'financial_reminders',
    'recurring_occurrence_skips',
    'obligation_skips',
    'recurring_occurrences',
    'subscriptions',
    'recurring_transaction_templates_enc',
    'personal_debt_allocations',
    'personal_debts',
    'wishlist_reflections',
    'wishlist_items',
    'pending_email_transactions',
    'pending_email_statements',
    'transaction_locations_enc',
    'accounts'
  ];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table)
        USING v_user_id;
    END IF;
  END LOOP;

  -- Per-field edit versions of wiped rows; the kept merchants keep theirs.
  DELETE FROM public.field_versions
    WHERE user_id = v_user_id AND entity <> 'destinatario';
END;
$function$;

REVOKE ALL ON FUNCTION public.restart_financial_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restart_financial_data() FROM anon;
GRANT  EXECUTE ON FUNCTION public.restart_financial_data() TO authenticated;

COMMENT ON FUNCTION public.restart_financial_data() IS
  'v2 "Empezar de nuevo": deletes the calling user''s financial data (accounts, '
  'movements, fixed payments, settings, debts, budgets) and keeps profile, '
  'categories, learned merchants and the email forwarding address.';
