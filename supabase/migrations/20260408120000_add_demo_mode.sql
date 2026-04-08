-- Add demo mode support: profile toggle + account tagging
-- When demo_mode is true, the dashboard shows only demo accounts/transactions

alter table public.profiles
  add column demo_mode boolean not null default false;

alter table public.accounts
  add column is_demo boolean not null default false;

-- Index for fast filtering by demo flag
create index idx_accounts_is_demo on public.accounts (user_id, is_demo) where is_active = true;

comment on column public.profiles.demo_mode is 'When true, dashboard shows demo data instead of real data';
comment on column public.accounts.is_demo is 'Tags demo/mock accounts created for preview purposes';
