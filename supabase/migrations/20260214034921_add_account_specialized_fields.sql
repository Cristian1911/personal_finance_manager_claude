-- Add specialized account fields for credit cards, loans, and investments

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cutoff_day smallint,
  ADD COLUMN IF NOT EXISTS payment_day smallint,
  ADD COLUMN IF NOT EXISTS loan_amount numeric,
  ADD COLUMN IF NOT EXISTS monthly_payment numeric,
  ADD COLUMN IF NOT EXISTS loan_start_date date,
  ADD COLUMN IF NOT EXISTS loan_end_date date,
  ADD COLUMN IF NOT EXISTS initial_investment numeric,
  ADD COLUMN IF NOT EXISTS expected_return_rate numeric,
  ADD COLUMN IF NOT EXISTS maturity_date date;

-- Constraints
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_cutoff_day_range
    CHECK (cutoff_day >= 1 AND cutoff_day <= 31),
  ADD CONSTRAINT accounts_payment_day_range
    CHECK (payment_day >= 1 AND payment_day <= 31),
  ADD CONSTRAINT accounts_expected_return_rate_range
    CHECK (expected_return_rate >= 0 AND expected_return_rate <= 100);
