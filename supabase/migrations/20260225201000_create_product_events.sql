-- ============================================================
-- Create product_events table for UX analytics and behavior mapping
-- ============================================================

create extension if not exists moddatetime with schema extensions;

create table if not exists product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  event_name text not null,
  event_time timestamptz not null default now(),
  session_id text,
  platform text not null default 'web',
  entry_point text,
  flow text,
  step text,
  success boolean,
  duration_ms integer,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_events_duration_non_negative check (duration_ms is null or duration_ms >= 0)
);

create index if not exists idx_product_events_user_time
  on product_events(user_id, event_time desc);

create index if not exists idx_product_events_name_time
  on product_events(event_name, event_time desc);

create index if not exists idx_product_events_flow_time
  on product_events(flow, event_time desc);

create index if not exists idx_product_events_metadata_gin
  on product_events using gin (metadata);

alter table product_events enable row level security;

create policy "Users can read own product events"
  on product_events for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own product events"
  on product_events for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own product events"
  on product_events for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own product events"
  on product_events for delete
  using ((select auth.uid()) = user_id);

create trigger set_product_events_updated_at
  before update on product_events
  for each row
  execute function extensions.moddatetime(updated_at);
