-- Financial reminders: lightweight one-time financial todos
CREATE TABLE financial_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric(15,2),
  currency_code text DEFAULT 'COP',
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financial_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminders"
  ON financial_reminders FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_financial_reminders_user_pending
  ON financial_reminders (user_id, is_completed, due_date)
  WHERE NOT is_completed;
