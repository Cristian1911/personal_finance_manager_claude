-- Create budgets table for category-based budgeting
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  amount numeric(14,2) not null check (amount >= 0),
  period text not null default 'monthly' check (period in ('monthly', 'yearly')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, category_id, period)
);

-- Enable RLS
alter table public.budgets enable row level security;

-- Policies
create policy "Users can view their own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Users can insert their own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own budgets"
  on public.budgets for update
  using (auth.uid() = user_id);

create policy "Users can delete their own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at (assuming update_updated_at_column function exists)
create trigger update_budgets_updated_at
  before update on public.budgets
  for each row
  execute function update_updated_at_column();
