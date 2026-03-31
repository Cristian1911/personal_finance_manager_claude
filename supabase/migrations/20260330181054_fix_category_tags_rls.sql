-- Fix: category_tags RLS policy was too permissive.
-- The old FOR ALL policy allowed any user to add/remove tags
-- from system categories (user_id IS NULL), affecting all users.
--
-- New: separate SELECT and write policies.
-- Users can read all category tags (own + system) but can only
-- modify tags on their own categories, not system categories.

-- Drop the old overly-permissive policy
DROP POLICY IF EXISTS "Users can manage category tags for own categories"
  ON public.category_tags;

-- Read: users can see tags on their own categories AND system categories
CREATE POLICY "Users can read category tags"
  ON public.category_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_tags.category_id
      AND (c.user_id = (SELECT auth.uid()) OR c.user_id IS NULL)
    )
  );

-- Write: users can only modify tags on categories THEY own (not system)
CREATE POLICY "Users can manage own category tags"
  ON public.category_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_tags.category_id
      AND c.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_tags.category_id
      AND c.user_id = (SELECT auth.uid())
    )
  );
