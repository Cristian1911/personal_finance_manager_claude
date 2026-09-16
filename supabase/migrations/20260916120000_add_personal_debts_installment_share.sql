-- ============================================================================
-- Compras a cuotas compartidas: una sola deuda por compra (precio + interés
-- estimado), no una por cuota.
--
-- Cuando el usuario reparte una compra a N cuotas importada del extracto, las
-- personal_debts del grupo se calculan sobre el costo total de la compra y se
-- vinculan a la compra por transactions.installment_group_id (hash estable entre
-- meses). Las cuotas siguientes que lleguen en próximos extractos se estampan
-- con el mismo split_group_id y NO crean deudas nuevas.
--
-- Columnas plain (tabla sin cifrado, igual que split_group_id).
-- ============================================================================

BEGIN;

ALTER TABLE public.personal_debts
  ADD COLUMN IF NOT EXISTS installment_group_id text,
  ADD COLUMN IF NOT EXISTS installment_total smallint,
  ADD COLUMN IF NOT EXISTS group_total_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS interest_amount numeric(14,2);

CREATE INDEX IF NOT EXISTS idx_personal_debts_installment_group
  ON public.personal_debts (user_id, installment_group_id)
  WHERE installment_group_id IS NOT NULL;

COMMENT ON COLUMN public.personal_debts.installment_group_id IS
  'transactions.installment_group_id de la compra a cuotas de la que salió esta deuda (compra completa cobrada una vez). NULL en repartos normales.';
COMMENT ON COLUMN public.personal_debts.installment_total IS
  'Número de cuotas de la compra. Cuota sugerida para la persona = principal_amount / installment_total.';
COMMENT ON COLUMN public.personal_debts.group_total_amount IS
  'Monto total sobre el que se repartió (precio + interés estimado). Igual en todas las deudas del grupo. NULL → usar el monto de la transacción origen.';
COMMENT ON COLUMN public.personal_debts.interest_amount IS
  'Parte estimada de interés dentro de principal_amount (anualidad francesa con la tasa EA del extracto).';

COMMIT;
