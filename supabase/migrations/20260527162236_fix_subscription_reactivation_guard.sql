-- Hardens the cancel-drift trigger added in 20260527151641_create_subscriptions.sql.
--
-- Two fixes (from final integration review):
--   1. (Critical) The reactivation branch (template is_active false -> true) blindly set the
--      linked subscription back to 'active'. If a SECOND live subscription already exists for the
--      same (user_id, destinatario_id) — reachable when a template is un-flagged, a new template is
--      created for the same merchant, then the old template is reactivated — the UPDATE violates the
--      partial-unique index `subscriptions_one_live_per_destinatario` and the error propagates,
--      failing the template reactivation. Guard the reactivation with a NOT EXISTS check.
--   2. (Defense-in-depth) Both branches now also filter `user_id = NEW.user_id`, consistent with the
--      project rule of scoping every mutation by user_id even when a FK makes cross-user impossible.

CREATE OR REPLACE FUNCTION sync_subscription_on_template_active_change()
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
      -- Only reactivate if no OTHER live subscription exists for the same destinatario,
      -- otherwise the partial-unique index would reject the update.
      UPDATE subscriptions s
        SET status = 'active', updated_at = now()
        WHERE s.recurring_template_id = NEW.id
          AND s.user_id = NEW.user_id
          AND s.status = 'cancelled'
          AND NOT EXISTS (
            SELECT 1 FROM subscriptions x
            WHERE x.user_id = s.user_id
              AND x.destinatario_id = s.destinatario_id
              AND x.status NOT IN ('cancelled', 'dismissed')
              AND x.id <> s.id
          );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
