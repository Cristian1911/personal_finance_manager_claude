-- ============================================================================
-- Create pdf_passwords (encrypted)
--
-- User-owned PDF password vault for the import flow. A user can save
-- reusable PDF passwords scoped to:
--   - 'global'  → try for any PDF
--   - 'bank'    → try for any account under a bank_key
--   - 'account' → specific to one account
--
-- Encrypted columns (BYTEA via envelope encryption):
--   - alias    (user label, e.g. "Cédula Cristian" — PII)
--   - password (the actual PDF password)
--
-- Plaintext columns:
--   - scope, bank_key, account_id, timestamps
--
-- Follows the same pattern as accounts_enc / destinatarios_enc:
--   1. Real table `pdf_passwords_enc` with BYTEA columns
--   2. RLS on _enc using (select auth.uid()) = user_id
--   3. View `pdf_passwords` with zeta_decrypt(...)
--   4. INSTEAD OF INSERT/UPDATE/DELETE triggers with admin-client fallback
--      (zeta_encrypt_as / preserve ciphertext when auth.uid() IS NULL)
--   5. GRANTs on the view for authenticated
--   6. Unique indexes + scope pairing CHECK constraint
-- ============================================================================

-- 1. Real _enc table
CREATE TABLE pdf_passwords_enc (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias       BYTEA NOT NULL,
  password    BYTEA NOT NULL,
  scope       TEXT NOT NULL CHECK (scope IN ('global','bank','account')),
  bank_key    TEXT NULL,
  account_id  UUID NULL REFERENCES accounts_enc(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pdf_passwords_scope_pairing CHECK (
    (scope = 'account' AND account_id IS NOT NULL AND bank_key IS NULL) OR
    (scope = 'bank'    AND bank_key   IS NOT NULL AND account_id IS NULL) OR
    (scope = 'global'  AND account_id IS NULL      AND bank_key   IS NULL)
  )
);

-- Helpful indexes
CREATE INDEX idx_pdf_passwords_enc_user
  ON pdf_passwords_enc (user_id);
CREATE INDEX idx_pdf_passwords_enc_user_scope
  ON pdf_passwords_enc (user_id, scope);
CREATE INDEX idx_pdf_passwords_enc_user_bank
  ON pdf_passwords_enc (user_id, bank_key)
  WHERE bank_key IS NOT NULL;
CREATE INDEX idx_pdf_passwords_enc_user_account
  ON pdf_passwords_enc (user_id, account_id)
  WHERE account_id IS NOT NULL;

-- Prevent duplicate scope targets per user (e.g. two 'account' rows for same account)
CREATE UNIQUE INDEX pdf_passwords_enc_user_scope_target_unique
  ON pdf_passwords_enc (
    user_id,
    scope,
    COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(bank_key, '')
  );

-- 2. RLS on the _enc table
ALTER TABLE pdf_passwords_enc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own pdf_passwords"
  ON pdf_passwords_enc FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own pdf_passwords"
  ON pdf_passwords_enc FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own pdf_passwords"
  ON pdf_passwords_enc FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own pdf_passwords"
  ON pdf_passwords_enc FOR DELETE
  USING ((select auth.uid()) = user_id);

-- 3. Decrypted view
CREATE VIEW pdf_passwords WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  zeta_decrypt(alias) AS alias,
  zeta_decrypt(password) AS password,
  scope,
  bank_key,
  account_id,
  created_at,
  updated_at
FROM pdf_passwords_enc;

-- 4a. INSTEAD OF INSERT
CREATE OR REPLACE FUNCTION pdf_passwords_view_insert() RETURNS TRIGGER AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id         := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());

  INSERT INTO pdf_passwords_enc (
    id, user_id, alias, password, scope, bank_key, account_id,
    created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.user_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.alias)    ELSE zeta_encrypt_as(NEW.alias, NEW.user_id)    END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.password) ELSE zeta_encrypt_as(NEW.password, NEW.user_id) END,
    NEW.scope,
    NEW.bank_key,
    NEW.account_id,
    NEW.created_at,
    NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pdf_passwords_view_insert_trg
  INSTEAD OF INSERT ON pdf_passwords
  FOR EACH ROW EXECUTE FUNCTION pdf_passwords_view_insert();

-- 4b. INSTEAD OF UPDATE
-- When has_auth is false (admin client), preserve existing ciphertext for
-- encrypted columns because the view's NEW.alias / NEW.password come from
-- zeta_decrypt() which returns NULL without an auth session.
CREATE OR REPLACE FUNCTION pdf_passwords_view_update() RETURNS TRIGGER AS $$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  UPDATE pdf_passwords_enc SET
    alias = CASE
      WHEN has_auth THEN zeta_encrypt(NEW.alias)
      ELSE (SELECT pe.alias FROM pdf_passwords_enc pe WHERE pe.id = OLD.id)
    END,
    password = CASE
      WHEN has_auth THEN zeta_encrypt(NEW.password)
      ELSE (SELECT pe.password FROM pdf_passwords_enc pe WHERE pe.id = OLD.id)
    END,
    scope       = NEW.scope,
    bank_key    = NEW.bank_key,
    account_id  = NEW.account_id,
    updated_at  = COALESCE(NEW.updated_at, now())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pdf_passwords_view_update_trg
  INSTEAD OF UPDATE ON pdf_passwords
  FOR EACH ROW EXECUTE FUNCTION pdf_passwords_view_update();

-- 4c. INSTEAD OF DELETE
CREATE OR REPLACE FUNCTION pdf_passwords_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM pdf_passwords_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pdf_passwords_view_delete_trg
  INSTEAD OF DELETE ON pdf_passwords
  FOR EACH ROW EXECUTE FUNCTION pdf_passwords_view_delete();

-- 5. Grants on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON pdf_passwords TO authenticated;
GRANT ALL ON pdf_passwords TO postgres, service_role;
