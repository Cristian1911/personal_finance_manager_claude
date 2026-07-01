-- Modo compartido (Fase 1): el modo puede ser un pool de gastos compartidos.
alter table public.modos
  add column is_shared boolean not null default false,
  add column split_method text not null default 'equal',
  add column user_included boolean not null default true,
  add constraint modos_split_method_chk check (split_method in ('equal','percent'));

-- Participantes del pool (Fase 1: single-user; destinatario tipo persona).
-- Forward-compat Fase 2: se anadiran member_user_id + invite_status aqui.
create table public.modo_participants (
  id uuid primary key default gen_random_uuid(),
  modo_id uuid not null references public.modos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  destinatario_id uuid not null references public.destinatarios(id) on delete cascade,
  share_value numeric,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (modo_id, destinatario_id)
);

alter table public.modo_participants enable row level security;

create policy "modo_participants_select_own" on public.modo_participants
  for select using ((select auth.uid()) = user_id);
create policy "modo_participants_insert_own" on public.modo_participants
  for insert with check ((select auth.uid()) = user_id);
create policy "modo_participants_update_own" on public.modo_participants
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "modo_participants_delete_own" on public.modo_participants
  for delete using ((select auth.uid()) = user_id);

create index modo_participants_modo_id_idx on public.modo_participants (modo_id);
create index modo_participants_user_id_idx on public.modo_participants (user_id);

-- Grants (RLS filtra; los grants dan el privilegio). Precedente: modos, personal_debts.
grant select, insert, update, delete on public.modo_participants to authenticated;
grant all on public.modo_participants to postgres, service_role;
