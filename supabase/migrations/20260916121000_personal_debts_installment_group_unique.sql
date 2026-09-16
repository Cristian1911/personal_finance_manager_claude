-- Una compra a cuotas se reparte una sola vez: dos importaciones concurrentes
-- (doble envío, dos pestañas) leen "sin grupo" y crearían dos juegos de deudas.
-- La unicidad por (usuario, compra, persona) cierra esa ventana; el insert que
-- pierde recibe 23505 y splitExistingTransaction lo reporta como "ya repartida".
CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_debts_installment_group_person
  ON public.personal_debts (user_id, installment_group_id, destinatario_id)
  WHERE installment_group_id IS NOT NULL;
