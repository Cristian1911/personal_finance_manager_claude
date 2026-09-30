-- SECURITY DEFINER functions that take a user id (or decrypt for one) were
-- executable by anon and authenticated, so anyone holding the public anon key
-- could, given another user's id: decrypt their data (zeta_decrypt_as), read
-- their PDF passwords and card masks (get_accounts_with_masks), read their
-- email-ingest settings (get_email_ingest_settings), rewrite the Gmail
-- verification link shown to them (set_gmail_verification), regenerate their
-- occurrences (generate_occurrences_for_template), or delete every demo user
-- (cleanup_anonymous_demo_users).
--
-- Callers, verified 2026-09-29: the email-ingest webhook (service role key),
-- the demo-cleanup cron job and other SECURITY DEFINER functions (run as the
-- owner). None run as anon or authenticated, so nothing in the apps changes.

REVOKE EXECUTE ON FUNCTION
  public.zeta_decrypt_as(bytea, uuid),
  public.get_accounts_with_masks(uuid),
  public.get_email_ingest_settings(text),
  public.set_gmail_verification(uuid, uuid, text),
  public.generate_occurrences_for_template(uuid),
  public.cleanup_anonymous_demo_users(interval)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.zeta_decrypt_as(bytea, uuid),
  public.get_accounts_with_masks(uuid),
  public.get_email_ingest_settings(text),
  public.set_gmail_verification(uuid, uuid, text),
  public.generate_occurrences_for_template(uuid),
  public.cleanup_anonymous_demo_users(interval)
TO service_role;

-- The encrypted views' INSERT triggers run as the signed-in user and reference
-- these two in their service-role branch. Postgres checks EXECUTE on every
-- function in the statement when planning it, even a branch that never runs,
-- so authenticated MUST keep them (not dead grants); nobody signed out needs them.
REVOKE EXECUTE ON FUNCTION
  public.zeta_encrypt_as(text, uuid),
  public.zeta_hmac_as(text, uuid)
FROM PUBLIC, anon;
