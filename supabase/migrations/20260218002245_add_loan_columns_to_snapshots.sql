-- Add loan-specific columns to statement_snapshots
ALTER TABLE statement_snapshots
  ADD COLUMN remaining_balance numeric,
  ADD COLUMN initial_amount numeric,
  ADD COLUMN installments_in_default integer,
  ADD COLUMN loan_number text;
