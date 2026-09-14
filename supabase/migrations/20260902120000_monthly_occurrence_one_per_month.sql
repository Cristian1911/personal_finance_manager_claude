-- =============================================================================
-- MONTHLY templates: exactly one occurrence per month, following the schedule.
--
-- Bug: a credit-card statement import updates the debt template's start_date
-- to the new payment due date (Nu alternates day 1 / next business day). That
-- fires recurring_templates_enc_generate_occurrences_upd, and this function
-- inserted the new date with ON CONFLICT (template_id, occurrence_date) — a
-- different day never conflicts, and MONTHLY was excluded from the stale-row
-- prune "on purpose" (the webapp keeps one row per month whose day may drift).
-- Net effect: two pending rows for the same month (Sep 1 + Sep 3), every month
-- the due day moved, and the user skipped the surplus by hand.
--
-- Fix (MONTHLY only; other frequencies keep the exact-date prune):
--   * Per scheduled date d, look at the month's existing rows and keep ONE:
--       1. a settled row (paid/skipped or linked) — the obligation is handled,
--       2. else the row already on d,
--       3. else the earliest pending row, which is MOVED to d.
--     Every other pending, unlinked row in that month is deleted.
--   * Pending, unlinked rows inside the generation range whose month the
--     schedule does not produce (start_date moved later, end_date passed) are
--     pruned like the non-MONTHLY frequencies.
--   Paid/skipped history and anything linked to a transaction is never touched.
--
-- Mirrors the month-level idempotency of ensureOccurrencesForRange() in
-- webapp/src/actions/occurrences.ts, which still never inserts a second row in
-- a month; the move/prune lives here because start_date edits from every path
-- (webapp import, manual edit, mobile) pass through this trigger.
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_occurrences_for_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_amount        numeric(15,2);
  v_start_date    date;
  v_end_date      date;
  v_frequency     text;
  v_is_active     boolean;
  v_range_start   date;
  v_range_end     date;
  v_cursor        date;
  v_step          integer;
  v_dates         date[] := '{}';
  v_months        date[] := '{}';
  v_d             date;
  v_month_start   date;
  v_month_end     date;
  v_keep_id       uuid;
