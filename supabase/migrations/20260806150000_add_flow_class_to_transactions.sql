-- ============================================================================
-- Flow classification: persist the machine verdict on the transaction row
--
-- WHY: category and flow class are orthogonal axes. Category answers "what did
-- I buy"; flow class answers "did I buy anything at all". Conflating them is
-- what made April 2026 report $73.480.217 of outflow when real consumption was
-- $13.351.155 — the rest was card payments, transfers and cash advances. On the
-- income side a $22.441.478 loan disbursement was counted as income.
--
-- WHY STORED, not computed at read time: 12 PostgREST read sites (charts.ts,
-- analytics.ts, cashflow-planner.ts, budgets.ts, categories.ts) filter in the
-- database. They cannot call a function per row, and pulling rows to filter in
-- JS defeats the purpose. The verdict has to be a column they can .in() on.
--
-- Five plaintext, non-PII columns + one generated column. Same treatment as
-- transfer_group_id / split_group_id / split_repaid_amount: no encryption, no
-- hmac, no _old routing in the UPDATE trigger, no COALESCE preamble in the
-- INSERT trigger.
--
-- Contains NO backfill and does not touch zeta_mcp_flow_class / zeta_mcp_tx_base.
-- The new classifier is introduced under a NEW name so the MCP RPCs keep working
-- through verification and backfill; they are repointed in a later migration.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Plaintext columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.transactions_enc
  ADD COLUMN IF NOT EXISTS flow_class                 text,
  ADD COLUMN IF NOT EXISTS flow_class_override        text,
  ADD COLUMN IF NOT EXISTS flow_class_override_source text,
  ADD COLUMN IF NOT EXISTS flow_class_version         smallint,
  ADD COLUMN IF NOT EXISTS source_pattern             text;

COMMENT ON COLUMN public.transactions_enc.flow_class IS
  'Machine verdict from classifyFlow() / zeta_flow_class(). NULL = not yet classified. Never written by the user — a user correction goes to flow_class_override. Non-PII, plaintext.';

COMMENT ON COLUMN public.transactions_enc.flow_class_override IS
  'Explicit correction. Wins over flow_class. Populated either by the user in the app or, once, by the category backfill — see flow_class_override_source.';

COMMENT ON COLUMN public.transactions_enc.flow_class_override_source IS
  'Who wrote flow_class_override. USER = explicit correction in the app. CATEGORY_SEED = one-time backfill from the user''s Cuota crédito / Tarjeta de crédito category, a strong prior rather than an assertion — safe to clear once the classifier agrees on its own. Only USER may render as a user correction in the UI.';

COMMENT ON COLUMN public.transactions_enc.flow_class_version IS
  'FLOW_CLASS_RULES_VERSION that produced flow_class, so a rules change can re-derive only the stale rows instead of the whole table.';

COMMENT ON COLUMN public.transactions_enc.source_pattern IS
  'Raw parser signal: pattern_type from the Bancolombia email parser, or source_hint from the Python PDF parsers. Strongest available classification input. NULL for every pre-existing row — the signal was discarded at import time and cannot be recovered.';

-- text + CHECK rather than a Postgres enum, on purpose:
--   * ALTER TYPE ... ADD VALUE cannot USE the new value in the same
--     transaction, and the Supabase CLI wraps each migration in one — so every
--     new class would need two migrations.
--   * this column is referenced by the `transactions` view and three trigger
--     functions. Any non-additive enum change requires recreating the type,
--     which requires dropping the view + triggers. A CHECK is a two-line swap.
-- The class set WILL grow; optimise for cheap evolution.
ALTER TABLE public.transactions_enc
  DROP CONSTRAINT IF EXISTS transactions_enc_flow_class_check;
ALTER TABLE public.transactions_enc
  ADD CONSTRAINT transactions_enc_flow_class_check CHECK (
    flow_class IS NULL OR flow_class IN (
      'INCOME','SPEND','DEBT_PAYMENT','DEBT_CREDIT',
      'DEBT_DRAWDOWN','SELF_TRANSFER','CASH_WITHDRAWAL','BANK_FEE'
    )
  );

