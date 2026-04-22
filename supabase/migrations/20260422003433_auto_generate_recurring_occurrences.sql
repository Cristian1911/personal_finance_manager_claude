-- =============================================================================
-- Auto-generate recurring_occurrences when a template is inserted or activated.
--
-- Closes a webapp/mobile divergence: mobile creates templates directly via
-- Supabase but never calls the webapp's ensureCurrentOccurrences(), so mobile
-- users' Plan page stays empty until a webapp user visits it.
--
-- Mirrors webapp/src/lib/utils/occurrence-generator.ts +
-- packages/shared/src/utils/recurrence.ts:
--   - Only fires when is_active = true
--   - Range: [date_trunc('month', now()), date_trunc('month', now()) + 1 month - 1 day + 14 days]
--   - Start date = GREATEST(template.start_date, range_start)
--   - Step: WEEKLY=7d, BIWEEKLY=14d, MONTHLY=1mo, QUARTERLY=3mo, ANNUAL=1yr, ONCE=single
--   - Respects end_date (stops when occurrence > end_date)
--   - Idempotent via UNIQUE (template_id, occurrence_date) + ON CONFLICT DO NOTHING
--
-- The INSTEAD OF INSERT/UPDATE triggers on the `recurring_transaction_templates`
-- view forward to `recurring_transaction_templates_enc`, so AFTER INSERT / AFTER
-- UPDATE on the base table fire for every path (webapp view INSERT, mobile
-- direct insert via service-role, admin client, etc.).
-- =============================================================================

-- Idempotency guard: drop prior versions so this migration is reversible and
-- safe to re-run during local troubleshooting.
DROP TRIGGER IF EXISTS recurring_templates_enc_generate_occurrences_ins
  ON recurring_transaction_templates_enc;
DROP TRIGGER IF EXISTS recurring_templates_enc_generate_occurrences_upd
  ON recurring_transaction_templates_enc;
DROP FUNCTION IF EXISTS generate_occurrences_for_template(uuid);
DROP FUNCTION IF EXISTS recurring_templates_enc_generate_occurrences_fn();

-- -----------------------------------------------------------------------------
-- Core generator: materializes occurrences for a single template id.
-- Mirrors getOccurrencesBetween() from packages/shared/src/utils/recurrence.ts.
-- SECURITY DEFINER so it runs even when called from a trigger context where
-- RLS would otherwise block the INSERT into recurring_occurrences.
-- -----------------------------------------------------------------------------
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
BEGIN
  -- Read the template directly from the encrypted base table (non-PII columns
  -- are not encrypted, so no decryption needed).
  SELECT user_id, amount, start_date, end_date, frequency::text, is_active
    INTO v_user_id, v_amount, v_start_date, v_end_date, v_frequency, v_is_active
  FROM recurring_transaction_templates_enc
  WHERE id = p_template_id;

  IF NOT FOUND THEN RETURN; END IF;
  IF NOT v_is_active THEN RETURN; END IF;

  -- Range: current month start through end-of-month + 14 days.
  v_range_start := date_trunc('month', now())::date;
  v_range_end   := (date_trunc('month', now())
                     + interval '1 month - 1 day'
                     + interval '14 days')::date;

  -- ONCE: single occurrence at start_date, if it falls in range and not past end_date.
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

  -- Recurring: walk from start_date forward until we reach range_start,
  -- then emit every step that falls within [range_start, range_end].
  v_cursor := v_start_date;

  WHILE v_cursor < v_range_start LOOP
    v_cursor := CASE v_frequency
      WHEN 'WEEKLY'    THEN v_cursor + interval '7 days'
      WHEN 'BIWEEKLY'  THEN v_cursor + interval '14 days'
      WHEN 'MONTHLY'   THEN v_cursor + interval '1 month'
      WHEN 'QUARTERLY' THEN v_cursor + interval '3 months'
      WHEN 'ANNUAL'    THEN v_cursor + interval '1 year'
      ELSE NULL
    END;
    IF v_cursor IS NULL THEN RETURN; END IF;  -- unknown frequency: bail
  END LOOP;

  WHILE v_cursor <= v_range_end LOOP
    IF v_end_date IS NOT NULL AND v_cursor > v_end_date THEN EXIT; END IF;

    INSERT INTO recurring_occurrences
      (template_id, user_id, occurrence_date, expected_amount, status)
    VALUES
      (p_template_id, v_user_id, v_cursor, v_amount, 'pending')
    ON CONFLICT (template_id, occurrence_date) DO NOTHING;

    v_cursor := CASE v_frequency
      WHEN 'WEEKLY'    THEN v_cursor + interval '7 days'
      WHEN 'BIWEEKLY'  THEN v_cursor + interval '14 days'
      WHEN 'MONTHLY'   THEN v_cursor + interval '1 month'
      WHEN 'QUARTERLY' THEN v_cursor + interval '3 months'
      WHEN 'ANNUAL'    THEN v_cursor + interval '1 year'
      ELSE NULL
    END;
    IF v_cursor IS NULL THEN EXIT; END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Trigger dispatcher: handles both AFTER INSERT and AFTER UPDATE.
-- On UPDATE, only re-generates when the active flag flips on, or when the
-- schedule fields change (start_date, frequency, end_date) on an active row.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recurring_templates_enc_generate_occurrences_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active THEN
      PERFORM generate_occurrences_for_template(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path
  IF NEW.is_active AND (
       NOT OLD.is_active
       OR OLD.start_date IS DISTINCT FROM NEW.start_date
       OR OLD.frequency  IS DISTINCT FROM NEW.frequency
       OR OLD.end_date   IS DISTINCT FROM NEW.end_date
     ) THEN
    PERFORM generate_occurrences_for_template(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER recurring_templates_enc_generate_occurrences_ins
  AFTER INSERT ON recurring_transaction_templates_enc
  FOR EACH ROW
  EXECUTE FUNCTION recurring_templates_enc_generate_occurrences_fn();

CREATE TRIGGER recurring_templates_enc_generate_occurrences_upd
  AFTER UPDATE ON recurring_transaction_templates_enc
  FOR EACH ROW
  EXECUTE FUNCTION recurring_templates_enc_generate_occurrences_fn();
