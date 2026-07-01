-- Explicit table grants for public.modos (RLS is the filter; grants are the privilege).
-- Matches precedent: budget_scenarios, personal_debts.
grant select, insert, update, delete on public.modos to authenticated;
grant all on public.modos to postgres, service_role;
