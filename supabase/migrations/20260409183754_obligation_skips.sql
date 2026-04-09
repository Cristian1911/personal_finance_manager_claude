-- Generalize recurring_occurrence_skips into a broader obligation_skips table
-- that can skip ANY pending obligation (recurring OR statement snapshot).
--
-- Key format:
--   recurring: "recurring:{template_id}:{occurrence_date}"
--   statement: "statement:{snapshot_id}"

CREATE TABLE obligation_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  obligation_key text NOT NULL,
  skipped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, obligation_key)
);

ALTER TABLE obligation_skips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own obligation skips"
  ON obligation_skips
  FOR ALL
  USING ((select auth.uid()) = user_id);

-- Migrate existing data from recurring_occurrence_skips
INSERT INTO obligation_skips (user_id, obligation_key, skipped_at)
SELECT user_id, 'recurring:' || template_id || ':' || occurrence_date, skipped_at
FROM recurring_occurrence_skips
ON CONFLICT DO NOTHING;

-- Drop old table
DROP TABLE recurring_occurrence_skips;
