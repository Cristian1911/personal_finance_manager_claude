-- =============================================================================
-- BIWEEKLY = quincenal anclada al mes, no "cada 14 días".
--
-- Stepping by literal 14-day intervals drifts ~2 days per month: a quincena
-- anchored on the 15th ends up generating occurrences on the 7th within a few
-- months. Real Colombian quincenas are month-anchored day pairs.
--
-- New rule (mirrors quincenalOccurrenceAt() in
-- packages/shared/src/utils/recurrence.ts — keep both in sync):
--   from the template's start day D, derive the pair
--     D ≤ 15 → {D, D+15}   (e.g. 15 → {15, 30})
--     D > 15 → {D−15, D}   (e.g. 20 → {5, 20})
--   The high day clamps to month end in shorter months (30 → Feb 28) and
--   returns to its anchor afterwards — no cumulative drift.
--
-- Also cleans up: future pending occurrences of active BIWEEKLY templates sit
-- on drifted dates, so they're deleted (only unlinked pending rows) and
-- regenerated on the new schedule.
-- =============================================================================

-- ── Helper: k-th quincenal occurrence from an anchor start date ──────────────
CREATE OR REPLACE FUNCTION quincenal_occurrence_at(p_start date, p_k integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      CASE WHEN extract(day FROM p_start)::int <= 15
           THEN extract(day FROM p_start)::int
           ELSE extract(day FROM p_start)::int - 15 END AS day_low,
      CASE WHEN extract(day FROM p_start)::int <= 15
           THEN extract(day FROM p_start)::int + 15
           ELSE extract(day FROM p_start)::int END AS day_high,
      -- Position in the combined low/high series; offset 1 when the series
      -- starts on the high day so k=0 still lands exactly on p_start.
      p_k + CASE WHEN extract(day FROM p_start)::int <= 15 THEN 0 ELSE 1 END AS idx
  ),
  base AS (
    SELECT
      (date_trunc('month', p_start) + ((idx / 2) * interval '1 month'))::date AS month_start,
      CASE WHEN idx % 2 = 0 THEN day_low ELSE day_high END AS target_day
    FROM params
  )
  SELECT month_start
    + (LEAST(
         target_day,
         extract(day FROM (month_start + interval '1 month' - interval '1 day'))::int
       ) - 1)
  FROM base;
$$;

-- ── Regenerate the occurrence generator with the quincenal branch ────────────
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
      WHEN 'WEEKLY'    THEN (v_start_date + (v_step * interval '7 days'))::date
      WHEN 'BIWEEKLY'  THEN quincenal_occurrence_at(v_start_date, v_step)
      WHEN 'MONTHLY'   THEN (v_start_date + (v_step * interval '1 month'))::date
      WHEN 'QUARTERLY' THEN (v_start_date + (v_step * interval '3 months'))::date
      WHEN 'ANNUAL'    THEN (v_start_date + (v_step * interval '1 year'))::date
      ELSE NULL
    END;
    IF v_cursor IS NULL THEN EXIT; END IF;
  END LOOP;
END;
$$;

-- ── One-time cleanup: re-seat future pending BIWEEKLY occurrences ────────────
-- Only unlinked pending rows are removed; paid/skipped history and anything
-- already linked to a transaction is untouched.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT id FROM recurring_transaction_templates_enc
    WHERE frequency::text = 'BIWEEKLY' AND is_active
  LOOP
    -- Floor matches the generator's v_range_start (start of current month) so
    -- a drifted date earlier this month can't survive next to its replacement.
    DELETE FROM recurring_occurrences
    WHERE template_id = t.id
      AND status = 'pending'
      AND transaction_id IS NULL
      AND occurrence_date >= date_trunc('month', now() AT TIME ZONE 'America/Bogota')::date;
    PERFORM generate_occurrences_for_template(t.id);
  END LOOP;
END $$;
