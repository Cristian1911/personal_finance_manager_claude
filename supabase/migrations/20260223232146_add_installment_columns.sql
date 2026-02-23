-- Add installment tracking columns to transactions
ALTER TABLE transactions
  ADD COLUMN installment_current SMALLINT,
  ADD COLUMN installment_total   SMALLINT,
  ADD COLUMN installment_group_id TEXT;

-- Ensure consistency: both current and total must be present together and valid
ALTER TABLE transactions
  ADD CONSTRAINT chk_installment_range
  CHECK (
    (installment_current IS NULL AND installment_total IS NULL)
    OR (installment_current > 0 AND installment_total > 0 AND installment_current <= installment_total)
  );

-- Partial index for efficient grouped queries (only rows with installments)
CREATE INDEX idx_transactions_installment_group
  ON transactions (installment_group_id, user_id)
  WHERE installment_group_id IS NOT NULL;
