-- Tech-debt Wave 2: tighten transaction_tags RLS + add audit column.
--
-- Goals:
--   1. Add created_at for audit/ordering.
--   2. Denormalize user_id so RLS can use the fast-path (SELECT auth.uid()) = user_id
--      instead of an EXISTS subquery against transactions.
--   3. Backfill user_id from transactions.user_id.
--   4. Index user_id.
--   5. Swap RLS policies to the fast-path variant.
--
-- Order of operations (must preserve access for existing rows):
--   add columns nullable -> backfill -> set NOT NULL -> FK + index -> swap policies.

------------------------------------------------------------------------------
-- 1. Add columns (nullable first, so backfill can run)
------------------------------------------------------------------------------
ALTER TABLE public.transaction_tags
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.transaction_tags
  ADD COLUMN IF NOT EXISTS user_id UUID;

------------------------------------------------------------------------------
-- 2. Backfill user_id from the parent transaction
------------------------------------------------------------------------------
UPDATE public.transaction_tags tt
SET user_id = t.user_id
FROM public.transactions t
WHERE tt.transaction_id = t.id
  AND tt.user_id IS NULL;

------------------------------------------------------------------------------
-- 3. Enforce NOT NULL + FK to auth.users
------------------------------------------------------------------------------
ALTER TABLE public.transaction_tags
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transaction_tags_user_id_fkey'
      AND conrelid = 'public.transaction_tags'::regclass
  ) THEN
    ALTER TABLE public.transaction_tags
      ADD CONSTRAINT transaction_tags_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

------------------------------------------------------------------------------
-- 4. Index for the new RLS predicate + common user-scoped lookups
------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transaction_tags_user_id
  ON public.transaction_tags(user_id);

------------------------------------------------------------------------------
-- 5. Swap RLS policies to the fast-path variant
--    NOTE: we add the new policies BEFORE dropping the old ones so there's
--    never a window where authorised users lose access mid-migration.
------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own transaction tags"
  ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can manage own transaction tags"
  ON public.transaction_tags;

CREATE POLICY "Users can view own transaction tags"
  ON public.transaction_tags FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can manage own transaction tags"
  ON public.transaction_tags FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Now that the fast-path policies are in place, drop the old EXISTS-based ones.
DROP POLICY IF EXISTS "Users can view transaction tags for own transactions"
  ON public.transaction_tags;
DROP POLICY IF EXISTS "Users can manage transaction tags for own transactions"
  ON public.transaction_tags;
