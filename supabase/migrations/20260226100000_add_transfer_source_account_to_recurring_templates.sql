-- Add optional source account for debt-payment recurring templates
ALTER TABLE recurring_transaction_templates
  ADD COLUMN IF NOT EXISTS transfer_source_account_id UUID
  REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_templates_transfer_source
  ON recurring_transaction_templates(transfer_source_account_id);
