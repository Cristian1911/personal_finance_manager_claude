-- ============================================================
-- Tighten INSERT policy on recurring_template_tags so the client
-- cannot inject tag rows for another user's template just by
-- setting user_id to themselves. The fast-path user_id check
-- stays for SELECT/DELETE performance; INSERT now additionally
-- verifies the referenced template belongs to the caller.
-- Closes the cross-user tag injection edge case flagged by
-- supabase-migrator review.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Users can insert own recurring template tags"
  ON public.recurring_template_tags;

CREATE POLICY "Users can insert own recurring template tags"
  ON public.recurring_template_tags FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.recurring_transaction_templates_enc t
      WHERE t.id = recurring_template_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
