-- Recovered from production's migration history (applied there on 2026-08-06
-- as version 20260806184218) — it was never committed to the repo. Recorded here
-- on 2026-09-29 while aligning production's history with this folder.
-- Idempotent (CREATE OR REPLACE); already in effect in production.

-- zeta_mcp_tx_base: read the stored verdict, do not recompute.
--
-- The previous version kept an on-the-fly fallback so callers "never see
-- UNCLASSIFIED". That was a bad trade on both counts:
--
--  * Cost. coalesce() short-circuits, but the counterpart and destination-match
--    LATERAL joins live in the FROM clause and therefore execute for EVERY row
--    regardless of whether their result is used. Measured: 21.4s for 2034 rows.
--    Every row already has a stored verdict, so all of that work was discarded.
--
--  * Honesty. The 'UNCLASSIFIED' sentinel exists precisely to make an
--    unclassified row visible. Silently reclassifying it hides the gap the
--    sentinel was added to reveal, and hides it from the data-quality checks
--    that should be reporting it.
--
-- Rows written by a path that does not yet call classifyFlow surface as
-- UNCLASSIFIED. That is the intended signal, not a defect.

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

REVOKE ALL ON FUNCTION public.zeta_mcp_tx_base(uuid, date, date) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zeta_mcp_tx_base(uuid, date, date) TO service_role;
