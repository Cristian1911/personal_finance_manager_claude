-- ==================================================
-- Add indexes on HMAC/hash columns for lookup
-- (blocking indexes already dropped in per-table migrations)
-- ==================================================

CREATE INDEX idx_transactions_merchant_hmac
  ON transactions_enc (user_id, merchant_name_hmac);

CREATE INDEX idx_transactions_description_hmac
  ON transactions_enc (user_id, clean_description_hmac);

CREATE INDEX idx_accounts_mask_hmac
  ON accounts_enc (user_id, mask_hmac);

CREATE INDEX idx_destinatarios_name_hmac
  ON destinatarios_enc (user_id, name_hmac);

CREATE UNIQUE INDEX idx_capture_tokens_hash
  ON capture_tokens_enc (token_hash);
