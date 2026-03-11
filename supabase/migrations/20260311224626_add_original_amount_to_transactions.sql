-- Add original_amount column to transactions for installment purchases.
-- For credit card installments: amount = monthly cuota, original_amount = full purchase price.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS original_amount numeric NULL;

COMMENT ON COLUMN transactions.original_amount IS
  'Full purchase price for installment transactions. amount stores the monthly cuota.';
