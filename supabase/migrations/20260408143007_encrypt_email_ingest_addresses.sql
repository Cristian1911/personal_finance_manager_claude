-- ==================================================
-- Encrypt email_ingest_addresses table (2 encrypted)
-- address_key stays plaintext (routing lookup key)
-- ==================================================

ALTER TABLE email_ingest_addresses RENAME TO email_ingest_addresses_enc;

ALTER TABLE email_ingest_addresses_enc
  ALTER COLUMN allowed_sender TYPE BYTEA USING zeta_encrypt_as(allowed_sender, user_id);
ALTER TABLE email_ingest_addresses_enc
  ALTER COLUMN gmail_verification_url TYPE BYTEA USING zeta_encrypt_as(gmail_verification_url, user_id);

CREATE VIEW email_ingest_addresses WITH (security_invoker = true) AS
SELECT
  account_id, address_key,
  zeta_decrypt(allowed_sender) AS allowed_sender,
  auto_import, created_at, gmail_verification_at,
  zeta_decrypt(gmail_verification_url) AS gmail_verification_url,
  id, is_active, pdf_import_enabled, user_id
FROM email_ingest_addresses_enc;

CREATE OR REPLACE FUNCTION email_ingest_addresses_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO email_ingest_addresses_enc (
    account_id, address_key, allowed_sender, auto_import, created_at,
    gmail_verification_at, gmail_verification_url, id, is_active,
    pdf_import_enabled, user_id
  ) VALUES (
    NEW.account_id, NEW.address_key,
    zeta_encrypt(NEW.allowed_sender),
    NEW.auto_import, NEW.created_at, NEW.gmail_verification_at,
    zeta_encrypt(NEW.gmail_verification_url),
    NEW.id, NEW.is_active, NEW.pdf_import_enabled, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_ingest_addresses_view_insert_trg
  INSTEAD OF INSERT ON email_ingest_addresses
  FOR EACH ROW EXECUTE FUNCTION email_ingest_addresses_view_insert();

CREATE OR REPLACE FUNCTION email_ingest_addresses_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_ingest_addresses_enc SET
    account_id = NEW.account_id,
    address_key = NEW.address_key,
    allowed_sender = zeta_encrypt(NEW.allowed_sender),
    auto_import = NEW.auto_import,
    created_at = NEW.created_at,
    gmail_verification_at = NEW.gmail_verification_at,
    gmail_verification_url = zeta_encrypt(NEW.gmail_verification_url),
    is_active = NEW.is_active,
    pdf_import_enabled = NEW.pdf_import_enabled,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_ingest_addresses_view_update_trg
  INSTEAD OF UPDATE ON email_ingest_addresses
  FOR EACH ROW EXECUTE FUNCTION email_ingest_addresses_view_update();

CREATE OR REPLACE FUNCTION email_ingest_addresses_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM email_ingest_addresses_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_ingest_addresses_view_delete_trg
  INSTEAD OF DELETE ON email_ingest_addresses
  FOR EACH ROW EXECUTE FUNCTION email_ingest_addresses_view_delete();

GRANT SELECT, INSERT, UPDATE, DELETE ON email_ingest_addresses TO authenticated;
GRANT ALL ON email_ingest_addresses TO postgres, service_role;
