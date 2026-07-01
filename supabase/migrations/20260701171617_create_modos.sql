create table public.modos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  emoji text,
  date_from date not null,
  date_to date not null,
  tag_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.modos enable row level security;

create policy "modos_select_own" on public.modos
  for select using ((select auth.uid()) = user_id);
create policy "modos_insert_own" on public.modos
  for insert with check ((select auth.uid()) = user_id);
create policy "modos_update_own" on public.modos
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "modos_delete_own" on public.modos
  for delete using ((select auth.uid()) = user_id);

create index modos_user_id_idx on public.modos (user_id);
