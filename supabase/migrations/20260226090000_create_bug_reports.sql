-- ============================================================
-- Bug reports table + storage bucket for mobile quick capture
-- ============================================================

create extension if not exists moddatetime with schema extensions;

create table if not exists bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source text not null default 'mobile',
  status text not null default 'OPEN',
  title text not null,
  description text,
  route_hint text,
  selected_area_hint text,
  attachment_path text,
  device_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bug_reports_status_valid check (status in ('OPEN', 'TRIAGED', 'RESOLVED', 'CLOSED'))
);

create index if not exists idx_bug_reports_user_created
  on bug_reports(user_id, created_at desc);

create index if not exists idx_bug_reports_status
  on bug_reports(status, created_at desc);

alter table bug_reports enable row level security;

create policy "Users can read own bug reports"
  on bug_reports for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own bug reports"
  on bug_reports for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own bug reports"
  on bug_reports for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own bug reports"
  on bug_reports for delete
  using ((select auth.uid()) = user_id);

create trigger set_bug_reports_updated_at
  before update on bug_reports
  for each row
  execute function extensions.moddatetime(updated_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bug-reports',
  'bug-reports',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "Users can read own bug attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bug-reports'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload own bug attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bug-reports'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update own bug attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'bug-reports'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'bug-reports'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete own bug attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'bug-reports'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
