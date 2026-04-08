-- Add zeta_decrypt_as: decrypt ciphertext using a specific user's DEK
-- Needed by server-side processes (webhooks, cron) that use adminClient
-- without a user JWT, so zeta_decrypt() (which relies on auth.uid()) returns NULL.

CREATE OR REPLACE FUNCTION zeta_decrypt_as(ciphertext BYTEA, target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = target_user_id;

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  RETURN pgp_sym_decrypt(ciphertext, user_dek);
END;
$$;

-- Helper: fetch accounts with decrypted mask fields for a given user.
-- Used by webhooks/cron that run as admin (no JWT → zeta_decrypt returns NULL).
CREATE OR REPLACE FUNCTION get_accounts_with_masks(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  mask TEXT,
  debit_card_mask TEXT,
  pdf_password TEXT,
  account_type public.account_type,
  currency_code public.currency_code,
  current_balance NUMERIC,
  is_demo BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    a.id,
    zeta_decrypt_as(a.mask, p_user_id),
    zeta_decrypt_as(a.debit_card_mask, p_user_id),
    zeta_decrypt_as(a.pdf_password, p_user_id),
    a.account_type,
    a.currency_code,
    a.current_balance,
    a.is_demo
  FROM accounts_enc a
  WHERE a.user_id = p_user_id AND a.is_active = true;
$$;
