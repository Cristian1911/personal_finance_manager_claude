-- Fix: transaction_tags has no index on transaction_id.
-- The FK constraint does NOT auto-create an index in PostgreSQL.
-- The new tags join in getRecentTransactions and movimientos hits this on every render.
CREATE INDEX IF NOT EXISTS idx_transaction_tags_transaction_id
  ON public.transaction_tags(transaction_id);

-- Fix: getLatestSnapshotDates performs a full table scan.
-- Neither existing index starts with user_id. Now used in MobileZone's Promise.all.
CREATE INDEX IF NOT EXISTS idx_statement_snapshots_enc_user_created
  ON statement_snapshots_enc(user_id, created_at DESC);
