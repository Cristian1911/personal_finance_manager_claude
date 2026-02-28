-- statement_snapshots was created without updated_at, which breaks the
-- mobile incremental sync (pull.ts queries .gt("updated_at", lastSyncedAt)
-- on every table). This migration adds the column and a trigger to keep it
-- current on every row update.

ALTER TABLE statement_snapshots
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill so existing rows have a sensible timestamp
UPDATE statement_snapshots SET updated_at = created_at;

-- Trigger function (shared pattern; safe to recreate idempotently)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_statement_snapshots_updated_at
  BEFORE UPDATE ON statement_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
