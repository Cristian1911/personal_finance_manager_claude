-- Stores user-configured allowed sender emails for email ingest.
-- These supplement the hardcoded ALLOWED_SENDERS in the webhook.
-- Bank email addresses aren't PII, so no encryption needed.

CREATE TABLE email_ingest_allowed_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  label TEXT, -- optional friendly name (e.g. "Bancolombia alertas")
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate entries per user
  UNIQUE (user_id, sender_email)
);

-- RLS
ALTER TABLE email_ingest_allowed_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own allowed senders"
  ON email_ingest_allowed_senders FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own allowed senders"
  ON email_ingest_allowed_senders FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own allowed senders"
  ON email_ingest_allowed_senders FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Index for webhook lookups (admin client queries by user_id)
CREATE INDEX idx_email_ingest_allowed_senders_user
  ON email_ingest_allowed_senders(user_id);
