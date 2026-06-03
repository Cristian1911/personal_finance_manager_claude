BEGIN;

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE personal_debt_direction AS ENUM (
  'borrowed',  -- I borrowed money (Debo) — a liability
  'lent'       -- I lent money (Me deben) — an asset
);

CREATE TYPE personal_debt_status AS ENUM (
  'active',
  'settled',
  'cancelled'
);

-- pd_role lives here so Task 3 can reference it on transactions.
CREATE TYPE pd_role AS ENUM (
  'origin',     -- the inflow/outflow that created the debt (<=1 per debt)
  'repayment'   -- a payment toward the debt; counts as normal cashflow
);

-- ============================================================
-- Table (PLAIN — destinatario_id already points at the encrypted
-- destinatarios_enc, so the person identity is protected there)
-- ============================================================
CREATE TABLE public.personal_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL
    REFERENCES public.destinatarios_enc(id) ON DELETE RESTRICT,
  direction personal_debt_direction NOT NULL,
  principal_amount numeric NOT NULL,
  currency_code text NOT NULL DEFAULT 'COP',
  outstanding_amount numeric NOT NULL,
  opened_on date NOT NULL,
  due_date date,
  status personal_debt_status NOT NULL DEFAULT 'active',
  origin_transaction_id uuid,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.personal_debts IS
  'Person-to-person lend/borrow tracker. Destinatario-anchored (kind=person). outstanding_amount is maintained = principal - sum(linked repayments). Plain table; identity protected via destinatarios_enc FK.';

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_personal_debts_user_id ON public.personal_debts (user_id);
CREATE INDEX idx_personal_debts_destinatario_id ON public.personal_debts (destinatario_id);
CREATE INDEX idx_personal_debts_status ON public.personal_debts (status);
CREATE INDEX idx_personal_debts_origin_transaction_id
  ON public.personal_debts (origin_transaction_id)
  WHERE origin_transaction_id IS NOT NULL;

-- ============================================================
-- moddatetime trigger
-- ============================================================
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;
DROP TRIGGER IF EXISTS set_updated_at ON public.personal_debts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.personal_debts
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ============================================================
-- RLS — 4 per-op policies, (select auth.uid()) = user_id
-- ============================================================
ALTER TABLE public.personal_debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personal_debts_select" ON public.personal_debts FOR SELECT
  USING ((select auth.uid()) = user_id);
CREATE POLICY "personal_debts_insert" ON public.personal_debts FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "personal_debts_update" ON public.personal_debts FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "personal_debts_delete" ON public.personal_debts FOR DELETE
  USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_debts TO authenticated;
GRANT ALL ON public.personal_debts TO postgres, service_role;

COMMIT;
