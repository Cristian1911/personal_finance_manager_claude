-- Tech-debt Wave 2 follow-up: harden transaction_tags WITH CHECK.
--
-- The previous migration (20260418140000) swapped RLS to the fast-path
-- `(SELECT auth.uid()) = user_id`. That is correct for SELECT/DELETE but
-- leaves an integrity hole on writes: a user could INSERT a tag for a
-- transaction they do not own by simply setting `user_id` to their own
-- auth.uid. SELECT RLS would hide the row from the transaction's owner,
-- but orphan-like rows would pollute the table and bypass the
-- `verifyEntityOwnership` app-level check as defense-in-depth.
--
-- Fix: replace the ALL policy with split INSERT/UPDATE/DELETE policies.
-- SELECT and DELETE keep the fast-path. INSERT and UPDATE require an
-- EXISTS check that the referenced transaction belongs to the caller.

DROP POLICY IF EXISTS "Users can manage own transaction tags"
  ON public.transaction_tags;

-- SELECT: fast-path (unchanged from prior migration, re-asserted idempotently)
DROP POLICY IF EXISTS "Users can view own transaction tags"
  ON public.transaction_tags;

CREATE POLICY "Users can view own transaction tags"
  ON public.transaction_tags FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- DELETE: fast-path. DELETE cannot fabricate a cross-user row because the
-- row already exists and is scoped by user_id.
CREATE POLICY "Users can delete own transaction tags"
  ON public.transaction_tags FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- INSERT: verify the authenticated user actually owns the referenced
-- transaction. This prevents a user from tagging another user's
-- transaction even if they guess the UUID.
CREATE POLICY "Users can insert own transaction tags"
  ON public.transaction_tags FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.transactions_enc t
      WHERE t.id = transaction_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

-- UPDATE: same guard. USING uses the fast-path; WITH CHECK revalidates
-- ownership in case transaction_id is changed (unusual but permitted).
CREATE POLICY "Users can update own transaction tags"
  ON public.transaction_tags FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.transactions_enc t
      WHERE t.id = transaction_id
        AND t.user_id = (SELECT auth.uid())
    )
  );
