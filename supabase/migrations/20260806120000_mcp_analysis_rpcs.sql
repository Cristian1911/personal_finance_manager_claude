-- MCP analysis RPCs
--
-- The MCP endpoint authenticates callers with a `zeta_...` capture token, not a
-- Supabase JWT. That means it runs with the service role and `auth.uid()` is NULL,
-- so reading the encrypted views (`accounts`, `transactions`, ...) returns NULL for
-- every `bytea` column. These SECURITY DEFINER functions read the `_enc` tables
-- directly and decrypt with `zeta_decrypt_as(col, user_id)`, which does not depend
-- on the auth context.
--
-- Every function takes the caller-resolved `p_user_id` and filters on it. Execute is
-- granted to `service_role` only — the app layer is responsible for proving that the
-- bearer token maps to `p_user_id` before calling.

-- ---------------------------------------------------------------------------
-- Flow classification
-- ---------------------------------------------------------------------------
-- Not every OUTFLOW is consumption. Paying a credit card moves money from a savings
-- account to a card the user already owns — counting it as spend double-counts the
-- original purchases. Same for loan payments and transfers between own accounts.
-- This function labels a movement so the analysis tools can separate real
-- day-to-day consumption from balance-sheet shuffling.
--
-- Returns one of:
--   INCOME            real income (INFLOW to a non-debt account)
--   DEBT_PAYMENT      OUTFLOW that pays down a card/loan (not consumption)
--   DEBT_CREDIT       INFLOW to a card/loan account (a payment landing, or a refund)
--   DEBT_DRAWDOWN     cash advance / new credit taken on a card
--   SELF_TRANSFER     movement between the user's own accounts (not consumption)
--   CASH_WITHDRAWAL   ATM cash — real money out, but the destination is unknown
--   BANK_FEE          taxes and bank charges
--   SPEND             real day-to-day consumption
create or replace function public.zeta_mcp_flow_class(
  p_direction        text,
  p_account_type     text,
  p_description      text,
  p_category         text,
  p_parent_category  text
) returns text
language sql
immutable
as $$
  select case
    -- Cash advances create debt; they are not a purchase.
    when p_direction = 'OUTFLOW' and p_description ~* '^(avance|adelanto)' then 'DEBT_DRAWDOWN'

    -- Money landing on a card/loan account.
    when p_direction = 'INFLOW' and p_account_type in ('CREDIT_CARD','LOAN') then 'DEBT_CREDIT'

    when p_direction = 'INFLOW' then 'INCOME'

    -- Explicit card/loan payments, by category first (user-confirmed) then by the
    -- bank's own description wording.
    when p_category in ('Cuota crédito','Tarjeta de crédito','Deuda personal') then 'DEBT_PAYMENT'
    when p_description ~* '(pago +(suc +virt +)?tc |pago +tarjeta|pago +alternativo +tarj|abono +a +capital|pago +cuota|pago +pse +nu |mora +tarjeta|renegociado)'
      then 'DEBT_PAYMENT'

    when p_description ~* '(retiro +cajero|retiro +atm)' then 'CASH_WITHDRAWAL'

    when p_description ~* '(impto +gobierno|4x1000|cuota +de +manejo|cuota +manejo|comision|comisión|interes +corriente|intereses +corrientes)'
      then 'BANK_FEE'

    -- Bare transfers with no merchant attached. QR transfers are deliberately NOT
    -- included: in Colombia those are overwhelmingly merchant payments.
    when p_description ~* '^(transferencia|transferencias a |traslado|envio de dinero|envío de dinero)'
      then 'SELF_TRANSFER'

    else 'SPEND'
  end;
$$;

comment on function public.zeta_mcp_flow_class is
  'Labels a movement so analysis can separate real consumption (SPEND) from debt payments and transfers between own accounts.';