ALTER TABLE public.transactions_enc
  DROP CONSTRAINT IF EXISTS transactions_enc_flow_class_override_check;
ALTER TABLE public.transactions_enc
  ADD CONSTRAINT transactions_enc_flow_class_override_check CHECK (
    flow_class_override IS NULL OR flow_class_override IN (
      'INCOME','SPEND','DEBT_PAYMENT','DEBT_CREDIT',
      'DEBT_DRAWDOWN','SELF_TRANSFER','CASH_WITHDRAWAL','BANK_FEE'
    )
  );

ALTER TABLE public.transactions_enc
  DROP CONSTRAINT IF EXISTS transactions_enc_flow_class_override_source_check;
ALTER TABLE public.transactions_enc
  ADD CONSTRAINT transactions_enc_flow_class_override_source_check CHECK (
    flow_class_override_source IS NULL
    OR flow_class_override_source IN ('USER','CATEGORY_SEED')
  );

-- An override with no provenance is exactly the unfalsifiable state the source
-- column exists to prevent: a backfill guess indistinguishable from a user's
-- click, immune to classifier bug fixes forever.
ALTER TABLE public.transactions_enc
  DROP CONSTRAINT IF EXISTS transactions_enc_flow_class_override_provenance_check;
ALTER TABLE public.transactions_enc
  ADD CONSTRAINT transactions_enc_flow_class_override_provenance_check CHECK (
    flow_class_override IS NULL OR flow_class_override_source IS NOT NULL
  );

-- A verdict with no version can never be selectively re-derived.
ALTER TABLE public.transactions_enc
  DROP CONSTRAINT IF EXISTS transactions_enc_flow_class_version_check;
ALTER TABLE public.transactions_enc
  ADD CONSTRAINT transactions_enc_flow_class_version_check CHECK (
    flow_class IS NULL OR flow_class_version IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 2. Generated column — the one PostgREST can actually filter on
--
-- MUST be a separate ALTER TABLE: a generation expression cannot reference
-- columns added by a sibling subcommand of the same statement.
--
-- The 'UNCLASSIFIED' floor is load-bearing, not decoration. If this column were
-- NULLable, `flow_class_effective NOT IN (...)` evaluates to NULL for an
-- unclassified row and PostgREST silently DROPS it — every row the backfill
-- misses or a future write path forgets would vanish from charts, budgets and
-- cashflow with no error at all. With the floor those rows stay visible, and
-- callers opt into them explicitly via a positive .in() list.
-- ---------------------------------------------------------------------------
ALTER TABLE public.transactions_enc
  ADD COLUMN IF NOT EXISTS flow_class_effective text
  GENERATED ALWAYS AS (
    coalesce(flow_class_override, flow_class, 'UNCLASSIFIED')
  ) STORED;

COMMENT ON COLUMN public.transactions_enc.flow_class_effective IS
  'GENERATED: coalesce(flow_class_override, flow_class, ''UNCLASSIFIED''). The column every metrics query filters on. Never NULL, so IN / NOT IN behave predictably in PostgREST. NOT WRITABLE — deliberately absent from both INSTEAD OF trigger column lists.';

-- Leading equality on user_id, equality/IN on the class, range+order on date.
-- Deliberately NOT partial: the read sites write `is_excluded = false`, which
-- the planner cannot reliably prove implies `is_excluded IS NOT TRUE`, and one
-- call site omitting the filter makes a partial index dead weight.
CREATE INDEX IF NOT EXISTS idx_transactions_enc_user_flow_date
  ON public.transactions_enc (user_id, flow_class_effective, transaction_date DESC);

-- ---------------------------------------------------------------------------
-- 3. Text normalisation — mirrors normalize() in flow-class.ts.
--    unaccent() is not used: the extension is not guaranteed enabled, and it is
--    only STABLE, which would block IMMUTABLE below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zeta_norm_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
           regexp_replace(
             translate(lower(coalesce(p_text, '')),
                       'áàäâéèëêíìïîóòöôúùüûñ',
                       'aaaaeeeeiiiioooouuuun'),
             '\s{2,}', ' ', 'g'),
           '^\s+|\s+$', '', 'g');
