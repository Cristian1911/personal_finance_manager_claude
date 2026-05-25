-- ==========================================================================
-- Fix INSTEAD OF INSERT trigger on encrypted wishlist_items view
-- --------------------------------------------------------------------------
-- Same class of bug as 20260525225643 (statement_snapshots): the has_auth-guard
-- rewrite (20260417193237) botched wishlist_items_view_insert(). It inserted
-- into columns that DO NOT EXIST on wishlist_items_enc:
--   price            (real column is `amount`)
--   enrichment_data  (no such column)
--   score_data       (no such column)
-- and omitted ~16 real columns (account_id, amount, bought_at, category_id,
-- desire_type, enriched_at, funding_type, image_url, installments,
-- last_nudge_dismissed_at, last_score, last_scored_at, last_verdict, ready_at,
-- transaction_id, urgency). Because wishlist creation inserts through this view
-- (webapp/src/actions/wishlist.ts), every create has failed since 2026-04-17
-- with: record "new" has no field "price".
--
-- This restores the correct, complete column set by mirroring the sibling
-- wishlist_items_view_update() (which was always correct), using the real
-- `amount` column and dropping the phantom price/enrichment_data/score_data.
-- Encrypted text columns (name, url, why) use the has_auth pattern.
--
-- CREATE OR REPLACE only — the existing wishlist_items_view_insert_trg trigger
-- binds by function name. No view, trigger, index, type, or RLS changes.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.wishlist_items_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.currency_code := COALESCE(NEW.currency_code, 'COP'::text);
  NEW.status := COALESCE(NEW.status, 'wishlist'::text);
  NEW.enriched := COALESCE(NEW.enriched, false);

  INSERT INTO wishlist_items_enc (
    id, user_id, account_id, amount, bought_at, category_id, created_at,
    currency_code, desire_type, enriched, enriched_at, funding_type, image_url,
    installments, last_nudge_dismissed_at, last_score, last_scored_at,
    last_verdict, name, ready_at, status, transaction_id, updated_at, urgency,
    url, why
  ) VALUES (
    NEW.id, NEW.user_id, NEW.account_id, NEW.amount, NEW.bought_at,
    NEW.category_id, NEW.created_at, NEW.currency_code, NEW.desire_type,
    NEW.enriched, NEW.enriched_at, NEW.funding_type, NEW.image_url,
    NEW.installments, NEW.last_nudge_dismissed_at, NEW.last_score,
    NEW.last_scored_at, NEW.last_verdict,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.name) ELSE zeta_encrypt_as(NEW.name, NEW.user_id) END,
    NEW.ready_at, NEW.status, NEW.transaction_id, NEW.updated_at, NEW.urgency,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.url) ELSE zeta_encrypt_as(NEW.url, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.why) ELSE zeta_encrypt_as(NEW.why, NEW.user_id) END
  );
  RETURN NEW;
END;
$function$;
