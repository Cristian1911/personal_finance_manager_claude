-- Fix numeric field overflow for monetary columns on accounts table.
-- Original columns may have been created with constrained precision (e.g. numeric(10,2))
-- which overflows for COP values like 5,000,000+.
-- ALTER TYPE to bare numeric allows arbitrary precision.

ALTER TABLE public.accounts
  ALTER COLUMN current_balance TYPE numeric,
  ALTER COLUMN credit_limit TYPE numeric,
  ALTER COLUMN available_balance TYPE numeric,
  ALTER COLUMN interest_rate TYPE numeric;
