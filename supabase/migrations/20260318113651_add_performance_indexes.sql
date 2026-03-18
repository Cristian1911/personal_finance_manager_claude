-- Most impactful: dashboard budget/spending queries scan by user+date on every page load
CREATE INDEX idx_transactions_user_date
  ON transactions(user_id, transaction_date DESC);

-- Budget lookups by user+period (monthly/yearly)
CREATE INDEX idx_budgets_user_period
  ON budgets(user_id, period);

-- Category reassignment on delete (bulk update by category)
CREATE INDEX idx_transactions_category_user
  ON transactions(category_id, user_id)
  WHERE reconciled_into_transaction_id IS NULL;

-- Category tree queries (user's active categories)
CREATE INDEX idx_categories_user_active
  ON categories(user_id, is_active)
  WHERE user_id IS NOT NULL;
