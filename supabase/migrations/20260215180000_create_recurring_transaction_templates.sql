-- Enum for recurrence frequency
CREATE TYPE recurrence_frequency AS ENUM (
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL'
);

-- Recurring transaction templates
CREATE TABLE recurring_transaction_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Transaction template data
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency_code currency_code NOT NULL DEFAULT 'COP',
  direction transaction_direction NOT NULL,
  merchant_name TEXT,
  description TEXT,

  -- Schedule
  frequency recurrence_frequency NOT NULL,
  day_of_month INT CHECK (day_of_month BETWEEN 1 AND 31),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday

  -- Lifecycle
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE recurring_transaction_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recurring templates"
  ON recurring_transaction_templates
  FOR ALL
  USING ((SELECT auth.uid()) = user_id);

-- Enable moddatetime extension if not already active
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- Auto-update updated_at via moddatetime
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON recurring_transaction_templates
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
