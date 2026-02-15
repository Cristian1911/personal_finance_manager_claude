-- Add is_excluded boolean to transactions table
-- Excluded transactions remain in the database but are filtered from dashboards/charts.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_excluded boolean NOT NULL DEFAULT false;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_transactions_is_excluded
  ON public.transactions (is_excluded)
  WHERE is_excluded = true;
