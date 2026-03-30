-- Email ingest addresses (one per user)
create table email_ingest_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  address_key text not null,
  account_id uuid references accounts(id) on delete set null,
  auto_import boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint email_ingest_addresses_user_id_key unique (user_id),
  constraint email_ingest_addresses_address_key_key unique (address_key)
);

alter table email_ingest_addresses enable row level security;

create policy "Users can manage their own ingest address"
  on email_ingest_addresses
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Pending email transactions (review mode queue)
create table pending_email_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  email_ingest_id uuid not null references email_ingest_addresses(id) on delete cascade,
  raw_body text not null,
  parsed_data jsonb not null,
  suggested_account_id uuid references accounts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'imported', 'dismissed')),
  idempotency_key text not null,
  created_at timestamptz not null default now()
);

alter table pending_email_transactions enable row level security;

create policy "Users can manage their own pending transactions"
  on pending_email_transactions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index idx_pending_email_tx_user_status
  on pending_email_transactions (user_id, status)
  where status = 'pending';

-- Email ingest logs (monitoring)
create table email_ingest_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  email_ingest_id uuid references email_ingest_addresses(id) on delete set null,
  from_address text,
  status text not null check (status in ('parsed', 'imported', 'queued', 'duplicate', 'parse_failed', 'sender_rejected', 'rate_limited')),
  raw_body text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table email_ingest_logs enable row level security;

create policy "Users can view their own ingest logs"
  on email_ingest_logs
  for select
  using ((select auth.uid()) = user_id);

create policy "Service role can insert logs"
  on email_ingest_logs
  for insert
  with check (true);

create index idx_email_ingest_logs_user_created
  on email_ingest_logs (user_id, created_at desc);

-- Add EMAIL_IMPORT to capture method enum if not exists
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'EMAIL_IMPORT'
    and enumtypid = (select oid from pg_type where typname = 'transaction_capture_method')
  ) then
    alter type transaction_capture_method add value 'EMAIL_IMPORT';
  end if;
end $$;
