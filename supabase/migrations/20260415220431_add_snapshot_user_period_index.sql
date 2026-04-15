-- Index for getDebtOverviewForMonthCached: filters user_id + period_to <= X + ORDER BY period_to DESC.
-- Without this, PostgreSQL seq-scans statement_snapshots_enc for every historical debt page load.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_statement_snapshots_enc_user_period
  ON statement_snapshots_enc(user_id, period_to DESC NULLS LAST);
