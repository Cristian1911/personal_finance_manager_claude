-- ==================================================
-- Optimize zeta_decrypt: cache DEK per transaction
-- ==================================================
-- Before: each zeta_decrypt() call queries vault.decrypted_secrets + user_encryption_keys
-- After: first call caches the decrypted DEK in a transaction-local session variable;
--        subsequent calls within the same statement/transaction skip both lookups.
--
-- Impact: a query returning 10 accounts × 6 encrypted cols goes from
--         60 vault lookups → 1 vault lookup + 59 session var reads.

-- 1. Optimized zeta_decrypt — cache DEK in session variable
CREATE OR REPLACE FUNCTION zeta_decrypt(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  user_dek TEXT;
  master_key TEXT;
  current_uid UUID;
BEGIN
  IF ciphertext IS NULL THEN RETURN NULL; END IF;

  current_uid := (SELECT auth.uid());

  -- Try cached DEK first (transaction-local)
  user_dek := current_setting('zeta.cached_dek', true);

  -- Validate cache belongs to current user
  IF user_dek IS NOT NULL AND current_setting('zeta.cached_uid', true) = current_uid::text THEN
    RETURN pgp_sym_decrypt(ciphertext, user_dek);
  END IF;

  -- Cache miss: fetch master key + decrypt DEK
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = current_uid;

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  -- Cache for remainder of this transaction
  PERFORM set_config('zeta.cached_dek', user_dek, true);
  PERFORM set_config('zeta.cached_uid', current_uid::text, true);

  RETURN pgp_sym_decrypt(ciphertext, user_dek);
END;
$$;

-- 2. Optimized zeta_encrypt — same caching pattern
CREATE OR REPLACE FUNCTION zeta_encrypt(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  user_dek TEXT;
  master_key TEXT;
  current_uid UUID;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  current_uid := (SELECT auth.uid());

  -- Try cached DEK first
  user_dek := current_setting('zeta.cached_dek', true);

  IF user_dek IS NOT NULL AND current_setting('zeta.cached_uid', true) = current_uid::text THEN
    RETURN pgp_sym_encrypt(plaintext, user_dek);
  END IF;

  -- Cache miss
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = current_uid;

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', current_uid;
  END IF;

  PERFORM set_config('zeta.cached_dek', user_dek, true);
  PERFORM set_config('zeta.cached_uid', current_uid::text, true);

  RETURN pgp_sym_encrypt(plaintext, user_dek);
END;
$$;

-- 3. Optimized zeta_hmac — same caching pattern
CREATE OR REPLACE FUNCTION zeta_hmac(plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  user_dek TEXT;
  master_key TEXT;
  current_uid UUID;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  current_uid := (SELECT auth.uid());

  -- Try cached DEK first
  user_dek := current_setting('zeta.cached_dek', true);

  IF user_dek IS NOT NULL AND current_setting('zeta.cached_uid', true) = current_uid::text THEN
    RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
  END IF;

  -- Cache miss
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = current_uid;

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  PERFORM set_config('zeta.cached_dek', user_dek, true);
  PERFORM set_config('zeta.cached_uid', current_uid::text, true);

  RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
END;
$$;
