-- =============================================================================
-- One-shot cleanup of orphan pending recurring_occurrences left behind by past
-- mergeRecurringTemplates() runs.
--
-- The previous merge implementation reassigned the absorbed template's pending
-- occurrences to the surviving template without aligning them to the survivor's
-- own start_date/frequency. The result: a single template ended up with two
-- pending rows per cycle on different days (e.g. "Pago VISA" on 4 MAY and 6 MAY
-- both pointing at the same template). The merge function has been fixed in
-- code; this migration cleans up the data already corrupted by the old path.
--
-- Strategy (per template):
--   1. Compute the template's expected dates from start_date stepping by its
--      frequency, capped on the upper end by the lesser of end_date (if set)
--      and (CURRENT_DATE + 90 days). The date-based cap is what matters — using
--      a cycle-count cap (e.g. k <= 60) silently drops legitimate near-future
--      pending rows when start_date is older than the cycle-count window
--      (a WEEKLY template anchored 2 years ago needs >100 cycles to reach today).
--   2. Delete any pending rows whose occurrence_date is NOT in the expected set.
--   3. Paid/skipped rows are left untouched — they are historical records, even
--      if their dates don't align with the current schedule.
--
-- The 5000-step generate_series upper bound is large enough for WEEKLY anchored
-- in the 1930s to reach 2026; the date filter trims the result so per-template
-- arrays stay small.
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
  expected_dates date[];
  v_horizon date;
BEGIN
  v_horizon := (CURRENT_DATE + interval '90 days')::date;

  FOR rec IN
    SELECT id, start_date, end_date, frequency::text AS freq
    FROM recurring_transaction_templates_enc
  LOOP
    IF rec.freq = 'ONCE' THEN
      expected_dates := ARRAY[rec.start_date];
    ELSE
      SELECT array_agg(d)
      INTO expected_dates
      FROM (
        SELECT (rec.start_date + (k *
          CASE rec.freq
            WHEN 'WEEKLY'    THEN interval '7 days'
            WHEN 'BIWEEKLY'  THEN interval '14 days'
            WHEN 'MONTHLY'   THEN interval '1 month'
            WHEN 'QUARTERLY' THEN interval '3 months'
            WHEN 'ANNUAL'    THEN interval '1 year'
          END))::date AS d
        FROM generate_series(0, 5000) AS k
      ) t
      WHERE t.d <= v_horizon
        AND (rec.end_date IS NULL OR t.d <= rec.end_date);
    END IF;

    IF expected_dates IS NULL OR array_length(expected_dates, 1) IS NULL THEN
      CONTINUE;
    END IF;

    DELETE FROM recurring_occurrences
    WHERE template_id = rec.id
      AND status = 'pending'
      AND NOT (occurrence_date = ANY(expected_dates));
  END LOOP;
END;
$$;
