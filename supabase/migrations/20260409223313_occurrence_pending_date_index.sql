-- Covering partial index for pending occurrence date range queries.
-- Used by findMatchingOccurrence, getPendingOccurrencesCached, and getAttentionItemsCached.
CREATE INDEX idx_recurring_occurrences_user_pending_date
  ON recurring_occurrences(user_id, occurrence_date)
  WHERE status = 'pending';
