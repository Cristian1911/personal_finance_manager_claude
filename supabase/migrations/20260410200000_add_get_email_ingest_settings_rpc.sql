-- Helper: fetch email ingest address settings with decrypted fields.
-- Used by the webhook route which runs as admin (no JWT → zeta_decrypt returns NULL).
-- Looks up by address_key (unique) and decrypts using the row's own user_id.
CREATE OR REPLACE FUNCTION get_email_ingest_settings(p_address_key TEXT)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  account_id UUID,
  auto_import BOOLEAN,
  allowed_sender TEXT,
  pdf_import_enabled BOOLEAN,
  address_key TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    e.id,
    e.user_id,
    e.account_id,
    e.auto_import,
    zeta_decrypt_as(e.allowed_sender, e.user_id),
    e.pdf_import_enabled,
    e.address_key
  FROM email_ingest_addresses_enc e
  WHERE lower(e.address_key) = lower(p_address_key)
    AND e.is_active = true;
$$;

-- Restrict to service_role only (same pattern as get_accounts_with_masks)
REVOKE ALL ON FUNCTION get_email_ingest_settings(TEXT) FROM PUBLIC;

-- Helper: write Gmail verification URL with proper encryption.
-- The view's INSTEAD OF trigger calls zeta_encrypt() which needs auth.uid()
-- and fails from admin client (no JWT). This RPC uses zeta_encrypt_as() instead.
CREATE OR REPLACE FUNCTION set_gmail_verification(
  p_ingest_id UUID,
  p_user_id UUID,
  p_url TEXT
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE email_ingest_addresses_enc
  SET gmail_verification_url = zeta_encrypt_as(p_url, p_user_id),
      gmail_verification_at = now()
  WHERE id = p_ingest_id AND user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION set_gmail_verification(UUID, UUID, TEXT) FROM PUBLIC;
