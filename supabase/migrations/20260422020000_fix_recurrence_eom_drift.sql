-- =============================================================================
-- Fix end-of-month drift in generate_occurrences_for_template.
--
-- Previous version iterated `v_cursor := v_cursor + interval '1 month'`, which
-- drifts: Jan 31 → Feb 28 (clamped) → Mar 28 → Apr 28 ... permanently stuck on
-- the 28th instead of returning to the 31st in long months.
--
-- Fix: anchor all arithmetic on `v_start_date` and use a step counter. Postgres'
-- interval arithmetic clamps only where the target month is shorter, so
-- `v_start_date + k * interval '1 month'` preserves the 31st anchor.
--
-- Mirrors packages/shared/src/utils/recurrence.ts occurrenceAt() after the same
-- fix on the JS side. Keep these two implementations in sync.
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
BEGIN
  SELECT user_id, amount, start_date, end_date, frequency::text, is_active
    INTO v_user_id, v_amount, v_start_date, v_end_date, v_frequency, v_is_active
  FROM recurring_transaction_templates_enc
  WHERE id = p_template_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_is_active THEN RETURN; END IF;

  v_range_start := date_trunc('month', now())::date;
  v_range_end   := (date_trunc('month', now())
                     + interval '1 month'
                     - interval '1 day'
                     + interval '14 days')::date;

  IF v_frequency = 'ONCE' THEN
    IF v_start_date BETWEEN v_range_start AND v_range_end
       AND (v_end_date IS NULL OR v_start_date <= v_end_date) THEN
      INSERT INTO recurring_occurrences
        (template_id, user_id, occurrence_date, expected_amount, status)
      VALUES
        (p_template_id, v_user_id, v_start_date, v_amount, 'pending')
      ON CONFLICT (template_id, occurrence_date) DO NOTHING;
    END IF;
    RETURN;
  END IF;

  -- Single loop over every step from anchor; insert only when the cursor
  -- falls inside [range_start, range_end]. Keeps the frequency CASE in one
  -- place (vs. a duplicated advance-then-collect pattern).
  v_step := 0;
  v_cursor := v_start_date;

  WHILE v_cursor <= v_range_end LOOP
    IF v_end_date IS NOT NULL AND v_cursor > v_end_date THEN EXIT; END IF;

    IF v_cursor >= v_range_start THEN
      INSERT INTO recurring_occurrences
        (template_id, user_id, occurrence_date, expected_amount, status)
      VALUES
        (p_template_id, v_user_id, v_cursor, v_amount, 'pending')
      ON CONFLICT (template_id, occurrence_date) DO NOTHING;
    END IF;

    v_step := v_step + 1;
    v_cursor := CASE v_frequency
      WHEN 'WEEKLY'    THEN v_start_date + (v_step * interval '7 days')
      WHEN 'BIWEEKLY'  THEN v_start_date + (v_step * interval '14 days')
      WHEN 'MONTHLY'   THEN v_start_date + (v_step * interval '1 month')
      WHEN 'QUARTERLY' THEN v_start_date + (v_step * interval '3 months')
      WHEN 'ANNUAL'    THEN v_start_date + (v_step * interval '1 year')
      ELSE NULL
    END;
    IF v_cursor IS NULL THEN EXIT; END IF;
  END LOOP;
END;
$$;
