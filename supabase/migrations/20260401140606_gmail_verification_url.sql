-- Store Gmail forwarding verification URL so the user can confirm from within the app
alter table email_ingest_addresses
  add column gmail_verification_url text,
  add column gmail_verification_at timestamptz;
