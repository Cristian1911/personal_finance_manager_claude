-- Fix: revoke PUBLIC access to zeta_decrypt_as and get_accounts_with_masks
-- These are SECURITY DEFINER functions that bypass RLS and can decrypt any
-- user's data. Without this revoke, any DB role can call them with an
-- arbitrary target_user_id — a cross-tenant secret disclosure path.
-- Matches the pattern from the original encryption migration which revokes
-- zeta_encrypt_as and zeta_hmac_as.

REVOKE ALL ON FUNCTION zeta_decrypt_as(BYTEA, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_accounts_with_masks(UUID) FROM PUBLIC;
