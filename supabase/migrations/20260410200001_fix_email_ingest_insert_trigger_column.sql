-- Fix: email_ingest_addresses insert trigger uses wrong column name
-- The trigger references 'default_account_id' but the _enc table column is 'account_id'.
-- This caused account_id to be silently dropped on INSERT through the view.

CREATE OR REPLACE FUNCTION email_ingest_addresses_view_insert() RETURNS TRIGGER AS $$
BEGIN
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.auto_import := COALESCE(NEW.auto_import, false);
  NEW.is_active := COALESCE(NEW.is_active, true);
  NEW.pdf_import_enabled := COALESCE(NEW.pdf_import_enabled, false);

  INSERT INTO email_ingest_addresses_enc (
    id, user_id, address_key, allowed_sender, account_id,
    auto_import, is_active, gmail_verification_url, created_at,
    pdf_import_enabled
  ) VALUES (
    NEW.id, NEW.user_id, NEW.address_key,
    zeta_encrypt(NEW.allowed_sender), NEW.account_id,
    NEW.auto_import, NEW.is_active,
    zeta_encrypt(NEW.gmail_verification_url), NEW.created_at,
    NEW.pdf_import_enabled
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
