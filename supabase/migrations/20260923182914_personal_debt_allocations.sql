-- ============================================================================
-- Abono a una persona en general: un movimiento que se reparte entre varias
-- deudas con la misma persona (la más antigua primero).
--
-- transactions.personal_debt_id sigue apuntando a UNA deuda (la primera del
-- reparto, "ancla"), así todo lo que filtra por "vinculado a una persona"
-- (ingresos, gráficas, presupuestos, modos) no cambia. Cuánto le toca a cada
-- deuda vive en personal_debt_allocations. Cuando un movimiento tiene filas
-- aquí, SU monto no cuenta completo para el ancla: cuenta lo repartido.
--
-- personal_debt_repayment_amounts es la única fuente de "cuánto se ha abonado
-- a cada deuda" para el webapp (recompute + lecturas):
--   - movimientos de abono sin reparto → su monto, a su deuda;
--   - movimientos con reparto → una fila por deuda con su parte, solo mientras
--     el movimiento siga vinculado como abono (desvincular lo saca al instante).
--
-- Plain table (sin PII: ids + montos). Mobile no la sincroniza: lee
-- outstanding_amount, que el servidor mantiene.
--
-- personal_debts.is_general: la "deuda general" con una persona (una por
-- persona, dirección y moneda) — donde se SUMAN los préstamos sueltos que no
-- pertenecen a un viaje ni a una deuda concreta ("vincular a la persona en
-- general" de un movimiento que es un préstamo nuevo).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.personal_debt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL
    REFERENCES public.transactions_enc(id) ON DELETE CASCADE,
  personal_debt_id uuid NOT NULL
    REFERENCES public.personal_debts(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_personal_debt_allocations_tx_debt UNIQUE (transaction_id, personal_debt_id)
);

COMMENT ON TABLE public.personal_debt_allocations IS
  'Reparto de un movimiento de abono entre varias deudas personales con la misma persona. transactions.personal_debt_id apunta a la primera (ancla); el monto por deuda vive aquí.';

CREATE INDEX IF NOT EXISTS idx_personal_debt_allocations_user_id
  ON public.personal_debt_allocations (user_id);
CREATE INDEX IF NOT EXISTS idx_personal_debt_allocations_debt
  ON public.personal_debt_allocations (personal_debt_id);

ALTER TABLE public.personal_debt_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personal_debt_allocations_select" ON public.personal_debt_allocations FOR SELECT
  USING ((select auth.uid()) = user_id);
-- FK checks ignore RLS: also require that the movement and the debt are the
-- caller's own, so no row can point at someone else's data.
CREATE POLICY "personal_debt_allocations_insert" ON public.personal_debt_allocations FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.transactions_enc t
                WHERE t.id = transaction_id AND t.user_id = (select auth.uid()))
    AND EXISTS (SELECT 1 FROM public.personal_debts d
                WHERE d.id = personal_debt_id AND d.user_id = (select auth.uid()))
  );
CREATE POLICY "personal_debt_allocations_update" ON public.personal_debt_allocations FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.transactions_enc t
                WHERE t.id = transaction_id AND t.user_id = (select auth.uid()))
    AND EXISTS (SELECT 1 FROM public.personal_debts d
                WHERE d.id = personal_debt_id AND d.user_id = (select auth.uid()))
  );
CREATE POLICY "personal_debt_allocations_delete" ON public.personal_debt_allocations FOR DELETE
  USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_debt_allocations TO authenticated;
GRANT ALL ON public.personal_debt_allocations TO postgres, service_role;

-- Deuda general por persona: a lo sumo una viva por (persona, dirección, moneda).
ALTER TABLE public.personal_debts
  ADD COLUMN IF NOT EXISTS is_general boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_debts_general
  ON public.personal_debts (user_id, destinatario_id, direction, currency_code)
  WHERE is_general AND status <> 'cancelled';
COMMENT ON COLUMN public.personal_debts.is_general IS
  'Deuda general con la persona: acumula préstamos sueltos vinculados "a la persona en general". Una viva por persona, dirección y moneda.';

-- Abonado por deuda. security_invoker: RLS de transactions_enc y de la tabla
-- de repartos aplica al usuario que consulta. Solo columnas en claro.
CREATE OR REPLACE VIEW public.personal_debt_repayment_amounts
WITH (security_invoker = true) AS
SELECT t.user_id, t.personal_debt_id, t.id AS transaction_id, t.amount
FROM public.transactions_enc t
WHERE t.pd_role = 'repayment'
  AND t.personal_debt_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.personal_debt_allocations a WHERE a.transaction_id = t.id
  )
UNION ALL
SELECT a.user_id, a.personal_debt_id, a.transaction_id, a.amount
FROM public.personal_debt_allocations a
JOIN public.transactions_enc t
  ON t.id = a.transaction_id
 AND t.pd_role = 'repayment'
 AND t.personal_debt_id IS NOT NULL;

COMMENT ON VIEW public.personal_debt_repayment_amounts IS
  'Cuánto abona cada movimiento a cada deuda personal: el monto completo si no tiene reparto, o su parte en personal_debt_allocations.';

GRANT SELECT ON public.personal_debt_repayment_amounts TO authenticated;
GRANT SELECT ON public.personal_debt_repayment_amounts TO postgres, service_role;

COMMIT;
