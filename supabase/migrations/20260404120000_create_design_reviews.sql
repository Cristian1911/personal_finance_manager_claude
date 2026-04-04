-- Design reviews table for AI UI Pal
create table public.design_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  title text not null,
  description text,
  severity text not null default 'bug' check (severity in ('nit', 'bug', 'idea', 'sketch')),
  route text,
  component_hint text,
  annotation_path text,
  excalidraw_path text,
  device_context jsonb default '{}'::jsonb,
  resolved_by text check (resolved_by in ('claude', 'manual')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.design_reviews enable row level security;

create policy "Users can read own reviews"
  on public.design_reviews for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own reviews"
  on public.design_reviews for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own reviews"
  on public.design_reviews for update
  using ((select auth.uid()) = user_id);

-- Index for MCP server queries
create index idx_design_reviews_status on public.design_reviews (user_id, status)
  where status in ('open', 'in_progress');

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('design-reviews', 'design-reviews', false)
on conflict (id) do nothing;

-- Storage RLS: users can manage their own folder
create policy "Users can upload own review files"
  on storage.objects for insert
  with check (
    bucket_id = 'design-reviews'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Users can read own review files"
  on storage.objects for select
  using (
    bucket_id = 'design-reviews'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
