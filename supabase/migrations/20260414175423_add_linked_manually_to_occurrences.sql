-- Add flag to distinguish manually-linked occurrences from system-created ones.
-- revertOccurrence uses this to decide: unlink-only (manual) vs delete-tx (system).
ALTER TABLE recurring_occurrences
  ADD COLUMN linked_manually boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN recurring_occurrences.linked_manually IS
  'true when user manually linked a pre-existing transaction; false when system-created via recordRecurringOccurrencePayment or auto-linked via linkTransactionToOccurrence';
