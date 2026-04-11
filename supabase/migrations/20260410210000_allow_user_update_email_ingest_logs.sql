-- Allow authenticated users to update their own email ingest logs.
-- The retryEmailIngestLog() server action updates status and clears
-- error_message via the user's authenticated client, which requires
-- an UPDATE policy. Without this, the update silently affects 0 rows.

create policy "Users can update their own ingest logs"
  on email_ingest_logs
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
