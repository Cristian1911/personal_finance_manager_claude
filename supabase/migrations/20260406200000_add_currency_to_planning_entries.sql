-- Add per-entry currency to planning_entries
-- Allows multi-currency periods (e.g., COP + USD payments on same credit card)
ALTER TABLE planning_entries
  ADD COLUMN currency_code currency_code;

-- Backfill existing entries with their period's currency
UPDATE planning_entries pe
SET currency_code = pp.currency_code
FROM planning_periods pp
WHERE pe.period_id = pp.id
  AND pe.currency_code IS NULL;

-- Make non-nullable after backfill
ALTER TABLE planning_entries
  ALTER COLUMN currency_code SET NOT NULL,
  ALTER COLUMN currency_code SET DEFAULT 'COP';
