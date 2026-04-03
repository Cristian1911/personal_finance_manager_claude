-- Store per-account PDF password for auto-parsing email statement attachments.
-- Typically the user's cédula, same across all accounts from one bank.
alter table accounts
  add column if not exists pdf_password text;
