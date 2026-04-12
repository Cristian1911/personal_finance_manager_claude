-- Fix: remove redundant index (UNIQUE constraint already creates a composite index with user_id leading)
DROP INDEX IF EXISTS idx_email_ingest_allowed_senders_user;

-- Fix: enforce lowercase storage for case-insensitive email matching
ALTER TABLE email_ingest_allowed_senders
  ADD CONSTRAINT email_ingest_allowed_senders_lowercase_email
  CHECK (sender_email = lower(sender_email));

-- Add UPDATE policy for inline label editing in settings UI
CREATE POLICY "Users can update their own allowed senders"
  ON email_ingest_allowed_senders FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
