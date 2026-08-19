-- ============================================================================
-- Backfill flow_class, and keep it re-derivable.
--
-- NOT YET APPLIED. Must ship WITH the app deploy, never after it.
--
-- Why it cannot lag the code: the read sites no longer filter
-- `transfer_group_id IS NULL`; they filter `flow_class_effective IN (...)`.
-- Two consequences, both silent:
--
--   * flow_class NULL resolves to 'UNCLASSIFIED', which IS in the counted
--     allow-list. So a legacy row carrying a transfer_group_id — previously
--     excluded — starts counting, on BOTH legs. That is the double count this
--     work exists to remove, relocated from new writes into history.
--
--   * Rows classified under rules v1 keep a v1 verdict. Measured on production:
--     278 rows / $30.830.132 sit at SELF_TRANSFER under v1 that v2 calls SPEND,
--     because v1 let the word "transferencia" decide on its own. Left alone,
--     that much real consumption stays suppressed.
--
-- Earlier backfills were run by hand against a single user. That is why this
-- file exists: a hand-run UPDATE is not reproducible in CI, staging or
-- recovery, and leaves every other user on the pre-fix behaviour with none of
-- the pre-fix protection.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Re-derive, in one pass, the two cases that need it:
--
--   a) flow_class IS NULL          — never classified (written before the
--                                    columns existed).
--   b) flow_class_version < 2      — classified by an older rules version.
--
-- And skip the one case that must NOT be touched:
--
--   c) flow_class_version IS NULL AND flow_class IS NOT NULL
--      — hand-set by a write path the classifier cannot express: a manual
--        balance adjustment (a reconciliation plug, not a movement) and a
--        personal-debt repayment (the counterparty is a person, not an
--        account). Re-deriving those yields SPEND and INCOME respectively,
--        undoing the fix on purpose. The NULL version is the opt-out marker;
--        see FLOW_CLASS_RULES_VERSION in packages/shared.
--
-- flow_class_override is never written here. A human decision outranks any
-- rules version — that is the whole reason the verdict and the correction are
-- two columns instead of one.
--
-- The candidates function is per-user and internally MATERIALIZEs its debt
-- accounts, so the DEK is unwrapped once per user rather than once per row.
-- ---------------------------------------------------------------------------
WITH derived AS (
  SELECT DISTINCT c.id, c.new_flow_class
  FROM (SELECT DISTINCT user_id FROM public.transactions_enc) u
  CROSS JOIN LATERAL public.zeta_flow_class_candidates(u.user_id) c
)
UPDATE public.transactions_enc t
SET flow_class         = d.new_flow_class,
    flow_class_version = 2,
    updated_at         = now()
FROM derived d
WHERE t.id = d.id
  AND (
        t.flow_class IS NULL
        OR (t.flow_class_version IS NOT NULL AND t.flow_class_version < 2)
      );

COMMIT;

-- ---------------------------------------------------------------------------
-- Data-quality view. `flow-class.ts` asks for one and it never existed.
--
-- UNCLASSIFIED sits inside COUNTED_FLOW_CLASSES, so an unclassified row fails
-- OPEN: it keeps counting, which is the safe direction, but it also means
-- nothing ever complains. This is the thing that complains.
--
-- unclassified_rows > 0 means a write path is not calling classifyFlow() and
-- its rows are being counted on a guess.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.zeta_flow_class_health AS
  SELECT
    t.user_id,
    count(*) FILTER (WHERE t.flow_class IS NULL)                  AS unclassified_rows,
    count(*) FILTER (WHERE t.flow_class_version IS NULL
                       AND t.flow_class IS NOT NULL)              AS hand_set_rows,
    count(*) FILTER (WHERE t.flow_class_version IS NOT NULL
                       AND t.flow_class_version < 2)              AS stale_version_rows,
    count(*)                                                      AS total_rows
  FROM public.transactions_enc t
  WHERE coalesce(t.is_excluded, false) = false
    AND t.reconciled_into_transaction_id IS NULL
  GROUP BY t.user_id;

REVOKE ALL ON public.zeta_flow_class_health FROM public, anon, authenticated;
GRANT SELECT ON public.zeta_flow_class_health TO service_role;

COMMENT ON VIEW public.zeta_flow_class_health IS
  'Rows still unclassified, hand-set, or on a stale rules version. unclassified_rows > 0 means a write path is not calling classifyFlow().';
