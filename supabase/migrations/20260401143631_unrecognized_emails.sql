-- Store emails that the parser couldn't recognize, for review and parser improvement
create table unrecognized_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  email_ingest_id uuid references email_ingest_addresses(id) on delete set null,
  from_address text not null,
  subject text,
  text_body text,
  html_body text,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table unrecognized_emails enable row level security;

create policy "Users can manage their own unrecognized emails"
  on unrecognized_emails
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index idx_unrecognized_emails_user_status
  on unrecognized_emails (user_id, status)
  where status = 'pending';
