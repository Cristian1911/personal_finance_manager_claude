-- Cashflow planner: period-based envelope budgeting
-- Users plan income & expenses for a period, then assign expenses to income "pockets"

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE planning_period_preset AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM');
CREATE TYPE planning_entry_type AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE planning_entry_status AS ENUM ('PLANNED', 'COMPLETED', 'SKIPPED');

-- ── Planning Periods ─────────────────────────────────────────────────────────

CREATE TABLE planning_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text,
  preset        planning_period_preset NOT NULL DEFAULT 'MONTHLY',
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  currency_code currency_code NOT NULL DEFAULT 'COP',
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

ALTER TABLE planning_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own planning periods"
  ON planning_periods FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_planning_periods_user_active
  ON planning_periods (user_id, is_active, start_date DESC);

CREATE TRIGGER set_planning_periods_updated_at
  BEFORE UPDATE ON planning_periods
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ── Planning Entries (income + expense items) ────────────────────────────────

CREATE TABLE planning_entries (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id              uuid NOT NULL REFERENCES planning_periods(id) ON DELETE CASCADE,
  entry_type             planning_entry_type NOT NULL,
  label                  text NOT NULL,
  amount                 numeric(15,2) NOT NULL CHECK (amount > 0),
  expected_date          date NOT NULL,
  status                 planning_entry_status NOT NULL DEFAULT 'PLANNED',
  completed_at           timestamptz,
  recurring_template_id  uuid REFERENCES recurring_transaction_templates(id) ON DELETE SET NULL,
  account_id             uuid REFERENCES accounts(id) ON DELETE SET NULL,
  category_id            uuid REFERENCES categories(id) ON DELETE SET NULL,
  sort_order             int NOT NULL DEFAULT 0,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE planning_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own planning entries"
  ON planning_entries FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_planning_entries_period
  ON planning_entries (period_id, entry_type, expected_date);

CREATE TRIGGER set_planning_entries_updated_at
  BEFORE UPDATE ON planning_entries
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ── Planning Assignments (which income funds which expense) ──────────────────

CREATE TABLE planning_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id        uuid NOT NULL REFERENCES planning_periods(id) ON DELETE CASCADE,
  income_entry_id  uuid NOT NULL REFERENCES planning_entries(id) ON DELETE CASCADE,
  expense_entry_id uuid NOT NULL REFERENCES planning_entries(id) ON DELETE CASCADE,
  assigned_amount  numeric(15,2) NOT NULL CHECK (assigned_amount > 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_assignment UNIQUE (income_entry_id, expense_entry_id)
);

ALTER TABLE planning_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own planning assignments"
  ON planning_assignments FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_planning_assignments_income
  ON planning_assignments (income_entry_id);

CREATE INDEX idx_planning_assignments_expense
  ON planning_assignments (expense_entry_id);

CREATE TRIGGER set_planning_assignments_updated_at
  BEFORE UPDATE ON planning_assignments
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
