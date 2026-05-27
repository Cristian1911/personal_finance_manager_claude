-- ============================================================================
-- Allow multiple LIVE subscriptions per destinatario
--
-- Some merchants bill several distinct products under one identical statement
-- descriptor (e.g. Google Play: "GOOGLE *PLAY YOUTUBE" for YouTube Premium,
-- Google One, in-app subscriptions, ...). The destinatario matcher is purely
-- text-based, so all of these necessarily collapse to ONE "Google Play"
-- destinatario. Each product is still its own recurring template (different
-- amount), so the natural uniqueness anchor for a subscription is the
-- recurring template, NOT the destinatario.
--
-- This migration relaxes the one-live-per-destinatario rule to one-live-per-
-- template, while keeping auto-detection's "one suggestion per merchant"
-- invariant (the detector groups by destinatario and cannot tell products
-- apart). The cancel-drift reactivation guard is re-scoped from destinatario
-- to template to match the new index.
--
-- Data safety: the OLD index already guaranteed at most one live row per
-- destinatario, and a template maps to exactly one destinatario, so no
-- existing rows can violate the new per-template index. No data backfill.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Replace the per-destinatario live index with a per-template live index.
--    recurring_template_id IS NULL rows (freshly detected suggestions that
--    haven't been formalized) are intentionally excluded — their uniqueness
--    is handled by the suggestion index below.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS subscriptions_one_live_per_destinatario;

CREATE UNIQUE INDEX subscriptions_one_live_per_template
  ON public.subscriptions (user_id, recurring_template_id)
  WHERE status NOT IN ('cancelled', 'dismissed')
    AND recurring_template_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Preserve "at most one open auto-suggestion per merchant".
--    Detection (runSubscriptionDetection) already dedups by destinatario in
--    app code; this index keeps that invariant at the DB level so concurrent
--    detection runs can't produce duplicate suggestions for the same merchant.
--    Only 'suggested' rows participate — once confirmed/linked they move out
--    of this partial set and the per-template index takes over.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX subscriptions_one_suggestion_per_destinatario
  ON public.subscriptions (user_id, destinatario_id)
  WHERE status = 'suggested';

-- ----------------------------------------------------------------------------
-- 3. Re-scope the cancel-drift reactivation guard from destinatario to
--    template.
--
--    Under the old per-destinatario index the guard blocked reactivation when
--    ANY other live sub shared the destinatario. With multiple subs per
--    destinatario now allowed, that would WRONGLY block reactivating template
--    A's sub just because template B (same merchant) is live. The correct
--    guard is per-template, mirroring the new unique index.
--
--    Reactivation now targets the single most-recently-cancelled sub for the
--    template, and only if no live sub already exists for that template — so
--    accumulated cancelled rows (from repeated flag/unflag cycles) can never
--    produce two live rows and trip the unique index.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_subscription_on_template_active_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = false THEN
      UPDATE subscriptions
        SET status = 'cancelled', updated_at = now()
        WHERE recurring_template_id = NEW.id
          AND user_id = NEW.user_id
          AND status NOT IN ('cancelled', 'dismissed');
    ELSE
      UPDATE subscriptions
        SET status = 'active', updated_at = now()
        WHERE id = (
          SELECT id FROM subscriptions
          WHERE recurring_template_id = NEW.id
            AND user_id = NEW.user_id
            AND status = 'cancelled'
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions x
          WHERE x.user_id = NEW.user_id
            AND x.recurring_template_id = NEW.id
            AND x.status NOT IN ('cancelled', 'dismissed')
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
