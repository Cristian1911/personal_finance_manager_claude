-- Fix interest_rate check constraint.
-- Original constraint likely restricted to 0-1 (decimal fraction).
-- The app sends percentages (0-100), so update the constraint to match.

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_valid_interest_rate;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_valid_interest_rate
    CHECK (interest_rate IS NULL OR (interest_rate >= 0 AND interest_rate <= 100));
