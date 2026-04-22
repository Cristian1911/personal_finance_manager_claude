-- =============================================================================
-- Perf refinement of 20260422003433_auto_generate_recurring_occurrences.sql:
-- move the "should we regenerate occurrences?" predicate into the trigger's
-- WHEN clause so the SECURITY DEFINER function (which does a SELECT on
-- recurring_transaction_templates_enc) isn't invoked for unrelated updates
-- (updated_at-only touches from sync, amount/merchant edits, etc.).
--
-- Schedule columns on _enc (is_active, start_date, frequency, end_date) are
-- plaintext, so they're safe to reference in a WHEN clause.
-- =============================================================================

DROP TRIGGER IF EXISTS recurring_templates_enc_generate_occurrences_upd
  ON recurring_transaction_templates_enc;

CREATE TRIGGER recurring_templates_enc_generate_occurrences_upd
  AFTER UPDATE ON recurring_transaction_templates_enc
  FOR EACH ROW
  WHEN (
    NEW.is_active
    AND (
      NOT OLD.is_active
      OR OLD.start_date IS DISTINCT FROM NEW.start_date
      OR OLD.frequency  IS DISTINCT FROM NEW.frequency
      OR OLD.end_date   IS DISTINCT FROM NEW.end_date
    )
  )
  EXECUTE FUNCTION recurring_templates_enc_generate_occurrences_fn();
