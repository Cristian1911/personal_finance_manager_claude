-- Extend get_email_ingest_settings to include user-configured allowed senders.
-- Eliminates a separate round-trip in the webhook for sender validation.
-- Must DROP first because return type is changing (adding allowed_senders column).
DROP FUNCTION IF EXISTS get_email_ingest_settings(TEXT);

CREATE OR REPLACE FUNCTION get_email_ingest_settings(p_address_key TEXT)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  account_id UUID,
  auto_import BOOLEAN,
  allowed_sender TEXT,
  pdf_import_enabled BOOLEAN,
  address_key TEXT,
  allowed_senders TEXT[]
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
    e.address_key,
    COALESCE(
      (SELECT array_agg(s.sender_email)
       FROM email_ingest_allowed_senders s
       WHERE s.user_id = e.user_id),
      '{}'::TEXT[]
    )
  FROM email_ingest_addresses_enc e
  WHERE lower(e.address_key) = lower(p_address_key)
    AND e.is_active = true;
$$;

REVOKE ALL ON FUNCTION get_email_ingest_settings(TEXT) FROM PUBLIC;
