-- Viajes y eventos (modos): viaje activo + etiqueta propia + bandeja de revisión.
-- Webapp-only: mobile no sincroniza modos (ver BACKLOG "mobile parity").

-- ── modos: flag de activo, etiqueta auto y updated_at ──────────────────────
alter table public.modos
  add column is_active boolean not null default false,
  add column auto_tag_id uuid references public.tags(id) on delete set null,
  add column updated_at timestamptz not null default now();

-- Un solo viaje activo por usuario (la app desactiva el anterior antes de activar).
create unique index modos_one_active_per_user
  on public.modos (user_id)
  where is_active;

create extension if not exists moddatetime with schema extensions;
drop trigger if exists set_updated_at on public.modos;
create trigger set_updated_at
  before update on public.modos
  for each row
  execute function extensions.moddatetime(updated_at);

-- ── modo_tx_reviews: decisiones "¿fue del viaje?" por transacción ──────────
-- included = se etiquetó (auto por viaje activo, sugerida y aceptada, o manual).
-- excluded = el usuario dijo que NO fue del viaje; la bandeja no la vuelve a proponer.
create table public.modo_tx_reviews (
  id uuid primary key default gen_random_uuid(),
  modo_id uuid not null references public.modos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- FK al TABLE real (_enc), no a la vista (precedente: transaction_locations, modo_participants).
  transaction_id uuid not null references public.transactions_enc(id) on delete cascade,
  decision text not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint modo_tx_reviews_decision_chk check (decision in ('included','excluded')),
  constraint modo_tx_reviews_source_chk check (source in ('auto','suggested','manual')),
  unique (modo_id, transaction_id)
);

alter table public.modo_tx_reviews enable row level security;

create policy "modo_tx_reviews_select_own" on public.modo_tx_reviews
  for select using ((select auth.uid()) = user_id);
create policy "modo_tx_reviews_insert_own" on public.modo_tx_reviews
  for insert with check ((select auth.uid()) = user_id);
create policy "modo_tx_reviews_update_own" on public.modo_tx_reviews
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "modo_tx_reviews_delete_own" on public.modo_tx_reviews
  for delete using ((select auth.uid()) = user_id);

create index modo_tx_reviews_modo_id_idx on public.modo_tx_reviews (modo_id);
create index modo_tx_reviews_user_id_idx on public.modo_tx_reviews (user_id);
create index modo_tx_reviews_transaction_id_idx on public.modo_tx_reviews (transaction_id);

-- Grants (RLS filtra; los grants dan el privilegio). Precedente: modos, modo_participants.
grant select, insert, update, delete on public.modo_tx_reviews to authenticated;
grant all on public.modo_tx_reviews to postgres, service_role;
