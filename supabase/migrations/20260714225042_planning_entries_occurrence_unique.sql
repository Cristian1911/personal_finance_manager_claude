-- Make the 1:1 planning_entry ↔ recurring_occurrence invariant durable.
--
-- App code already enforces it (claim checks in seedPeriodFromRecurring,
-- FK-claimed exclusion in hydrate's fallback pool, and the backfill in
-- 20260714223524 deduped in both directions — verified zero duplicates in
-- prod). But two concurrent seeds (double-click "Sincronizar", webapp racing
-- a mobile write) could both read "unclaimed" and link/insert twice; a
-- partial UNIQUE index turns that race into a 23505 the caller surfaces,
-- instead of a silent double-count of one payment across two entries.
--
-- Replaces the non-unique partial index from 20260714223524 — the unique
-- index serves the same lookups.

DROP INDEX IF EXISTS public.idx_planning_entries_occurrence_id;

CREATE UNIQUE INDEX planning_entries_occurrence_id_key
  ON public.planning_entries (occurrence_id)
  WHERE occurrence_id IS NOT NULL;
