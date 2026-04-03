-- Pending email PDF statements (received via email, queued for user review)
create table pending_email_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  email_ingest_id uuid not null references email_ingest_addresses(id) on delete cascade,

  -- Email metadata
  from_address text not null,
  subject text,
  original_filename text,

  -- Storage (PDF binary in Supabase Storage, not in DB)
  storage_path text not null,
  file_size_bytes integer,

  -- Parser state machine
  status text not null default 'pending'
    check (status in (
      'pending',            -- PDF stored, not yet parsed
      'parsing',            -- parser invoked, awaiting result
      'parsed',             -- parser succeeded, ready for user review
      'needs_password',     -- parser returned password-required error
      'parse_failed',       -- parser returned unrecoverable error
      'imported',           -- user completed import
      'dismissed'           -- user dismissed
    )),
  error_message text,

  -- Parser result (stored as JSONB for the review UI)
  parsed_data jsonb,

  -- Idempotency: SHA-256 of raw PDF content prevents re-processing
  idempotency_hash text not null,

  -- Timestamps
  parsed_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pending_email_statements enable row level security;

create policy "Users can manage their own pending statements"
  on pending_email_statements
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Dedup: same PDF content for same user (excluding dismissed)
create unique index idx_pending_email_stmt_idempotency
  on pending_email_statements (user_id, idempotency_hash)
  where status not in ('dismissed');

-- Fast lookup for pending statements list
create index idx_pending_email_stmt_user_status
  on pending_email_statements (user_id, status)
  where status in ('pending', 'parsing', 'parsed', 'needs_password');

-- Add pdf_import_enabled to email_ingest_addresses
alter table email_ingest_addresses
  add column if not exists pdf_import_enabled boolean not null default false;

-- Extend email_ingest_logs status constraint for PDF statuses
alter table email_ingest_logs
  drop constraint if exists email_ingest_logs_status_check;
alter table email_ingest_logs
  add constraint email_ingest_logs_status_check
  check (status in (
    'parsed', 'imported', 'queued', 'duplicate',
    'parse_failed', 'sender_rejected', 'rate_limited',
    'pdf_queued', 'pdf_parse_failed', 'pdf_imported'
  ));

-- Add EMAIL_PDF_IMPORT capture method
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'EMAIL_PDF_IMPORT'
    and enumtypid = (select oid from pg_type where typname = 'transaction_capture_method')
  ) then
    alter type transaction_capture_method add value 'EMAIL_PDF_IMPORT';
  end if;
end $$;

-- Create storage bucket for email PDFs (private, 15MB limit)
insert into storage.buckets (id, name, public, file_size_limit)
values ('email-pdfs', 'email-pdfs', false, 15728640)
on conflict (id) do nothing;

-- Storage RLS: users access their own folder ({user_id}/...)
create policy "Users can access their own email PDFs"
  on storage.objects
  for all
  using (bucket_id = 'email-pdfs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'email-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
