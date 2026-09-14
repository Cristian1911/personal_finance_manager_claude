-- ============================================================
-- Backfill: carry recurring-occurrence links through reconciliation.
--
-- Reconciliation keeps both rows of a duplicate pair and hides the
-- superseded one behind transactions.reconciled_into_transaction_id.
-- Until now the recurring link (transactions.recurrence_group_id +
-- recurring_occurrences.transaction_id) stayed on the hidden row when a
-- "Confirmar pago" / screenshot row was reconciled into a later email or
-- statement import. The surviving row then looked unlinked: it kept
-- appearing in "Vincular" as a duplicate, and the paid occurrence pointed
-- at a row no view renders.
--
-- Chains can be several hops long (screenshot → email PDF → statement PDF),
-- so each linked-but-superseded row is walked to the end of its chain.
-- Plain columns only — no encrypted values are touched.
-- ============================================================

BEGIN;

CREATE TEMP TABLE recurring_link_survivors ON COMMIT DROP AS
WITH RECURSIVE chain AS (
  SELECT
    t.id                             AS origin_id,
    t.id                             AS current_id,
    t.reconciled_into_transaction_id AS next_id,
    t.user_id,
    t.recurrence_group_id,
    0                                AS depth
  FROM transactions_enc t
  WHERE t.recurrence_group_id IS NOT NULL
    AND t.reconciled_into_transaction_id IS NOT NULL
  UNION ALL
  SELECT
    c.origin_id,
    n.id,
    n.reconciled_into_transaction_id,
    c.user_id,
    c.recurrence_group_id,
    c.depth + 1
  FROM chain c
  JOIN transactions_enc n ON n.id = c.next_id AND n.user_id = c.user_id
  WHERE c.depth < 16
)
SELECT DISTINCT ON (c.origin_id)
  c.origin_id,
  c.current_id AS survivor_id,
  c.user_id,
  c.recurrence_group_id,
  -- Snapshot BEFORE stamping: a survivor already linked to a different
  -- series must keep that link (one transaction must never pay two
  -- occurrences), so such chains are skipped entirely.
  (
    s.recurrence_group_id IS NULL
    OR s.recurrence_group_id = c.recurrence_group_id
  ) AS carry
FROM chain c
JOIN transactions_enc s ON s.id = c.current_id AND s.user_id = c.user_id
WHERE c.next_id IS NULL
ORDER BY c.origin_id, c.depth DESC;

-- Two chains converging on one survivor with different series would make
-- the stamp below non-deterministic; leave those for manual review.
UPDATE recurring_link_survivors
SET carry = false
WHERE survivor_id IN (
  SELECT survivor_id
  FROM recurring_link_survivors
  WHERE carry
  GROUP BY survivor_id
  HAVING count(DISTINCT recurrence_group_id) > 1
);

-- Survivor inherits the group id only when it has none.
UPDATE transactions_enc s
SET recurrence_group_id = v.recurrence_group_id
FROM recurring_link_survivors v
WHERE v.carry
  AND s.id = v.survivor_id
  AND s.user_id = v.user_id
  AND s.recurrence_group_id IS NULL;

-- Every occurrence paid by a superseded row now points at the visible one.
-- The survivor is an imported ledger row, not a payment the occurrence
-- created, so the link is flagged manual: reverting must unlink it, never
-- delete a bank-verified transaction.
UPDATE recurring_occurrences o
SET transaction_id = v.survivor_id,
    linked_manually = true
FROM recurring_link_survivors v
WHERE v.carry
  AND o.transaction_id = v.origin_id
  AND o.user_id = v.user_id;

-- The superseded row leaves the series so group reads (revert, phantom
-- swap) keep seeing exactly one visible leg.
UPDATE transactions_enc t
SET recurrence_group_id = NULL
FROM recurring_link_survivors v
WHERE v.carry
  AND t.id = v.origin_id
  AND t.user_id = v.user_id;

COMMIT;
