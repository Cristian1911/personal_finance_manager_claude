-- Fixes two problems in zeta_mcp_recurring:
--
-- 1. `day_of_month` was declared `smallint`, but the column on
--    `recurring_transaction_templates_enc` is `integer`. It happens to work today
--    only because every stored value fits in a smallint — a day past 32767 is
--    impossible, but the declaration is still wrong and would break if the column
--    were ever reused. Declare it as it actually is.
--
-- 2. `direction` was not exposed. Without it, callers cannot tell an expense
--    template from an income one and will sum payroll into the fixed-cost floor.
--    Note that card/loan payment templates are stored as INFLOW (money landing on
--    the debt account), so `direction = 'INFLOW'` alone does not mean income —
--    callers still need the account type or category to separate the two.
--
-- Return type changes, so the function must be dropped before recreating.

drop function if exists public.zeta_mcp_recurring(uuid);

create function public.zeta_mcp_recurring(p_user_id uuid)
returns table (
  id              uuid,
  name            text,
  amount          numeric,
  currency_code   text,
  direction       text,
  frequency       text,
  day_of_month    integer,
  category        text,
  is_active       boolean,
  monthly_equiv   numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id,
    coalesce(
      nullif(zeta_decrypt_as(r.merchant_name, r.user_id), ''),
      nullif(zeta_decrypt_as(r.description, r.user_id), ''),
      'Sin nombre'
    ) as name,
    r.amount,
    r.currency_code::text,
    r.direction::text,
    r.frequency::text,
    r.day_of_month,
    coalesce(c.name_es, c.name) as category,
    r.is_active,
    case r.frequency::text
      when 'WEEKLY'    then r.amount * 52 / 12
      when 'BIWEEKLY'  then r.amount * 2
      when 'MONTHLY'   then r.amount
      when 'QUARTERLY' then r.amount / 3
      when 'ANNUAL'    then r.amount / 12
      else 0
    end as monthly_equiv
  from recurring_transaction_templates_enc r
  left join categories c on c.id = r.category_id
  where r.user_id = p_user_id
  order by r.is_active desc, r.amount desc;
$$;

revoke all on function public.zeta_mcp_recurring(uuid) from public, anon, authenticated;
grant execute on function public.zeta_mcp_recurring(uuid) to service_role;
