-- Replace 17 flat seed categories with 8 ADHD-friendly parent categories
-- This migration:
--   1. Nullifies category_id on transactions referencing system categories
--   2. Deletes budgets referencing system categories (safety; FK cascades anyway)
--   3. Deletes all system categories (is_system = true)
--   4. Inserts 8 new parent categories (6 outflow + 2 inflow)

BEGIN;

-- 1. Nullify category_id on transactions that reference system categories
UPDATE public.transactions
SET    category_id = NULL
WHERE  category_id IN (
  SELECT id FROM public.categories WHERE is_system = true
);

-- 2. Delete budgets referencing system categories (safety measure)
DELETE FROM public.budgets
WHERE  category_id IN (
  SELECT id FROM public.categories WHERE is_system = true
);

-- 3. Delete all system categories
DELETE FROM public.categories
WHERE  is_system = true;

-- 4. Insert 8 new parent categories
INSERT INTO public.categories (id, name, name_es, slug, icon, color, direction, is_system, is_essential, display_order, parent_id, user_id)
VALUES
  -- OUTFLOW parents
  ('b0000001-0001-4000-8000-000000000001', 'Home',         'Hogar',           'hogar',           'home',         '#6366f1', 'OUTFLOW', true, true,  1, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000002', 'Food',         'Alimentación',    'alimentacion',    'utensils',     '#10b981', 'OUTFLOW', true, true,  2, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000003', 'Transport',    'Transporte',      'transporte',      'car',          '#f59e0b', 'OUTFLOW', true, true,  3, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000004', 'Health',       'Salud',           'salud',           'heart-pulse',  '#ef4444', 'OUTFLOW', true, true,  4, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000005', 'Lifestyle',    'Estilo de vida',  'estilo-de-vida',  'sparkles',     '#ec4899', 'OUTFLOW', true, false, 5, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000006', 'Obligations',  'Obligaciones',    'obligaciones',    'shield',       '#64748b', 'OUTFLOW', true, true,  6, NULL, NULL),
  -- INFLOW parents
  ('b0000001-0001-4000-8000-000000000007', 'Income',       'Ingresos',        'ingresos',        'briefcase',    '#22c55e', 'INFLOW',  true, false, 1, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000008', 'Other Income', 'Otros ingresos',  'otros-ingresos',  'plus-circle',  '#64748b', 'INFLOW',  true, false, 2, NULL, NULL);

COMMIT;
