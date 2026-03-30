ALTER TABLE public.profiles
ADD COLUMN budget_mode TEXT
  CHECK (budget_mode IN ('per_category', 'zero_based'));
