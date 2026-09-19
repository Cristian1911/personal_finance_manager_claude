-- Bandeja "sin respaldo en el extracto": movimientos de tarjeta que llegaron
-- por correo o pantallazo (tier 2) dentro de un periodo ya importado desde el
-- extracto y no se conciliaron con ninguna fila del extracto. Suelen ser
-- validaciones de tarjeta (LOUNGEKEY USD 1,00) que el banco retira. El usuario
-- los elimina o los conserva; "conservar" se recuerda aquí para que la bandeja
-- deje de proponerlos.
create table public.statement_tray_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- FK al TABLE real (_enc), no a la vista (precedente: modo_tx_reviews).
  transaction_id uuid not null references public.transactions_enc(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (transaction_id)
);

create index statement_tray_dismissals_user_idx on public.statement_tray_dismissals (user_id);

alter table public.statement_tray_dismissals enable row level security;

create policy "statement_tray_dismissals_select_own" on public.statement_tray_dismissals
  for select using ((select auth.uid()) = user_id);
create policy "statement_tray_dismissals_insert_own" on public.statement_tray_dismissals
  for insert with check ((select auth.uid()) = user_id);
create policy "statement_tray_dismissals_delete_own" on public.statement_tray_dismissals
  for delete using ((select auth.uid()) = user_id);
