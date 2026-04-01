-- Allow users to specify a personal email for forwarding bank alerts
alter table email_ingest_addresses
  add column allowed_sender text;

comment on column email_ingest_addresses.allowed_sender is
  'Optional personal email address allowed to forward bank notifications';
