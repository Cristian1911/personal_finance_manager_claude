-- ============================================================================
-- Point the MCP analysis RPCs at the stored verdict, and retire the
-- category-dependent classifier.
--
-- This captures two changes that were applied to the project directly and, for
-- a while, existed nowhere in this repo — so a `supabase db push` against a
-- fresh environment (CI, staging, recovery) would have silently rebuilt the
-- pre-fix version: 21s per call and a classifier that goes stale whenever the
-- user re-categorises. Caught by the perf audit; the file is the fix.
--
-- SEQUENCING NOTE: zeta_flow_class was introduced in 20260806150000 under a NEW
-- name, so zeta_mcp_flow_class stayed resolvable through verification and
-- backfill. The caller is replaced FIRST and the old function dropped SECOND,
-- inside one transaction. A string-bodied LANGUAGE sql function records no
-- pg_depend edge on the functions it calls, so Postgres will happily let you
-- drop zeta_mcp_flow_class with zeta_mcp_tx_base still pointing at it and fail
-- only at call time. Order is not optional.
-- ============================================================================

BEGIN;

-- Reads the stored verdict; does NOT recompute.
--
-- An earlier revision kept an on-the-fly fallback so callers "never see
-- UNCLASSIFIED". That was wrong twice:
--
--  * Cost. coalesce() short-circuits, but the counterpart and destination-match
--    LATERAL joins live in the FROM clause and therefore execute for EVERY row
--    whether or not their result is used. Measured on production: 21.4s for
--    2034 rows, all of it discarded because every row already had a verdict.
--    Removing them: 2.29s.
--
--  * Honesty. The 'UNCLASSIFIED' floor exists precisely to make an unclassified
--    row visible. Reclassifying it on the fly hides the gap the floor was added
--    to reveal — including from the data-quality checks meant to report it.
--
-- Rows written by a path that does not yet call classifyFlow() surface as
-- UNCLASSIFIED. That is the signal, not a defect.
CREATE OR REPLACE FUNCTION public.zeta_mcp_tx_base(
  p_user_id uuid,
  p_from    date default null,
  p_to      date default null
) RETURNS TABLE (
  id                  uuid,
  transaction_date    date,
  amount              numeric,
  currency_code       text,
  direction           text,
  description         text,
  merchant            text,
  notes               text,
  category            text,
  parent_category     text,
  category_id         uuid,
  expense_type        text,
  is_essential        boolean,
  account_id          uuid,
  account_name        text,
  account_type        text,
  capture_method      text,
  is_subscription     boolean,
  installment_current smallint,
  installment_total   smallint,
  flow_class          text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    t.id,
    t.transaction_date,
    coalesce(t.amount_in_base_currency, t.amount),
    t.currency_code::text,
    t.direction::text,
    coalesce(
      nullif(zeta_decrypt_as(t.merchant_name,     t.user_id), ''),
      nullif(zeta_decrypt_as(t.clean_description, t.user_id), ''),
      nullif(zeta_decrypt_as(t.raw_description,   t.user_id), ''),
      ''
    ),
    nullif(zeta_decrypt_as(t.merchant_name, t.user_id), ''),
    nullif(zeta_decrypt_as(t.notes, t.user_id), ''),
    coalesce(c.name_es, c.name),
    coalesce(p.name_es, p.name),
    t.category_id,
    c.expense_type,
    c.is_essential,
    t.account_id,
    nullif(zeta_decrypt_as(a.name, a.user_id), ''),
    a.account_type::text,
    t.capture_method::text,
    t.is_subscription,
    t.installment_current,
    t.installment_total,
    t.flow_class_effective
  FROM transactions_enc t
  JOIN accounts_enc a ON a.id = t.account_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN categories p ON p.id = c.parent_id
  WHERE t.user_id = p_user_id
    AND coalesce(t.is_excluded, false) = false
    AND t.reconciled_into_transaction_id IS NULL
    AND t.status <> 'CANCELLED'
    AND (p_from IS NULL OR t.transaction_date >= p_from)
    AND (p_to   IS NULL OR t.transaction_date <= p_to);
$$;

-- Retired: it took category/parent_category, so the verdict went stale every
-- time the user re-categorised. Replaced by zeta_flow_class (20260806150000),
-- which is category-free by design.
DROP FUNCTION IF EXISTS public.zeta_mcp_flow_class(text, text, text, text, text);

REVOKE ALL ON FUNCTION public.zeta_mcp_tx_base(uuid, date, date) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zeta_mcp_tx_base(uuid, date, date) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
