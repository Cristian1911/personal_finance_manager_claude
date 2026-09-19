-- Un extracto de tarjeta trae una sección en pesos y otra en dólares para el
-- mismo periodo. El índice único original no incluía la moneda, así que la
-- segunda sección fallaba con "duplicate key" y la tarjeta se quedaba sin
-- saldo ni pago mínimo en USD. El código ya busca el snapshot existente por
-- (cuenta, moneda, periodo); el índice ahora coincide con esa clave.
drop index if exists public.idx_statement_snapshots_unique_period;

create unique index idx_statement_snapshots_unique_period
  on public.statement_snapshots_enc (
    account_id,
    currency_code,
    coalesce(period_from, '1970-01-01'::date),
    coalesce(period_to, '1970-01-01'::date)
  );
