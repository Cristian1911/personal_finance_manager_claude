-- One pending queue row per alert. The queue's 23505 branch assumed this
-- constraint existed; without it a redelivered email (or a retry of an
-- already-queued log) piled up identical pending rows. Scoped to pending
-- rows so an imported/dismissed alert can be re-queued deliberately.
create unique index if not exists idx_pending_email_tx_unique_pending_key
  on pending_email_transactions (user_id, idempotency_key)
  where status = 'pending';
