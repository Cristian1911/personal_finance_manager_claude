-- ==================================================
-- Encrypt destinatarios table (2 encrypted, 1 HMAC)
-- ==================================================

ALTER TABLE destinatarios RENAME TO destinatarios_enc;

-- Drop index that uses lower(name) — incompatible with BYTEA
DROP INDEX IF EXISTS idx_destinatarios_user_name;

ALTER TABLE destinatarios_enc ADD COLUMN name_hmac TEXT;
UPDATE destinatarios_enc SET name_hmac = zeta_hmac_as(name, user_id) WHERE name IS NOT NULL;

ALTER TABLE destinatarios_enc
  ALTER COLUMN name TYPE BYTEA USING zeta_encrypt_as(name, user_id);
ALTER TABLE destinatarios_enc
  ALTER COLUMN notes TYPE BYTEA USING zeta_encrypt_as(notes, user_id);

CREATE VIEW destinatarios WITH (security_invoker = true) AS
SELECT
  created_at, default_category_id, id, is_active,
  zeta_decrypt(name) AS name,
  name_hmac,
  zeta_decrypt(notes) AS notes,
  updated_at, user_id
FROM destinatarios_enc;

CREATE OR REPLACE FUNCTION destinatarios_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO destinatarios_enc (
    created_at, default_category_id, id, is_active, name, name_hmac,
    notes, updated_at, user_id
  ) VALUES (
    NEW.created_at, NEW.default_category_id, NEW.id, NEW.is_active,
    zeta_encrypt(NEW.name),
    zeta_hmac(NEW.name),
    zeta_encrypt(NEW.notes),
    NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER destinatarios_view_insert_trg
  INSTEAD OF INSERT ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_insert();

CREATE OR REPLACE FUNCTION destinatarios_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE destinatarios_enc SET
    created_at = NEW.created_at,
    default_category_id = NEW.default_category_id,
    is_active = NEW.is_active,
    name = zeta_encrypt(NEW.name),
    name_hmac = zeta_hmac(NEW.name),
    notes = zeta_encrypt(NEW.notes),
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER destinatarios_view_update_trg
  INSTEAD OF UPDATE ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_update();

CREATE OR REPLACE FUNCTION destinatarios_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM destinatarios_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER destinatarios_view_delete_trg
  INSTEAD OF DELETE ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON destinatarios TO authenticated;
GRANT ALL ON destinatarios TO postgres, service_role;
