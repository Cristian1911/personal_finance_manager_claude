-- Add JSONB column to store per-currency balance data for multi-currency accounts
-- (e.g., credit cards with both COP and USD debt)
ALTER TABLE accounts ADD COLUMN currency_balances JSONB DEFAULT NULL;

COMMENT ON COLUMN accounts.currency_balances IS
  'Per-currency balance data: { "COP": { current_balance, credit_limit, available_balance, interest_rate, minimum_payment, total_payment_due }, "USD": { ... } }';