BEGIN
  SELECT user_id, amount, start_date, end_date, frequency::text, is_active
    INTO v_user_id, v_amount, v_start_date, v_end_date, v_frequency, v_is_active
  FROM recurring_transaction_templates_enc
  WHERE id = p_template_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_is_active THEN RETURN; END IF;

  -- Colombia-local "today": plain now() is UTC, which rolls the month over at
  -- ~7pm COT on the last day of the month and would generate the wrong range.
  v_range_start := date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
  v_range_end   := (date_trunc('month', now() AT TIME ZONE 'America/Bogota')
                     + interval '1 month'
                     - interval '1 day'
                     + interval '14 days')::date;

  IF v_frequency = 'ONCE' THEN
    IF v_start_date BETWEEN v_range_start AND v_range_end
       AND (v_end_date IS NULL OR v_start_date <= v_end_date) THEN
      v_dates := array_append(v_dates, v_start_date);
      INSERT INTO recurring_occurrences
        (template_id, user_id, occurrence_date, expected_amount, status)
      VALUES
        (p_template_id, v_user_id, v_start_date, v_amount, 'pending')
      ON CONFLICT (template_id, occurrence_date) DO NOTHING;
    END IF;

    DELETE FROM recurring_occurrences
    WHERE template_id = p_template_id
      AND status = 'pending'
      AND transaction_id IS NULL
      AND occurrence_date BETWEEN v_range_start AND v_range_end
      AND occurrence_date <> ALL(v_dates);
    RETURN;
  END IF;

  -- Collect every scheduled date inside [range_start, range_end].
  v_step := 0;
  v_cursor := v_start_date;

  WHILE v_cursor <= v_range_end LOOP
    IF v_end_date IS NOT NULL AND v_cursor > v_end_date THEN EXIT; END IF;

    IF v_cursor >= v_range_start THEN
      v_dates := array_append(v_dates, v_cursor);
      IF v_frequency <> 'MONTHLY' THEN
        INSERT INTO recurring_occurrences
          (template_id, user_id, occurrence_date, expected_amount, status)
        VALUES
          (p_template_id, v_user_id, v_cursor, v_amount, 'pending')
        ON CONFLICT (template_id, occurrence_date) DO NOTHING;
      END IF;
    END IF;

    v_step := v_step + 1;
    v_cursor := CASE v_frequency
      WHEN 'WEEKLY'    THEN (v_start_date + (v_step * interval '7 days'))::date
      WHEN 'BIWEEKLY'  THEN quincenal_occurrence_at(v_start_date, v_step)
      WHEN 'MONTHLY'   THEN (v_start_date + (v_step * interval '1 month'))::date
      WHEN 'QUARTERLY' THEN (v_start_date + (v_step * interval '3 months'))::date
      WHEN 'ANNUAL'    THEN (v_start_date + (v_step * interval '1 year'))::date
      ELSE NULL
    END;
    IF v_cursor IS NULL THEN EXIT; END IF;
  END LOOP;

  IF v_frequency = 'MONTHLY' THEN
    FOREACH v_d IN ARRAY v_dates LOOP
      v_month_start := date_trunc('month', v_d)::date;
      v_month_end   := (v_month_start + interval '1 month')::date;
      v_months := array_append(v_months, v_month_start);

      -- One obligation per month. Prefer a settled row (history wins), then
      -- the row already on the scheduled day, then the earliest pending row.
      SELECT id INTO v_keep_id
      FROM recurring_occurrences
      WHERE template_id = p_template_id
        AND occurrence_date >= v_month_start
        AND occurrence_date <  v_month_end
      ORDER BY
        (status <> 'pending' OR transaction_id IS NOT NULL) DESC,
        (occurrence_date = v_d) DESC,
        occurrence_date ASC,
        created_at ASC
      LIMIT 1;

      IF v_keep_id IS NULL THEN
        INSERT INTO recurring_occurrences
          (template_id, user_id, occurrence_date, expected_amount, status)
        VALUES
          (p_template_id, v_user_id, v_d, v_amount, 'pending')
        ON CONFLICT (template_id, occurrence_date) DO NOTHING;
      ELSE
        -- Surplus pending rows for the month (the Sep 1 + Sep 3 pair).
        DELETE FROM recurring_occurrences
        WHERE template_id = p_template_id
          AND id <> v_keep_id
          AND status = 'pending'
          AND transaction_id IS NULL
          AND occurrence_date >= v_month_start
          AND occurrence_date <  v_month_end;

        -- Follow the schedule: a still-pending row moves to the new due day.
        UPDATE recurring_occurrences
        SET occurrence_date = v_d
        WHERE id = v_keep_id
          AND status = 'pending'
          AND transaction_id IS NULL
          AND occurrence_date <> v_d;
      END IF;
    END LOOP;

    -- Months the schedule no longer produces inside the range.
    DELETE FROM recurring_occurrences
    WHERE template_id = p_template_id
      AND status = 'pending'
      AND transaction_id IS NULL
      AND occurrence_date BETWEEN v_range_start AND v_range_end
      AND date_trunc('month', occurrence_date)::date <> ALL(v_months);
  ELSE
    -- Non-MONTHLY: dates the current schedule does not produce are stale.
    DELETE FROM recurring_occurrences
    WHERE template_id = p_template_id
      AND status = 'pending'
      AND transaction_id IS NULL
      AND occurrence_date BETWEEN v_range_start AND v_range_end
      AND occurrence_date <> ALL(v_dates);
  END IF;
END;
$$;

-- ── One-time heal: collapse every existing same-month MONTHLY duplicate ──────
-- Paid/skipped history and anything linked to a transaction is untouched.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT id FROM recurring_transaction_templates_enc
    WHERE is_active
  LOOP
    PERFORM generate_occurrences_for_template(t.id);
  END LOOP;
END $$;
