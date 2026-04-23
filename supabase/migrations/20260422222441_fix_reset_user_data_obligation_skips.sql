-- ============================================================================
-- Fix: `public.reset_user_data()` referenced `public.obligation_skips`, which
-- was removed in `20260409205916_recurring_occurrences.sql` in favour of
-- `recurring_occurrence_skips`. Running the RPC raised
--     relation "public.obligation_skips" does not exist
-- Re-create the function without that DELETE. Everything else is unchanged.
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

  -- Tag join tables
  DELETE FROM public.category_tags
    WHERE tag_id IN (
      SELECT id FROM public.tags WHERE user_id = v_user_id
    );
  DELETE FROM public.transaction_tags       WHERE user_id = v_user_id;
  DELETE FROM public.destinatario_tags
    WHERE destinatario_id IN (
      SELECT id FROM public.destinatarios WHERE user_id = v_user_id
    );
  DELETE FROM public.recurring_template_tags WHERE user_id = v_user_id;

  -- Planning / budgets / debt / reminders / wishlist
  DELETE FROM public.planning_assignments     WHERE user_id = v_user_id;
  DELETE FROM public.planning_entries         WHERE user_id = v_user_id;
  DELETE FROM public.planning_periods         WHERE user_id = v_user_id;

  DELETE FROM public.budgets                  WHERE user_id = v_user_id;

  DELETE FROM public.debt_scenarios           WHERE user_id = v_user_id;

  DELETE FROM public.financial_reminders      WHERE user_id = v_user_id;

  -- `obligation_skips` was dropped upstream; `recurring_occurrence_skips`
  -- is the current table.
  DELETE FROM public.recurring_occurrence_skips WHERE user_id = v_user_id;
  DELETE FROM public.recurring_occurrences    WHERE user_id = v_user_id;

  DELETE FROM public.wishlist_reflections     WHERE user_id = v_user_id;
  DELETE FROM public.wishlist_items           WHERE user_id = v_user_id;

  -- Email ingest / capture / unrecognized
  DELETE FROM public.pending_email_transactions  WHERE user_id = v_user_id;
  DELETE FROM public.pending_email_statements    WHERE user_id = v_user_id;
  DELETE FROM public.email_ingest_allowed_senders WHERE user_id = v_user_id;
  DELETE FROM public.email_ingest_logs           WHERE user_id = v_user_id;
  DELETE FROM public.email_ingest_addresses      WHERE user_id = v_user_id;

  DELETE FROM public.unrecognized_emails         WHERE user_id = v_user_id;

  DELETE FROM public.capture_tokens              WHERE user_id = v_user_id;

  DELETE FROM public.product_events              WHERE user_id = v_user_id;

  -- Destinatarios (cascades destinatario_rules + destinatario_tags)
  DELETE FROM public.destinatarios               WHERE user_id = v_user_id;

  DELETE FROM public.category_rules              WHERE user_id = v_user_id;

  -- Accounts (cascades transactions, snapshots, recurring templates, etc.)
  DELETE FROM public.accounts                    WHERE user_id = v_user_id;

  -- User-owned tags + tag groups (preserve system rows)
  DELETE FROM public.tags        WHERE user_id = v_user_id AND is_system = false;
  DELETE FROM public.tag_groups  WHERE user_id = v_user_id AND is_system = false;

  -- Reset profile via the view (INSTEAD OF UPDATE trigger re-encrypts)
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
