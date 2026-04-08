-- ==================================================
-- Envelope Encryption Infrastructure
-- ==================================================

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Supabase installs pgcrypto in the extensions schema
SET search_path = public, extensions;

-- 1. Create master key (KEK) in Vault
SELECT vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'zeta_master_key',
  'Master encryption key for Zeta envelope encryption'
);

-- 2. Create per-user encryption key table
CREATE TABLE user_encryption_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_dek BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_key" ON user_encryption_keys
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- 3. zeta_encrypt — encrypt plaintext using calling user's DEK
CREATE OR REPLACE FUNCTION zeta_encrypt(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = (SELECT auth.uid());

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', (SELECT auth.uid());
  END IF;

  RETURN pgp_sym_encrypt(plaintext, user_dek);
END;
$$;

-- 4. zeta_decrypt — decrypt ciphertext using calling user's DEK
CREATE OR REPLACE FUNCTION zeta_decrypt(ciphertext BYTEA)
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
  FROM user_encryption_keys WHERE user_id = (SELECT auth.uid());

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  RETURN pgp_sym_decrypt(ciphertext, user_dek);
END;
$$;

-- 5. zeta_encrypt_as — encrypt using specific user's DEK (migration only)
CREATE OR REPLACE FUNCTION zeta_encrypt_as(plaintext TEXT, target_user_id UUID)
RETURNS BYTEA
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  master_key TEXT;
  user_dek TEXT;
BEGIN
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = target_user_id;

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', target_user_id;
  END IF;

  RETURN pgp_sym_encrypt(plaintext, user_dek);
END;
$$;

-- 6. zeta_hmac — compute blind index using calling user's DEK
CREATE OR REPLACE FUNCTION zeta_hmac(plaintext TEXT)
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
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = (SELECT auth.uid());

  IF user_dek IS NULL THEN RETURN NULL; END IF;

  RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
END;
$$;

-- 7. zeta_hmac_as — compute HMAC using specific user's DEK (migration only)
CREATE OR REPLACE FUNCTION zeta_hmac_as(plaintext TEXT, target_user_id UUID)
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
  IF plaintext IS NULL THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  SELECT pgp_sym_decrypt(encrypted_dek, master_key) INTO user_dek
  FROM user_encryption_keys WHERE user_id = target_user_id;

  IF user_dek IS NULL THEN
    RAISE EXCEPTION 'No encryption key found for user %', target_user_id;
  END IF;

  RETURN encode(hmac(lower(plaintext), user_dek, 'sha256'), 'hex');
END;
$$;

-- 8. Restrict _as functions to postgres role only
REVOKE ALL ON FUNCTION zeta_encrypt_as(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION zeta_hmac_as(TEXT, UUID) FROM PUBLIC;

-- 9. Signup trigger — generate DEK for new users
CREATE OR REPLACE FUNCTION handle_new_user_encryption_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  master_key TEXT;
  new_dek TEXT;
BEGIN
  SELECT decrypted_secret INTO master_key
  FROM vault.decrypted_secrets WHERE name = 'zeta_master_key';

  new_dek := encode(gen_random_bytes(32), 'hex');

  INSERT INTO user_encryption_keys (user_id, encrypted_dek)
  VALUES (NEW.id, pgp_sym_encrypt(new_dek, master_key));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_encryption_key
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_encryption_key();

-- 10. Generate DEKs for existing users
INSERT INTO user_encryption_keys (user_id, encrypted_dek)
SELECT
  id,
  pgp_sym_encrypt(
    encode(gen_random_bytes(32), 'hex'),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'zeta_master_key')
  )
FROM auth.users
ON CONFLICT DO NOTHING;
