-- One active debt-payment template per account.
--
-- Multiple creation paths (manual form, promote-from-transaction, PDF/email
-- import sync) could each insert an INFLOW MONTHLY template for the same debt
-- account, producing duplicate "needed payments" per month. This migration
-- dedupes existing rows and enforces uniqueness at the DB level so no code
-- path can reintroduce duplicates.
--
-- IMPORTANT: recurring_transaction_templates is an encrypted VIEW.
-- All statements target the base table recurring_transaction_templates_enc —
-- updating the view as postgres would route through the INSTEAD OF trigger
-- and re-encrypt PII columns without a caller key.

-- 1) Dedupe: keep the most recently updated active template per (user, account),
--    deactivate the rest (history preserved — rows are not deleted).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, account_id
           ORDER BY updated_at DESC, created_at DESC, id
         ) AS rn
  FROM recurring_transaction_templates_enc
  WHERE direction = 'INFLOW'
    AND frequency = 'MONTHLY'
    AND is_active = true
),
deactivated AS (
  UPDATE recurring_transaction_templates_enc t
  SET is_active = false,
      end_date = CURRENT_DATE
  FROM ranked r
  WHERE t.id = r.id
    AND r.rn > 1
  RETURNING t.id
)
-- 2) Drop PENDING occurrences of exactly the templates deactivated above
--    (paid/skipped history stays for metrics).
DELETE FROM recurring_occurrences o
USING deactivated d
WHERE o.template_id = d.id
  AND o.status = 'pending';

-- 3) Enforce: one ACTIVE debt-payment template per (user, account).
CREATE UNIQUE INDEX IF NOT EXISTS uq_recurring_templates_active_inflow_monthly
  ON recurring_transaction_templates_enc (user_id, account_id)
  WHERE direction = 'INFLOW'
    AND frequency = 'MONTHLY'
    AND is_active = true;
