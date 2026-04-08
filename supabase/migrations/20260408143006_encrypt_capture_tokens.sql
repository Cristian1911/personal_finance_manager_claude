-- ==================================================
-- Encrypt capture_tokens table (2 encrypted, 1 hash)
-- ==================================================

ALTER TABLE capture_tokens RENAME TO capture_tokens_enc;

-- token_hash: SHA-256 of plaintext token for unauthenticated lookup
-- NOT a per-user HMAC — system-wide hash for API auth flow
ALTER TABLE capture_tokens_enc ADD COLUMN token_hash TEXT;
UPDATE capture_tokens_enc SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token IS NOT NULL;
ALTER TABLE capture_tokens_enc ALTER COLUMN token_hash SET NOT NULL;

ALTER TABLE capture_tokens_enc
  ALTER COLUMN token TYPE BYTEA USING zeta_encrypt_as(token, user_id);
ALTER TABLE capture_tokens_enc
  ALTER COLUMN label TYPE BYTEA USING zeta_encrypt_as(label, user_id);

CREATE VIEW capture_tokens WITH (security_invoker = true) AS
SELECT
  created_at, default_account_id, id,
  zeta_decrypt(label) AS label,
  last_used_at, revoked_at,
  zeta_decrypt(token) AS token,
  token_hash, user_id
FROM capture_tokens_enc;

CREATE OR REPLACE FUNCTION capture_tokens_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO capture_tokens_enc (
    created_at, default_account_id, id, label, last_used_at, revoked_at,
    token, token_hash, user_id
  ) VALUES (
    NEW.created_at, NEW.default_account_id, NEW.id,
    zeta_encrypt(NEW.label),
    NEW.last_used_at, NEW.revoked_at,
    zeta_encrypt(NEW.token),
    encode(digest(NEW.token, 'sha256'), 'hex'),
    NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER capture_tokens_view_insert_trg
  INSTEAD OF INSERT ON capture_tokens
  FOR EACH ROW EXECUTE FUNCTION capture_tokens_view_insert();

CREATE OR REPLACE FUNCTION capture_tokens_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE capture_tokens_enc SET
    created_at = NEW.created_at,
    default_account_id = NEW.default_account_id,
    label = zeta_encrypt(NEW.label),
    last_used_at = NEW.last_used_at,
    revoked_at = NEW.revoked_at,
    token = zeta_encrypt(NEW.token),
    token_hash = encode(digest(NEW.token, 'sha256'), 'hex'),
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER capture_tokens_view_update_trg
  INSTEAD OF UPDATE ON capture_tokens
  FOR EACH ROW EXECUTE FUNCTION capture_tokens_view_update();

CREATE OR REPLACE FUNCTION capture_tokens_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM capture_tokens_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER capture_tokens_view_delete_trg
  INSTEAD OF DELETE ON capture_tokens
  FOR EACH ROW EXECUTE FUNCTION capture_tokens_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON capture_tokens TO authenticated;
GRANT ALL ON capture_tokens TO postgres, service_role;
