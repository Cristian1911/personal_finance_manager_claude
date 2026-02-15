-- Fix RLS on categories to allow reading system categories (user_id IS NULL)
-- Previously, the policy only allowed user_id = auth.uid(), which excluded system defaults.

-- Drop existing SELECT policy if it exists (safe: creates fresh)
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view own and system categories" ON public.categories;

-- New SELECT policy: user's own categories OR system categories (user_id IS NULL)
CREATE POLICY "Users can view own and system categories"
  ON public.categories
  FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR user_id IS NULL
  );

-- Ensure INSERT/UPDATE/DELETE only affect user's own categories (not system)
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories"
  ON public.categories
  FOR INSERT
  WITH CHECK (
    user_id = (select auth.uid())
    AND is_system = false
  );

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories"
  ON public.categories
  FOR UPDATE
  USING (
    user_id = (select auth.uid())
    AND is_system = false
  );

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories"
  ON public.categories
  FOR DELETE
  USING (
    user_id = (select auth.uid())
    AND is_system = false
  );
