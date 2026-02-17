-- Change transactions.account_id FK to cascade deletes from accounts
-- so deleting an account removes all its transactions automatically.
ALTER TABLE transactions
  DROP CONSTRAINT transactions_account_id_fkey,
  ADD CONSTRAINT transactions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
