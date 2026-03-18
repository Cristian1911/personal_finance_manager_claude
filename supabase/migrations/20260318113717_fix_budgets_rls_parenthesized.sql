-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update their own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete their own budgets" ON public.budgets;

-- Recreate with parenthesized (select auth.uid()) — Supabase fast path
CREATE POLICY "Users can view their own budgets"
  ON public.budgets FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own budgets"
  ON public.budgets FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own budgets"
  ON public.budgets FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own budgets"
  ON public.budgets FOR DELETE
  USING ((select auth.uid()) = user_id);