-- ---------------------------------------------------------------------------
-- Base: decrypted, enriched, de-duplicated transactions
-- ---------------------------------------------------------------------------
create or replace function public.zeta_mcp_tx_base(
  p_user_id uuid,
  p_from    date default null,
  p_to      date default null
) returns table (
  id                uuid,
  transaction_date  date,
  amount            numeric,
  currency_code     text,
  direction         text,
  description       text,
  merchant          text,
  notes             text,
  category          text,
  parent_category   text,
  category_id       uuid,
  expense_type      text,
  is_essential      boolean,
  account_id        uuid,
  account_name      text,
  account_type      text,
  capture_method    text,
  is_subscription   boolean,
  installment_current smallint,
  installment_total   smallint,
  flow_class        text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with tx as (
    select
      t.id,
      t.transaction_date,
      coalesce(t.amount_in_base_currency, t.amount) as amount,
      t.currency_code::text as currency_code,
      t.direction::text as direction,
      coalesce(
        nullif(zeta_decrypt_as(t.merchant_name, t.user_id), ''),
        nullif(zeta_decrypt_as(t.clean_description, t.user_id), ''),
        nullif(zeta_decrypt_as(t.raw_description, t.user_id), ''),
        ''
      ) as description,
      nullif(zeta_decrypt_as(t.merchant_name, t.user_id), '') as merchant,
      nullif(zeta_decrypt_as(t.notes, t.user_id), '') as notes,
      coalesce(c.name_es, c.name) as category,
      coalesce(p.name_es, p.name) as parent_category,
      t.category_id,
      c.expense_type,
      c.is_essential,
      t.account_id,
      nullif(zeta_decrypt_as(a.name, a.user_id), '') as account_name,
      a.account_type::text as account_type,
      t.capture_method::text as capture_method,
      t.is_subscription,
      t.installment_current,
      t.installment_total
    from transactions_enc t
    join accounts_enc a on a.id = t.account_id
    left join categories c on c.id = t.category_id
    left join categories p on p.id = c.parent_id
    where t.user_id = p_user_id
      and coalesce(t.is_excluded, false) = false
      and t.reconciled_into_transaction_id is null
      and t.status <> 'CANCELLED'
      and (p_from is null or t.transaction_date >= p_from)
      and (p_to   is null or t.transaction_date <= p_to)
  )
  select
    tx.*,
    zeta_mcp_flow_class(tx.direction, tx.account_type, tx.description, tx.category, tx.parent_category)
  from tx;
$$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create or replace function public.zeta_mcp_accounts(p_user_id uuid)
returns table (
  id               uuid,
  name             text,
  account_type     text,
  institution      text,
  mask             text,
  current_balance  numeric,
  currency_code    text,
  credit_limit     numeric,
  interest_rate    numeric,
  monthly_payment  numeric,
  cutoff_day       smallint,
  payment_day      smallint,
  is_active        boolean,
  last_movement    date,
  movements_90d    bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    nullif(zeta_decrypt_as(a.name, a.user_id), '') as name,
    a.account_type::text,
    nullif(zeta_decrypt_as(a.institution_name, a.user_id), '') as institution,
    nullif(zeta_decrypt_as(a.mask, a.user_id), '') as mask,
    a.current_balance,
    a.currency_code::text,
    a.credit_limit,
    a.interest_rate,
    a.monthly_payment,
    a.cutoff_day,
    a.payment_day,
    a.is_active,
    m.last_movement,
    coalesce(m.movements_90d, 0) as movements_90d
  from accounts_enc a
  left join lateral (
    select max(t.transaction_date) as last_movement,
           count(*) filter (where t.transaction_date >= current_date - 90) as movements_90d
    from transactions_enc t
    where t.account_id = a.id and t.user_id = a.user_id
  ) m on true
  where a.user_id = p_user_id
  order by a.is_active desc, a.display_order nulls last, a.account_type;
$$;

-- ---------------------------------------------------------------------------
-- Transactions (search / list)
-- ---------------------------------------------------------------------------
create or replace function public.zeta_mcp_transactions(
  p_user_id    uuid,
  p_from       date default null,
  p_to         date default null,
  p_direction  text default null,
  p_account_id uuid default null,
  p_flow_class text default null,
  p_search     text default null,
  p_min_amount numeric default null,
  p_limit      int  default 50,
  p_offset     int  default 0
) returns table (
  id               uuid,
  transaction_date date,
  amount           numeric,
  currency_code    text,
  direction        text,
  description      text,
  category         text,
  parent_category  text,
  account_name     text,
  account_type     text,
  flow_class       text,
  capture_method   text,
  total_count      bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with filtered as (
    select b.*
    from zeta_mcp_tx_base(p_user_id, p_from, p_to) b
    where (p_direction  is null or b.direction = p_direction)
      and (p_account_id is null or b.account_id = p_account_id)
      and (p_flow_class is null or b.flow_class = p_flow_class)
      and (p_min_amount is null or b.amount >= p_min_amount)
      and (p_search is null or b.description ilike '%' || p_search || '%'
           or coalesce(b.category, '') ilike '%' || p_search || '%')
  )
  select
    f.id, f.transaction_date, f.amount, f.currency_code, f.direction,
    f.description, f.category, f.parent_category, f.account_name, f.account_type,
    f.flow_class, f.capture_method,
    count(*) over () as total_count
  from filtered f
  order by f.transaction_date desc, f.amount desc
  limit greatest(1, least(coalesce(p_limit, 50), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- ---------------------------------------------------------------------------
-- Spending breakdown — the "what am I actually spending on" tool
-- ---------------------------------------------------------------------------
create or replace function public.zeta_mcp_breakdown(
  p_user_id uuid,
  p_from    date,
  p_to      date
) returns table (
  flow_class      text,
  parent_category text,
  category        text,
  expense_type    text,
  is_essential    boolean,
  tx_count        bigint,
  total           numeric,
  monthly_avg     numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with months as (
    select greatest(
      1,
      (date_part('year', age(p_to, p_from)) * 12 + date_part('month', age(p_to, p_from)) + 1)::int
    ) as n
  )
  select
    b.flow_class,
    b.parent_category,
    coalesce(b.category, '(sin categoría)') as category,
    b.expense_type,
    coalesce(b.is_essential, false) as is_essential,
    count(*) as tx_count,
    sum(b.amount) as total,
    round(sum(b.amount) / (select n from months)) as monthly_avg
  from zeta_mcp_tx_base(p_user_id, p_from, p_to) b
  where b.direction = 'OUTFLOW'
  group by 1, 2, 3, 4, 5
  order by sum(b.amount) desc;
$$;

-- ---------------------------------------------------------------------------
-- Monthly cashflow, with debt payments and transfers separated out
-- ---------------------------------------------------------------------------
create or replace function public.zeta_mcp_cashflow(
  p_user_id uuid,
  p_months  int default 12
) returns table (
  month            text,
  income           numeric,
  spend            numeric,
  debt_payments    numeric,
  self_transfers   numeric,
  cash_withdrawals numeric,
  bank_fees        numeric,
  net              numeric,
  tx_count         bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    to_char(b.transaction_date, 'YYYY-MM') as month,
    sum(b.amount) filter (where b.flow_class = 'INCOME')          as income,
    sum(b.amount) filter (where b.flow_class = 'SPEND')           as spend,
    sum(b.amount) filter (where b.flow_class = 'DEBT_PAYMENT')    as debt_payments,
    sum(b.amount) filter (where b.flow_class = 'SELF_TRANSFER')   as self_transfers,
    sum(b.amount) filter (where b.flow_class = 'CASH_WITHDRAWAL') as cash_withdrawals,
    sum(b.amount) filter (where b.flow_class = 'BANK_FEE')        as bank_fees,
    coalesce(sum(b.amount) filter (where b.flow_class = 'INCOME'), 0)
      - coalesce(sum(b.amount) filter (where b.direction = 'OUTFLOW'), 0) as net,
    count(*) as tx_count
  from zeta_mcp_tx_base(
    p_user_id,
    (date_trunc('month', current_date) - make_interval(months => greatest(1, coalesce(p_months, 12)) - 1))::date,
    current_date
  ) b
  group by 1
  order by 1 desc;
$$;

-- ---------------------------------------------------------------------------
-- Fixed commitments — the "what can I cut" surface
-- ---------------------------------------------------------------------------
create or replace function public.zeta_mcp_recurring(p_user_id uuid)
returns table (
  id              uuid,
  name            text,
  amount          numeric,
  currency_code   text,
  frequency       text,
  day_of_month    smallint,
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

-- ---------------------------------------------------------------------------
-- Data quality — surfaces the gaps that make the numbers untrustworthy
-- ---------------------------------------------------------------------------
create or replace function public.zeta_mcp_data_quality(
  p_user_id uuid,
  p_from    date,
  p_to      date
) returns table (
  check_name  text,
  severity    text,
  affected    bigint,
  amount      numeric,
  detail      text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with b as (select * from zeta_mcp_tx_base(p_user_id, p_from, p_to))

  -- Uncategorized outflows: the single biggest driver of an untrustworthy total.
  select
    'gasto_sin_categoria'::text,
    (case when sum(amount) filter (where category_id is null and direction = 'OUTFLOW')
            > 0.25 * nullif(sum(amount) filter (where direction = 'OUTFLOW'), 0)
          then 'alta' else 'media' end)::text,
    count(*) filter (where category_id is null and direction = 'OUTFLOW'),
    coalesce(sum(amount) filter (where category_id is null and direction = 'OUTFLOW'), 0),
    'Movimientos de salida sin categoría asignada. Mientras existan, el desglose por categoría subestima el gasto real.'
  from b
  having count(*) filter (where category_id is null and direction = 'OUTFLOW') > 0

  union all

  -- Transfers with no counterpart account registered: money leaves and vanishes.
  select
    'transferencias_sin_destino'::text, 'alta'::text,
    count(*), coalesce(sum(amount), 0),
    'Transferencias salientes sin cuenta destino registrada en Zeta. El dinero sale del balance pero no aparece en ninguna otra cuenta.'::text
  from b where flow_class = 'SELF_TRANSFER'
  having count(*) > 0

  union all

  select
    'efectivo_sin_trazar'::text, 'media'::text,
    count(*), coalesce(sum(amount), 0),
    'Retiros en cajero. El monto es real pero no se sabe en qué se gastó, así que no aparece en ninguna categoría.'::text
  from b where flow_class = 'CASH_WITHDRAWAL'
  having count(*) > 0

  union all

  select
    'ajustes_manuales_de_saldo'::text, 'alta'::text,
    count(*), coalesce(sum(amount), 0),
    'Ajustes manuales de saldo. Son un parche: indican que el saldo real no cuadraba con los movimientos registrados.'::text
  from b where description ilike '%ajuste manual%'
  having count(*) > 0

  union all

  -- Same amount, same day, same account, different rows. `amount` reports the
  -- excess (what a duplicate import would have added), not the full group total.
  select
    'posibles_duplicados'::text, 'media'::text,
    count(*), coalesce(sum(d.dup_amount * (d.c - 1)), 0),
    'Movimientos con mismo monto, misma fecha y misma cuenta. Pueden ser duplicados de importación o compras legítimas repetidas.'::text
  from (
    select transaction_date, account_id, amount as dup_amount, count(*) as c
    from b where direction = 'OUTFLOW'
    group by 1, 2, 3 having count(*) > 1
  ) d
  having count(*) > 0

  union all

  -- Active accounts nobody is feeding.
  select
    'cuentas_activas_sin_movimiento'::text, 'media'::text,
    count(*), coalesce(sum(abs(a.current_balance)), 0),
    'Cuentas marcadas como activas sin movimientos en los últimos 90 días. O están muertas, o falta importar sus extractos.'::text
  from zeta_mcp_accounts(p_user_id) a
  where a.is_active and a.movements_90d = 0
  having count(*) > 0

  union all

  -- Cards reported over their limit — usually a stale or wrong balance.
  select
    'tarjeta_sobre_el_cupo'::text, 'alta'::text,
    count(*), coalesce(sum(a.current_balance - a.credit_limit), 0),
    'Tarjetas cuyo saldo supera el cupo registrado. Normalmente significa que el cupo está desactualizado o el saldo quedó mal tras un pago.'::text
  from zeta_mcp_accounts(p_user_id) a
  where a.is_active and a.account_type = 'CREDIT_CARD'
    and a.credit_limit > 0 and a.current_balance > a.credit_limit
  having count(*) > 0

  union all

  -- Recurring templates that duplicate each other by amount.
  select
    'recurrentes_duplicados'::text, 'media'::text,
    count(*), coalesce(sum(r.amount), 0),
    'Pagos recurrentes activos distintos con el mismo monto exacto. Suelen ser el mismo servicio registrado dos veces.'::text
  from zeta_mcp_recurring(p_user_id) r
  where r.is_active
    and r.amount in (
      select amount from zeta_mcp_recurring(p_user_id)
      where is_active group by amount having count(*) > 1
    )
  having count(*) > 0;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: the MCP route resolves the user from a capture token and then
-- calls these with the service role. No other role may execute them.
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'zeta_mcp_accounts(uuid)',
    'zeta_mcp_tx_base(uuid, date, date)',
    'zeta_mcp_transactions(uuid, date, date, text, uuid, text, text, numeric, int, int)',
    'zeta_mcp_breakdown(uuid, date, date)',
    'zeta_mcp_cashflow(uuid, int)',
    'zeta_mcp_recurring(uuid)',
    'zeta_mcp_data_quality(uuid, date, date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;
