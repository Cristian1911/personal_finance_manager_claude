-- Materialized recurring occurrences — one row per expected payment instance.
-- Replaces the computed-in-JS model + obligation_skips text keys.
-- Status flows: pending → paid (linked to transaction) or skipped.

-- Status enum for occurrence lifecycle
CREATE TYPE occurrence_status AS ENUM ('pending', 'paid', 'skipped');

-- Materialized recurring occurrences
CREATE TABLE recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES recurring_transaction_templates_enc(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  expected_amount numeric(15,2) NOT NULL,
  status occurrence_status NOT NULL DEFAULT 'pending',
  transaction_id uuid REFERENCES transactions_enc(id) ON DELETE SET NULL,
  skipped_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Each template can have at most one occurrence per date
  UNIQUE(template_id, occurrence_date)
);

-- RLS
ALTER TABLE recurring_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own occurrences"
  ON recurring_occurrences
  FOR ALL
  USING ((select auth.uid()) = user_id);

-- Indexes for common queries
CREATE INDEX idx_recurring_occurrences_user_status
  ON recurring_occurrences(user_id, status)
  WHERE status = 'pending';

CREATE INDEX idx_recurring_occurrences_template
  ON recurring_occurrences(template_id, occurrence_date);

CREATE INDEX idx_recurring_occurrences_transaction
  ON recurring_occurrences(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- Migrate data from obligation_skips (recurring skips only)
INSERT INTO recurring_occurrences (user_id, template_id, occurrence_date, expected_amount, status, skipped_at)
SELECT
  os.user_id,
  (regexp_match(os.obligation_key, '^recurring:([0-9a-f-]+):'))[1]::uuid,
  (regexp_match(os.obligation_key, ':(\d{4}-\d{2}-\d{2})$'))[1]::date,
  COALESCE(t.amount, 0),
  'skipped'::occurrence_status,
  os.skipped_at
FROM obligation_skips os
LEFT JOIN recurring_transaction_templates_enc t
  ON t.id = (regexp_match(os.obligation_key, '^recurring:([0-9a-f-]+):'))[1]::uuid
WHERE os.obligation_key LIKE 'recurring:%'
ON CONFLICT (template_id, occurrence_date) DO NOTHING;

-- Drop old table (statement skips are no longer used)
DROP TABLE IF EXISTS obligation_skips;
