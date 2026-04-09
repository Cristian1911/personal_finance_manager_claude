CREATE TABLE recurring_occurrence_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES recurring_transaction_templates_enc(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  skipped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, occurrence_date)
);

ALTER TABLE recurring_occurrence_skips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skips"
  ON recurring_occurrence_skips
  FOR ALL
  USING ((select auth.uid()) = user_id);