$$;

COMMENT ON FUNCTION public.zeta_norm_text(text) IS
  'Lowercase + strip diacritics + collapse whitespace. SQL mirror of normalize() in packages/shared/src/utils/flow-class.ts. All flow-class regexes run against this form.';

-- ---------------------------------------------------------------------------
-- 4. Parser-hint map — EMAIL_PATTERN_TO_FLOW then PY_HINT_TO_FLOW.
--    Returns NULL for an unknown hint so the caller falls through to the
--    description rules, matching classifyFlow().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zeta_flow_class_from_pattern(p_pattern text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_pattern
    -- Bancolombia email parser (pattern_type)
    WHEN 'retiro'                  THEN 'CASH_WITHDRAWAL'
    WHEN 'compra_debito'           THEN 'SPEND'
    WHEN 'compra_credito'          THEN 'SPEND'
    WHEN 'qr_pago'                 THEN 'SPEND'
    WHEN 'boton_bancolombia'       THEN 'SPEND'
    WHEN 'pago_pse'                THEN 'SPEND'
    WHEN 'bre_b'                   THEN 'SPEND'
    -- QR is a merchant rail in Colombia, not a movement between own accounts.
    WHEN 'qr_transferencia'        THEN 'SPEND'
    WHEN 'avance'                  THEN 'DEBT_DRAWDOWN'
    WHEN 'nomina'                  THEN 'INCOME'
    WHEN 'pago_recibido'           THEN 'INCOME'
    WHEN 'pago_recibido_cuenta'    THEN 'INCOME'
    WHEN 'qr_recibido'             THEN 'INCOME'
    WHEN 'transferencia_recibida'  THEN 'INCOME'
    -- 'transferencia' (outbound, unqualified) is INTENTIONALLY ABSENT: with no
    -- counterpart it cannot be told from a merchant payment, so it must fall
    -- through to the description rules. Do not add it.

    -- Python PDF parsers (source_hint)
    WHEN 'PAYMENT'                 THEN 'DEBT_PAYMENT'
    WHEN 'PURCHASE'                THEN 'SPEND'
    WHEN 'CASH_ADVANCE'            THEN 'DEBT_DRAWDOWN'
    WHEN 'INTEREST'                THEN 'BANK_FEE'
    WHEN 'FEE'                     THEN 'BANK_FEE'
    WHEN 'DISBURSEMENT'            THEN 'DEBT_DRAWDOWN'
    WHEN 'INSTALLMENT'             THEN 'SPEND'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.zeta_flow_class_from_pattern(text) IS
  'Maps a raw parser signal to a flow class. Mirrors EMAIL_PATTERN_TO_FLOW + PY_HINT_TO_FLOW in packages/shared/src/utils/flow-class.ts. NULL = unknown hint, caller falls through to description rules.';

-- ---------------------------------------------------------------------------
-- 5. zeta_flow_class — generalised replacement for zeta_mcp_flow_class.
--
-- Differences from zeta_mcp_flow_class, all deliberate:
--   * NO category / parent_category parameters. Depending on category_id made
--     the verdict go stale every time the user re-categorised. A user's "this
--     is actually a card payment" belongs in flow_class_override.
--   * NEW: a loan disbursed INTO a liquid account is DEBT_DRAWDOWN, not INCOME.
--   * NEW: when transfer_group_id is set, the counterpart leg decides.
--   * NEW: p_matched_account_type — an OUTFLOW from a liquid account whose
--     description names one of the user's OWN debt accounts is a payment.
--     Measured: recovers 15 rows that no wording rule can reach.
--   * NEW: parser hints outrank everything.
--   * KEPT: QR movements are SPEND, not transfers.
--
-- p_matched_account_type is resolved by the CALLER, never here. The lookup
-- reads accounts_enc and decrypts, so it is STABLE at best — and this function
-- must stay IMMUTABLE: a STABLE function cannot back an expression index, and a
-- GENERATED ALWAYS expression must be immutable and may not reference another
-- table at all.
--
-- Rule ORDER and regexes mirror classifyFlow() in
-- packages/shared/src/utils/flow-class.ts. That file is canonical.
--
-- Regex note: Postgres ARE has NO \b word boundary (\b is a backspace escape).
-- The TS \b becomes \y here. The old zeta_mcp_flow_class faked it with a
-- trailing space ('pago +tc '), which never matched at end-of-string — which is
-- why some "PAGO SUC VIRT TC" rows were filed as SPEND.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zeta_flow_class(
  p_direction                text,
  p_account_type             text,
  p_description              text,
  p_transfer_group_id        uuid default null,
  p_counterpart_account_type text default null,
  p_matched_account_type     text default null,
  p_source_pattern           text default null
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    public.zeta_flow_class_from_pattern(p_source_pattern),
    (
      SELECT CASE
        WHEN p_transfer_group_id IS NOT NULL
             AND p_direction = 'INFLOW'
             AND p_account_type IN ('CREDIT_CARD','LOAN')             THEN 'DEBT_CREDIT'
        WHEN p_transfer_group_id IS NOT NULL
             AND p_direction <> 'INFLOW'
             AND p_counterpart_account_type IN ('CREDIT_CARD','LOAN') THEN 'DEBT_PAYMENT'
        WHEN p_transfer_group_id IS NOT NULL                          THEN 'SELF_TRANSFER'

        -- Cash advance — creates debt, never a purchase. Deliberately ABOVE the
        -- destination-match rule: "avance ****7507" is a drawdown on your own
        -- card, and that card's own mask is sitting right there.
        WHEN n.d ~ '^(avance|adelanto)|avance\s+(sucursal|cajero)'     THEN 'DEBT_DRAWDOWN'

        WHEN p_direction = 'INFLOW'
             AND p_account_type IN ('CREDIT_CARD','LOAN')             THEN 'DEBT_CREDIT'
        WHEN p_direction = 'INFLOW'
             AND n.d ~ 'desembolso\s+de\s+credito|desembolso\s+prestamo|abono\s+desembolso'
                                                                      THEN 'DEBT_DRAWDOWN'
        WHEN p_direction = 'INFLOW'                                   THEN 'INCOME'

        -- Structural evidence first: money leaving a liquid account toward an
        -- account the user OWNS and OWES on is a payment, whatever the wording.
        -- Recovers rows naming only the lender ("bancolombia prestamo ****7507").
        WHEN p_direction <> 'INFLOW'
             AND coalesce(p_account_type,'') NOT IN ('CREDIT_CARD','LOAN')
             AND p_matched_account_type IN ('CREDIT_CARD','LOAN')     THEN 'DEBT_PAYMENT'

        WHEN n.d ~ 'pago\s+(suc\s+virt\s+)?tc\y|pago\s+tarjeta|pago\s+alternativo\s+tarj|abono\s+a\s+capital|abono\s+mora|pago\s+cuota|pago\s+pse\s+nu\y|mora\s+tarjeta|renegociado|ampliacion\s+de\s+plazo'
                                                                      THEN 'DEBT_PAYMENT'
        WHEN n.d ~ 'retiro\s+(cajero|atm|corresponsal)'               THEN 'CASH_WITHDRAWAL'
        WHEN n.d ~ 'impto\s+gobierno|4x1000|cuota\s+(de\s+)?manejo|comision|interes(es)?\s+corriente|interes(es)?\s+mora|cobro\s+transf|ajuste\s+interes'
                                                                      THEN 'BANK_FEE'
        WHEN n.d ~ '^(transferencia|transferencias\s+a\s|traslado|envio\s+de\s+dinero)'
                                                                      THEN 'SELF_TRANSFER'
        ELSE 'SPEND'
      END
      FROM (SELECT public.zeta_norm_text(p_description) AS d) n
    )
  );
$$;

COMMENT ON FUNCTION public.zeta_flow_class(text,text,text,uuid,text,text,text) IS
  'Labels a movement so analysis can separate real consumption from debt payments and transfers between own accounts. SQL mirror of classifyFlow() in packages/shared/src/utils/flow-class.ts — that TypeScript implementation is canonical. Exists for backfill and for the MCP analysis RPCs. Deliberately does NOT take category.';

-- ---------------------------------------------------------------------------
-- 6. Backfill candidate source.
--
-- The verification SELECT and the backfill UPDATE both read from this one
-- function, so the verdict you review is bit-for-bit the verdict you apply.
-- Covers ALL rows — including excluded, reconciled and cancelled ones, which
-- zeta_mcp_tx_base filters out but which can be un-excluded later and must not
-- be left unclassified.
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
  -- MATERIALIZED is load-bearing, not a hint. zeta_decrypt_as() does a vault
  -- read + key derivation per call; inlined, this CTE would re-decrypt every
  -- debt account once per transaction row (~27k vault reads). Materialised it
  -- is ~10 calls total.
  WITH debt_accounts AS MATERIALIZED (
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
      AND a2.account_type IN ('CREDIT_CARD','LOAN')
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
    SELECT da.id, da.account_type, m.kind
    FROM debt_accounts da
    CROSS JOIN LATERAL (
      SELECT CASE
        -- Mask: digits only, >= 4, NOT adjacent to other digits — otherwise
        -- "7507" matches inside the amount "175075".
        WHEN length(da.mk) >= 4
             AND dsc.descr_norm ~ ('(^|[^0-9])' || da.mk || '([^0-9]|$)')
          THEN 'mask'
        -- Name: >= 4 chars and whole-token. A 2-char name like "Nu" is
        -- deliberately unmatchable — it would hit "menu", "nuevo", "nube".
        WHEN length(da.nm) >= 4
             AND (' ' || dsc.descr_norm || ' ') LIKE
                 ('% ' || replace(replace(replace(da.nm,'\','\\'),'%','\%'),'_','\_') || ' %')
          THEN 'name'
        ELSE NULL
      END AS kind
    ) m
    WHERE m.kind IS NOT NULL
      -- Card statements embed the card's own last-4 on every line. Without
      -- this, every purchase on that card self-matches as a payment to itself
      -- and the card's entire spend vanishes from the totals.
      AND da.id <> t.account_id
    ORDER BY (m.kind = 'mask') DESC, length(da.nm) DESC NULLS LAST
    LIMIT 1
  ) dest ON true
  WHERE t.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.zeta_flow_class_candidates(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zeta_flow_class_candidates(uuid) TO service_role;

-- ============================================================================
-- 7. Recreate the transactions view + triggers.
--
-- Bodies taken mechanically from 20260630180000_add_split_repaid_amount.sql,
-- plus the five new plain columns and the generated one. View: 56 columns.
-- Write lists: 55 (everything except flow_class_effective).
--
-- !! flow_class_effective appears in the VIEW SELECT but is ABSENT from both
-- !! the INSERT column list and the UPDATE SET list. It is GENERATED ALWAYS on
-- !! transactions_enc — writing it raises "cannot insert a non-DEFAULT value".
-- !! If you copy this file as the template for the next column, keep that
-- !! asymmetry.
--
-- Note: because the view has INSTEAD OF triggers, Postgres reports every column
-- as updatable, so PostgREST will ACCEPT flow_class_effective in a request body
-- and the trigger silently ignores it. Silent, not an error.
-- ============================================================================

DROP VIEW IF EXISTS public.transactions CASCADE;

CREATE VIEW public.transactions WITH (security_invoker = true) AS
SELECT
  account_id, amount, amount_in_base_currency,
  zeta_decrypt(capture_input_text) AS capture_input_text,
  capture_method, categorization_confidence, categorization_source,
  category_id,
  zeta_decrypt(clean_description) AS clean_description,
  clean_description_hmac, created_at, currency_code, destinatario_id,
  direction, exchange_rate, id, idempotency_key, installment_current,
  installment_group_id, installment_total, is_excluded, is_recurring,
  is_subscription, location_id, merchant_category_code, merchant_logo_url,
  zeta_decrypt(merchant_name) AS merchant_name,
  merchant_name_hmac,
  zeta_decrypt(notes) AS notes,
  original_amount, posting_date, provider, provider_transaction_id,
  zeta_decrypt(raw_description) AS raw_description,
  reconciled_into_transaction_id, reconciliation_score,
  recurrence_group_id, secondary_category_id, status, tags, title_locked,
  transaction_date, transaction_time, transfer_group_id,
  personal_debt_id, pd_role, split_group_id, split_repaid_amount,
  flow_class, flow_class_override, flow_class_override_source,
  flow_class_version, source_pattern,
  flow_class_effective,
  updated_at, user_id
FROM public.transactions_enc;

CREATE OR REPLACE FUNCTION public.transactions_view_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.exchange_rate := COALESCE(NEW.exchange_rate, 1.000000);
  NEW.status := COALESCE(NEW.status, 'POSTED'::transaction_status);
  NEW.categorization_source := COALESCE(NEW.categorization_source, 'USER_CREATED'::categorization_source);
  NEW.is_subscription := COALESCE(NEW.is_subscription, false);
  NEW.is_recurring := COALESCE(NEW.is_recurring, false);
  NEW.provider := COALESCE(NEW.provider, 'MANUAL'::data_provider);
  NEW.is_excluded := COALESCE(NEW.is_excluded, false);
  NEW.capture_method := COALESCE(NEW.capture_method, 'MANUAL_FORM'::transaction_capture_method);
  NEW.title_locked := COALESCE(NEW.title_locked, false);

  INSERT INTO public.transactions_enc (
    account_id, amount, amount_in_base_currency, capture_input_text,
    capture_method, categorization_confidence, categorization_source,
    category_id, clean_description, clean_description_hmac, created_at,
    currency_code, destinatario_id, direction, exchange_rate, id,
    idempotency_key, installment_current, installment_group_id,
    installment_total, is_excluded, is_recurring, is_subscription,
    location_id, merchant_category_code, merchant_logo_url, merchant_name,
    merchant_name_hmac, notes, original_amount, posting_date, provider,
    provider_transaction_id, raw_description,
    reconciled_into_transaction_id, reconciliation_score,
    recurrence_group_id, secondary_category_id, status, tags, title_locked,
    transaction_date, transaction_time, transfer_group_id,
    personal_debt_id, pd_role, split_group_id, split_repaid_amount,
    flow_class, flow_class_override, flow_class_override_source,
    flow_class_version, source_pattern,
    updated_at, user_id
  ) VALUES (
    NEW.account_id, NEW.amount, NEW.amount_in_base_currency,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.capture_input_text) ELSE zeta_encrypt_as(NEW.capture_input_text, NEW.user_id) END,
    NEW.capture_method, NEW.categorization_confidence,
    NEW.categorization_source, NEW.category_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.clean_description) ELSE zeta_encrypt_as(NEW.clean_description, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.clean_description) ELSE zeta_hmac_as(NEW.clean_description, NEW.user_id) END,
    NEW.created_at, NEW.currency_code, NEW.destinatario_id,
    NEW.direction, NEW.exchange_rate, NEW.id, NEW.idempotency_key,
    NEW.installment_current, NEW.installment_group_id,
    NEW.installment_total, NEW.is_excluded, NEW.is_recurring,
    NEW.is_subscription, NEW.location_id,
    NEW.merchant_category_code, NEW.merchant_logo_url,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE zeta_encrypt_as(NEW.merchant_name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_hmac(NEW.merchant_name) ELSE zeta_hmac_as(NEW.merchant_name, NEW.user_id) END,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE zeta_encrypt_as(NEW.notes, NEW.user_id) END,
    NEW.original_amount, NEW.posting_date, NEW.provider,
    NEW.provider_transaction_id,
    CASE WHEN has_auth THEN zeta_encrypt(NEW.raw_description) ELSE zeta_encrypt_as(NEW.raw_description, NEW.user_id) END,
    NEW.reconciled_into_transaction_id, NEW.reconciliation_score,
    NEW.recurrence_group_id, NEW.secondary_category_id, NEW.status,
    NEW.tags, NEW.title_locked, NEW.transaction_date, NEW.transaction_time,
    NEW.transfer_group_id,
    NEW.personal_debt_id, NEW.pd_role, NEW.split_group_id, NEW.split_repaid_amount,
    NEW.flow_class, NEW.flow_class_override, NEW.flow_class_override_source,
    NEW.flow_class_version, NEW.source_pattern,
    NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transactions_view_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  has_auth BOOLEAN;
  _old public.transactions_enc;
BEGIN
  has_auth := (SELECT auth.uid()) IS NOT NULL;

  IF NOT has_auth THEN
    SELECT * INTO _old FROM public.transactions_enc WHERE id = OLD.id;
  END IF;

  UPDATE public.transactions_enc SET
    account_id = NEW.account_id,
    amount = NEW.amount,
    amount_in_base_currency = NEW.amount_in_base_currency,
    capture_input_text = CASE WHEN has_auth THEN zeta_encrypt(NEW.capture_input_text) ELSE _old.capture_input_text END,
    capture_method = NEW.capture_method,
    categorization_confidence = NEW.categorization_confidence,
    categorization_source = NEW.categorization_source,
    category_id = NEW.category_id,
    clean_description = CASE WHEN has_auth THEN zeta_encrypt(NEW.clean_description) ELSE _old.clean_description END,
    clean_description_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.clean_description) ELSE _old.clean_description_hmac END,
    created_at = NEW.created_at,
    currency_code = NEW.currency_code,
    destinatario_id = NEW.destinatario_id,
    direction = NEW.direction,
    exchange_rate = NEW.exchange_rate,
    idempotency_key = NEW.idempotency_key,
    installment_current = NEW.installment_current,
    installment_group_id = NEW.installment_group_id,
    installment_total = NEW.installment_total,
    is_excluded = NEW.is_excluded,
    is_recurring = NEW.is_recurring,
    is_subscription = NEW.is_subscription,
    location_id = NEW.location_id,
    merchant_category_code = NEW.merchant_category_code,
    merchant_logo_url = NEW.merchant_logo_url,
    merchant_name = CASE WHEN has_auth THEN zeta_encrypt(NEW.merchant_name) ELSE _old.merchant_name END,
    merchant_name_hmac = CASE WHEN has_auth THEN zeta_hmac(NEW.merchant_name) ELSE _old.merchant_name_hmac END,
    notes = CASE WHEN has_auth THEN zeta_encrypt(NEW.notes) ELSE _old.notes END,
    original_amount = NEW.original_amount,
    posting_date = NEW.posting_date,
    provider = NEW.provider,
    provider_transaction_id = NEW.provider_transaction_id,
    raw_description = CASE WHEN has_auth THEN zeta_encrypt(NEW.raw_description) ELSE _old.raw_description END,
    reconciled_into_transaction_id = NEW.reconciled_into_transaction_id,
    reconciliation_score = NEW.reconciliation_score,
    recurrence_group_id = NEW.recurrence_group_id,
    secondary_category_id = NEW.secondary_category_id,
    status = NEW.status,
    tags = NEW.tags,
    title_locked = NEW.title_locked,
    transaction_date = NEW.transaction_date,
    transaction_time = NEW.transaction_time,
    transfer_group_id = NEW.transfer_group_id,
    personal_debt_id = NEW.personal_debt_id,
    pd_role = NEW.pd_role,
    split_group_id = NEW.split_group_id,
    split_repaid_amount = NEW.split_repaid_amount,
    flow_class = NEW.flow_class,
    flow_class_override = NEW.flow_class_override,
    flow_class_override_source = NEW.flow_class_override_source,
    flow_class_version = NEW.flow_class_version,
    source_pattern = NEW.source_pattern,
    -- flow_class_effective intentionally omitted: GENERATED ALWAYS.
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transactions_view_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM public.transactions_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER transactions_view_insert_trg
  INSTEAD OF INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_insert();

CREATE TRIGGER transactions_view_update_trg
  INSTEAD OF UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_update();

CREATE TRIGGER transactions_view_delete_trg
  INSTEAD OF DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_view_delete();

-- Re-grant permissions (CASCADE on the view revokes these)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO postgres, service_role;

COMMIT;

-- PostgREST caches the schema. Without this, writes touching the new columns
-- fail with PGRST204 "column not found in schema cache" until the next reload.
NOTIFY pgrst, 'reload schema';
