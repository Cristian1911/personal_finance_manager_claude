-- =============================================================================
-- Follow-up to 20260902120000_monthly_occurrence_one_per_month.sql:
-- before deleting a surplus MONTHLY pending row, move any Cashflow Planner
-- entry pinned to it onto the surviving occurrence of that month, so the
-- planner link doesn't silently become NULL (FK is ON DELETE SET NULL).
-- Function body is otherwise identical.
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
        -- A Cashflow Planner entry pinned to a surplus row would be orphaned
        -- (planning_entries.occurrence_id is ON DELETE SET NULL and only
        -- self-heals when that period is re-seeded). Re-point one such entry
        -- at the surviving row when it has none — the partial unique index
        -- on occurrence_id allows a single entry per occurrence.
        UPDATE planning_entries
        SET occurrence_id = v_keep_id
        WHERE id = (
          SELECT pe.id
          FROM planning_entries pe
          JOIN recurring_occurrences o ON o.id = pe.occurrence_id
          WHERE o.template_id = p_template_id
            AND o.id <> v_keep_id
            AND o.status = 'pending'
            AND o.transaction_id IS NULL
            AND o.occurrence_date >= v_month_start
            AND o.occurrence_date <  v_month_end
          LIMIT 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM planning_entries k WHERE k.occurrence_id = v_keep_id
        );

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
