-- ============================================================================
-- Flow class rules version 2 + a BEFORE INSERT safety net.
--
-- TWO changes that must land together, because the trigger calls the function.
--
-- NOT YET APPLIED to the project. Apply with the app deploy, not before: the
-- trigger only fills NULLs, so applying it early is harmless, but re-running
-- the backfill against v2 rules before the TypeScript side ships would leave
-- history classified by rules the running app does not yet use.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Rules v2 — the word "transferencia" stops deciding on its own.
--
-- In Colombia almost everything is paid BY transfer: rent, the vet, groceries,
-- the driver. The word says how the money moved, not who received it. Measured
-- on production before changing it: 278 rows / $30.830.132 classified
-- SELF_TRANSFER, ZERO of them linked in-app, 98% carrying one of two generic
-- bank templates that name no destination at all — and rows the user had
-- categorised as Mercado, Uber and Restaurantes were being dropped from spend.
--
-- The regex survives as a CORROBORATING signal on the liquid branch only. The
-- asymmetry with the debt branch is deliberate:
--
--   * debt destination  -> structure alone. Money reaching a card you owe on is
--     a payment however the bank phrased it.
--   * liquid destination -> structure AND wording. A merchant line like
--     `COMPRA EXITO 4398` can collide with an account's last-4 by accident, and
--     calling that a transfer would erase a real purchase from spend.
--
-- Mirrors classifyFlow() in packages/shared/src/utils/flow-class.ts. The two
-- must agree row for row: this one classifies history via backfill, that one
-- classifies every write from here on.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zeta_flow_class(
  p_direction                text,
  p_account_type             text,
  p_description              text,
  p_transfer_group_id        uuid    default null,
  p_counterpart_account_type text    default null,
  p_matched_account_type     text    default null,
  p_source_pattern           text    default null
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH d AS (SELECT public.zeta_norm_text(p_description) AS descr),
       h AS (SELECT public.zeta_flow_class_from_pattern(p_source_pattern) AS hint)
  SELECT CASE
    -- 1. A parser told us outright.
    WHEN (SELECT hint FROM h) IS NOT NULL THEN (SELECT hint FROM h)

    -- 2. Linked transfer — the counterpart decides.
    WHEN p_transfer_group_id IS NOT NULL AND p_direction = 'INFLOW'
         AND p_account_type IN ('CREDIT_CARD','LOAN')                  THEN 'DEBT_CREDIT'
    WHEN p_transfer_group_id IS NOT NULL AND p_direction = 'OUTFLOW'
         AND p_counterpart_account_type IN ('CREDIT_CARD','LOAN')       THEN 'DEBT_PAYMENT'
    WHEN p_transfer_group_id IS NOT NULL                                THEN 'SELF_TRANSFER'

    -- 3. Cash advance — creates debt, never a purchase. Before the direction
    --    split because it can be recorded either way.
    WHEN (SELECT descr FROM d) ~ '^(avance|adelanto)|avance\s+(sucursal|cajero)'
                                                                        THEN 'DEBT_DRAWDOWN'

    -- 4. INFLOW.
    WHEN p_direction = 'INFLOW' AND p_account_type IN ('CREDIT_CARD','LOAN')
                                                                        THEN 'DEBT_CREDIT'
    WHEN p_direction = 'INFLOW' AND (SELECT descr FROM d) ~
         'desembolso\s+de\s+credito|desembolso\s+prestamo|abono\s+desembolso'
                                                                        THEN 'DEBT_DRAWDOWN'
    WHEN p_direction = 'INFLOW'                                         THEN 'INCOME'

    -- 5. OUTFLOW, structural. Debt destination needs no wording.
    WHEN p_account_type NOT IN ('CREDIT_CARD','LOAN')
         AND p_matched_account_type IN ('CREDIT_CARD','LOAN')           THEN 'DEBT_PAYMENT'
    -- Liquid destination DOES need wording — see the note above.
    WHEN p_matched_account_type IS NOT NULL
         AND (SELECT descr FROM d) ~
             '^(transferencia|transferencias\s+a\s|traslado|envio\s+de\s+dinero)'
                                                                        THEN 'SELF_TRANSFER'

    -- 6. OUTFLOW, textual.
    WHEN (SELECT descr FROM d) ~
         'pago\s+(suc\s+virt\s+)?tc\y|pago\s+tarjeta|pago\s+alternativo\s+tarj|abono\s+a\s+capital|abono\s+mora|pago\s+cuota|pago\s+pse\s+nu\y|mora\s+tarjeta|renegociado|ampliacion\s+de\s+plazo'
                                                                        THEN 'DEBT_PAYMENT'
    WHEN (SELECT descr FROM d) ~ 'retiro\s+(cajero|atm|corresponsal)'    THEN 'CASH_WITHDRAWAL'
    WHEN (SELECT descr FROM d) ~
         'impto\s+gobierno|4x1000|cuota\s+(de\s+)?manejo|comision|interes(es)?\s+corriente|interes(es)?\s+mora|cobro\s+transf|ajuste\s+interes'
                                                                        THEN 'BANK_FEE'
    ELSE 'SPEND'
  END;
$$;

COMMENT ON FUNCTION public.zeta_flow_class(text,text,text,uuid,text,text,text) IS
  'Flow classifier, rules version 2. SQL mirror of classifyFlow() in packages/shared/src/utils/flow-class.ts — keep the two in step.';

-- ---------------------------------------------------------------------------
-- 2. BEFORE INSERT safety net.
--
-- Belt and braces, not a substitute for the TypeScript classifier. Once the
-- read sites filter by class, a row with a NULL flow_class is invisible to
-- every spend metric — so a write path someone forgets to wire becomes SILENT
-- DATA LOSS rather than a visible gap. That risk is not theoretical: the import
-- went months without ever calling autoCategorize.
--
-- It fills only what arrives NULL, so the richer TypeScript verdict (parser
-- hints, counterpart account, destination match) always wins when present.
-- Deliberately does NOT resolve the destination match: that needs decrypting
-- every account name and mask per row, and the callers that have the context
-- already pass it.
--
-- Cost: one PK lookup on accounts per inserted row. Acceptable even in a bulk
-- import.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zeta_transactions_fill_flow_class()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_type text;
  v_description  text;
BEGIN
  IF NEW.flow_class IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.account_type::text INTO v_account_type
  FROM public.accounts_enc a
  WHERE a.id = NEW.account_id;

  v_description := coalesce(
    nullif(zeta_decrypt_as(NEW.merchant_name,     NEW.user_id), ''),
    nullif(zeta_decrypt_as(NEW.clean_description, NEW.user_id), ''),
    nullif(zeta_decrypt_as(NEW.raw_description,   NEW.user_id), ''),
    ''
  );

  NEW.flow_class := public.zeta_flow_class(
    NEW.direction::text,
    v_account_type,
    v_description,
    NEW.transfer_group_id,
    NULL,   -- counterpart: the sibling leg may not exist yet at INSERT time
    NULL,   -- destination match: callers with the context pass it themselves
    NEW.source_pattern
  );

  IF NEW.flow_class_version IS NULL THEN
    NEW.flow_class_version := 2;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_fill_flow_class ON public.transactions_enc;
CREATE TRIGGER transactions_fill_flow_class
  BEFORE INSERT ON public.transactions_enc
  FOR EACH ROW
  EXECUTE FUNCTION public.zeta_transactions_fill_flow_class();

-- ---------------------------------------------------------------------------
-- 3. Widen the destination matcher to ALL of the user's accounts.
--
-- Without this the v2 liquid branch above is dead code in SQL while it is live
-- in TypeScript, which is the one thing these two implementations must never
-- be: `zeta_flow_class_candidates` only ever offered CREDIT_CARD and LOAN as
-- destinations, so `p_matched_account_type` could never hold a liquid type, so
-- a genuine savings-to-savings transfer would backfill as SPEND while the same
-- movement written by the app classifies as SELF_TRANSFER.
--
-- Identical to 20260806150000 except the CTE no longer filters by account_type
-- (and is renamed to say so). MATERIALIZED is still load-bearing, more so now
-- that the CTE covers every account: zeta_decrypt_as() does a vault read plus a
-- key derivation per call, and inlined this would re-decrypt every account once
-- per transaction row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zeta_flow_class_candidates(p_user_id uuid)
RETURNS TABLE (
  id                       uuid,
  transaction_date         date,
  amount                   numeric,
  direction                text,
  account_type             text,
  description              text,
  transfer_group_id        uuid,
  counterpart_account_type text,
  matched_account_id       uuid,
  matched_account_type     text,
  matched_by               text,
  source_pattern           text,
  current_flow_class       text,
  new_flow_class           text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH own_accounts AS MATERIALIZED (
    SELECT
      a2.id,
      a2.account_type::text AS account_type,
      public.zeta_norm_text(nullif(zeta_decrypt_as(a2.name, a2.user_id), '')) AS nm,
      regexp_replace(
        coalesce(nullif(zeta_decrypt_as(a2.mask, a2.user_id), ''), ''),
        '[^0-9]', '', 'g'
      ) AS mk
    FROM public.accounts_enc a2
    WHERE a2.user_id = p_user_id
  )
  SELECT
    t.id,
    t.transaction_date,
    coalesce(t.amount_in_base_currency, t.amount) AS amount,
    t.direction::text,
    a.account_type::text,
    dsc.descr,
    t.transfer_group_id,
    cp.account_type::text,
    dest.id,
    dest.account_type,
    dest.kind,
    t.source_pattern,
    t.flow_class,
    public.zeta_flow_class(
      t.direction::text,
      a.account_type::text,
      dsc.descr,
      t.transfer_group_id,
      cp.account_type::text,
      dest.account_type,
      t.source_pattern
    )
  FROM public.transactions_enc t
  JOIN public.accounts_enc a ON a.id = t.account_id
  CROSS JOIN LATERAL (
    SELECT d.raw AS descr, public.zeta_norm_text(d.raw) AS descr_norm
    FROM (
      SELECT coalesce(
        nullif(zeta_decrypt_as(t.merchant_name,     t.user_id), ''),
        nullif(zeta_decrypt_as(t.clean_description, t.user_id), ''),
        nullif(zeta_decrypt_as(t.raw_description,   t.user_id), ''),
        ''
      ) AS raw
    ) d
  ) dsc
  LEFT JOIN LATERAL (
    SELECT a2.account_type
    FROM public.transactions_enc t2
    JOIN public.accounts_enc a2 ON a2.id = t2.account_id
    WHERE t.transfer_group_id IS NOT NULL
      AND t2.transfer_group_id = t.transfer_group_id
      AND t2.user_id = t.user_id
      AND t2.id <> t.id
    ORDER BY t2.created_at
    LIMIT 1
  ) cp ON true
  LEFT JOIN LATERAL (
    SELECT oa.id, oa.account_type, m.kind
    FROM own_accounts oa
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN length(oa.mk) >= 4
             AND dsc.descr_norm ~ ('(^|[^0-9])' || oa.mk || '([^0-9]|$)')
          THEN 'mask'
        WHEN length(oa.nm) >= 4
             AND (' ' || dsc.descr_norm || ' ') LIKE
                 ('% ' || replace(replace(replace(oa.nm,'\','\\'),'%','\%'),'_','\_') || ' %')
          THEN 'name'
        ELSE NULL
      END AS kind
    ) m
    WHERE m.kind IS NOT NULL
      -- Card statements embed the card's own last-4 on every line. Without
      -- this, every purchase self-matches and that card's spend vanishes.
      AND oa.id <> t.account_id
    ORDER BY (m.kind = 'mask') DESC, length(oa.nm) DESC NULLS LAST
    LIMIT 1
  ) dest ON true
  WHERE t.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.zeta_flow_class_candidates(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zeta_flow_class_candidates(uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
