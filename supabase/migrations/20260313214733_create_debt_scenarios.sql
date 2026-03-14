create table debt_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,

  cash_entries jsonb not null,
  strategy text not null default 'avalanche',
  allocations jsonb not null default '{}',

  snapshot_accounts jsonb not null,

  results jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_debt_scenarios_updated_at
  before update on debt_scenarios
  for each row execute function update_updated_at_column();

alter table debt_scenarios enable row level security;

create policy "Users manage own scenarios"
  on debt_scenarios for all
  using ((select auth.uid()) = user_id);

create index idx_debt_scenarios_user on debt_scenarios(user_id, updated_at desc);