-- Link planning_entries directly to the recurring_occurrences row they settle.
--
-- Previously the webapp inferred which occurrence a planning entry tracks by
-- date proximity at read time. This migration replaces that inference with an
-- explicit foreign key so the relationship is stored, joinable, and stable.
--
-- planning_entries is a PLAIN table (NOT envelope-encrypted — there is no
-- planning_entries_enc real table + view pair). So this is a standard
-- ALTER TABLE, no view/trigger rebuild required.
--
-- RLS: planning_entries already has row-level security enabled with the policy
-- "Users manage own planning entries" USING/WITH CHECK ((select auth.uid()) =
-- user_id) — see 20260407120000_create_cashflow_planner.sql. Adding a column is
-- transparently covered by the existing FOR ALL policy; no policy change needed.

-- ── 1. Direct reference to the settling occurrence ───────────────────────────
-- Explicit constraint name so PostgREST embeds resolve via the hint
--   recurring_occurrences!planning_entries_occurrence_id_fkey
-- ON DELETE SET NULL: deleting an occurrence unlinks the entry, never deletes it.

ALTER TABLE public.planning_entries
  ADD COLUMN occurrence_id uuid NULL
  CONSTRAINT planning_entries_occurrence_id_fkey
  REFERENCES public.recurring_occurrences(id) ON DELETE SET NULL;

-- ── 2. Partial index for reverse lookups and join perf ───────────────────────
-- Most entries are ad-hoc (no occurrence), so index only the linked rows.

CREATE INDEX idx_planning_entries_occurrence_id
  ON public.planning_entries (occurrence_id)
  WHERE occurrence_id IS NOT NULL;

-- ── 3. One-time backfill ─────────────────────────────────────────────────────
-- Link existing entries (recurring_template_id IS NOT NULL, occurrence_id NULL)
-- to their occurrence. Candidate pairs share user_id + template and fall within
-- +/- 3 days. Any occurrence status qualifies (pending/paid/skipped): the FK
-- means "this entry tracks this occurrence", independent of settlement state.
--
-- Uniqueness is enforced in BOTH directions: each entry links at most one
-- occurrence, and each occurrence is linked by at most one entry.
--
-- Two greedy passes so exact-date pairs always win over window pairs (a
-- stranded entry in one period must not steal the occurrence that belongs to
-- another period's exact-dated entry):
--   Pass 1: exact-date matches (distance 0).
--   Pass 2: nearest within 3 days, excluding entries/occurrences claimed in
--           pass 1.
-- Within each pass, DISTINCT ON dedupes per-occurrence and per-entry.
-- Tie-break is deterministic: smaller distance, then earlier entry
-- expected_date, then entry id. Global optimality is not required.
--
-- Dates are DATE columns; (o.occurrence_date - e.expected_date) yields an
-- integer count of days, so abs(...) is the day distance.

WITH exact_pairs AS (
  SELECT
    e.id            AS entry_id,
    e.expected_date AS entry_date,
    o.id            AS occurrence_id
  FROM public.planning_entries e
  JOIN public.recurring_occurrences o
    ON o.user_id     = e.user_id
   AND o.template_id = e.recurring_template_id
   AND o.occurrence_date = e.expected_date
  WHERE e.recurring_template_id IS NOT NULL
    AND e.occurrence_id IS NULL
),
-- one occurrence per entry
exact_entry_dedup AS (
  SELECT DISTINCT ON (entry_id)
    entry_id, entry_date, occurrence_id
  FROM exact_pairs
  ORDER BY entry_id, entry_date, occurrence_id
),
-- one entry per occurrence
exact_final AS (
  SELECT DISTINCT ON (occurrence_id)
    entry_id, occurrence_id
  FROM exact_entry_dedup
  ORDER BY occurrence_id, entry_date, entry_id
),
window_pairs AS (
  SELECT
    e.id            AS entry_id,
    e.expected_date AS entry_date,
    o.id            AS occurrence_id,
    abs(o.occurrence_date - e.expected_date) AS distance
  FROM public.planning_entries e
  JOIN public.recurring_occurrences o
    ON o.user_id     = e.user_id
   AND o.template_id = e.recurring_template_id
   AND abs(o.occurrence_date - e.expected_date) BETWEEN 1 AND 3
  WHERE e.recurring_template_id IS NOT NULL
    AND e.occurrence_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM exact_final xf WHERE xf.entry_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM exact_final xf WHERE xf.occurrence_id = o.id)
),
-- one occurrence per entry (nearest wins)
window_entry_dedup AS (
  SELECT DISTINCT ON (entry_id)
    entry_id, entry_date, occurrence_id, distance
  FROM window_pairs
  ORDER BY entry_id, distance, entry_date, occurrence_id
),
-- one entry per occurrence (nearest wins)
window_final AS (
  SELECT DISTINCT ON (occurrence_id)
    entry_id, occurrence_id
  FROM window_entry_dedup
  ORDER BY occurrence_id, distance, entry_date, entry_id
),
all_matches AS (
  SELECT entry_id, occurrence_id FROM exact_final
  UNION ALL
  SELECT entry_id, occurrence_id FROM window_final
)
UPDATE public.planning_entries e
SET occurrence_id = m.occurrence_id
FROM all_matches m
WHERE e.id = m.entry_id;
