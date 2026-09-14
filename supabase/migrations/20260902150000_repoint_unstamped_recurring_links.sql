-- ============================================================
-- Backfill (part 2): occurrences paid by a superseded row that never got
-- a recurrence_group_id.
--
-- The previous backfill seeded its chains from rows carrying a
-- recurrence_group_id. `markOccurrencePaid` stamps that column in a
-- separate best-effort update, so a handful of occurrences point at a
-- reconciled-away row whose group was never written. Walk those to the
-- surviving row too, stamping the deterministic group id the app uses
-- (`computeRecurringGroupUuid`: SHA-256 of "template_id|occurrence_date",
-- first 16 bytes, RFC version/variant bits forced) so the survivor joins
-- the series exactly as the webapp would have linked it.
-- ============================================================

BEGIN;

CREATE TEMP TABLE unstamped_link_survivors ON COMMIT DROP AS
WITH RECURSIVE chain AS (
  SELECT
    o.id                             AS occurrence_id,
    o.user_id,
    t.id                             AS origin_id,
    t.id                             AS current_id,
    t.reconciled_into_transaction_id AS next_id,
    0                                AS depth,
    (
      SELECT encode(
        set_byte(
          set_byte(b, 6, (get_byte(b, 6) & 15) | 64),
          8, (get_byte(b, 8) & 63) | 128
        ), 'hex')::uuid
      FROM (
        SELECT substring(
          extensions.digest(o.template_id::text || '|' || o.occurrence_date::text, 'sha256')
          FROM 1 FOR 16
        ) AS b
      ) x
    ) AS recurrence_group_id
  FROM recurring_occurrences o
  JOIN transactions_enc t ON t.id = o.transaction_id AND t.user_id = o.user_id
  WHERE t.reconciled_into_transaction_id IS NOT NULL
    AND t.recurrence_group_id IS NULL
  UNION ALL
  SELECT
    c.occurrence_id,
    c.user_id,
    c.origin_id,
    n.id,
    n.reconciled_into_transaction_id,
    c.depth + 1,
    c.recurrence_group_id
  FROM chain c
  JOIN transactions_enc n ON n.id = c.next_id AND n.user_id = c.user_id
  WHERE c.depth < 16
)
SELECT DISTINCT ON (c.occurrence_id)
  c.occurrence_id,
  c.user_id,
  c.origin_id,
  c.current_id AS survivor_id,
  c.recurrence_group_id,
  (
    s.recurrence_group_id IS NULL
    OR s.recurrence_group_id = c.recurrence_group_id
  ) AS carry
FROM chain c
JOIN transactions_enc s ON s.id = c.current_id AND s.user_id = c.user_id
WHERE c.next_id IS NULL
ORDER BY c.occurrence_id, c.depth DESC;

UPDATE unstamped_link_survivors
SET carry = false
WHERE survivor_id IN (
  SELECT survivor_id
  FROM unstamped_link_survivors
  WHERE carry
  GROUP BY survivor_id
  HAVING count(DISTINCT recurrence_group_id) > 1
);

UPDATE transactions_enc s
SET recurrence_group_id = v.recurrence_group_id
FROM unstamped_link_survivors v
WHERE v.carry
  AND s.id = v.survivor_id
  AND s.user_id = v.user_id
  AND s.recurrence_group_id IS NULL;

UPDATE recurring_occurrences o
SET transaction_id = v.survivor_id,
    linked_manually = true
FROM unstamped_link_survivors v
WHERE v.carry
  AND o.id = v.occurrence_id
  AND o.user_id = v.user_id;

COMMIT;
