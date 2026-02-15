-- Statement snapshots: stores metadata from each imported PDF statement
-- Enables monthly reload tracking and diff comparison over time

CREATE TABLE statement_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Statement period
  period_from     DATE,
  period_to       DATE,

  -- Summary (from StatementSummary)
  previous_balance      NUMERIC(15,2),
  total_credits         NUMERIC(15,2),
  total_debits          NUMERIC(15,2),
  final_balance         NUMERIC(15,2),
  purchases_and_charges NUMERIC(15,2),
  interest_charged      NUMERIC(15,2),

  -- Credit card metadata (from CreditCardMetadata)
  credit_limit          NUMERIC(15,2),
  available_credit      NUMERIC(15,2),
  interest_rate         NUMERIC(6,4),
  late_interest_rate    NUMERIC(6,4),
  total_payment_due     NUMERIC(15,2),
  minimum_payment       NUMERIC(15,2),
  payment_due_date      DATE,

  -- Import stats
  transaction_count     INT NOT NULL DEFAULT 0,
  imported_count        INT NOT NULL DEFAULT 0,
  skipped_count         INT NOT NULL DEFAULT 0,

  -- Metadata
  currency_code         TEXT NOT NULL DEFAULT 'COP',
  source_filename       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For efficient queries by account ordered by period
CREATE INDEX idx_statement_snapshots_account_period
  ON statement_snapshots(account_id, period_to DESC);

-- Unique index using COALESCE to handle NULL periods
CREATE UNIQUE INDEX idx_statement_snapshots_unique_period
  ON statement_snapshots(
    account_id,
    COALESCE(period_from, '1970-01-01'::date),
    COALESCE(period_to, '1970-01-01'::date)
  );

-- RLS
ALTER TABLE statement_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots"
  ON statement_snapshots FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own snapshots"
  ON statement_snapshots FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own snapshots"
  ON statement_snapshots FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);
