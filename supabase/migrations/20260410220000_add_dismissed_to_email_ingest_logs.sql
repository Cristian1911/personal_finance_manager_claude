-- Add 'dismissed' status so users can dismiss/ignore failed log entries from the UI.

alter table email_ingest_logs
  drop constraint if exists email_ingest_logs_status_check;

alter table email_ingest_logs
  add constraint email_ingest_logs_status_check
  check (status in (
    'parsed', 'imported', 'queued', 'duplicate',
    'parse_failed', 'sender_rejected', 'rate_limited',
    'pdf_queued', 'pdf_parse_failed', 'pdf_imported',
    'dismissed'
  ));
