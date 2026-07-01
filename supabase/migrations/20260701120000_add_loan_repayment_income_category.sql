-- Default income category for personal-debt repayments received ("abono persona").
-- These INFLOWs are money coming back from a loan you made — not salary, not a
-- bonus — so they get their own system subcategory under "Otros Ingresos"
-- (parent b0000001-0001-4000-8000-000000000008). recordRepayment() stamps this
-- id on repayment INFLOWs of `lent` debts. System row (user_id NULL) shared by
-- every user; idempotent so re-running is a no-op.
INSERT INTO public.categories
  (id, name, name_es, slug, icon, color, direction, is_system, is_essential, display_order, parent_id, user_id)
VALUES
  ('c0000001-0008-4000-8000-000000000005', 'Loan Repayment', 'Devolución de préstamos', 'devolucion-prestamos', 'coins', '#64748b', 'INFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000008', NULL)
ON CONFLICT (id) DO NOTHING;
