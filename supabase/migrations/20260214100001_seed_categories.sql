-- Seed 17 flat system categories (12 OUTFLOW + 5 INFLOW)
-- All parent_id = NULL, is_system = true, user_id = NULL

INSERT INTO public.categories (id, name, name_es, slug, icon, color, direction, display_order, is_system, is_essential, parent_id, user_id)
VALUES
  -- OUTFLOW categories (1-12)
  ('a0000001-0001-4000-8000-000000000001', 'Housing',        'Vivienda',        'vivienda',        'home',            '#6366f1', 'OUTFLOW',  1, true, true,  NULL, NULL),
  ('a0000001-0001-4000-8000-000000000002', 'Food',           'Alimentación',    'alimentacion',    'utensils',        '#10b981', 'OUTFLOW',  2, true, true,  NULL, NULL),
  ('a0000001-0001-4000-8000-000000000003', 'Transportation', 'Transporte',      'transporte',      'car',             '#f59e0b', 'OUTFLOW',  3, true, true,  NULL, NULL),
  ('a0000001-0001-4000-8000-000000000004', 'Utilities',      'Servicios',       'servicios',       'zap',             '#3b82f6', 'OUTFLOW',  4, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000005', 'Health',         'Salud',           'salud',           'heart-pulse',     '#ef4444', 'OUTFLOW',  5, true, true,  NULL, NULL),
  ('a0000001-0001-4000-8000-000000000006', 'Education',      'Educación',       'educacion',       'graduation-cap',  '#8b5cf6', 'OUTFLOW',  6, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000007', 'Entertainment',  'Entretenimiento', 'entretenimiento', 'gamepad-2',       '#ec4899', 'OUTFLOW',  7, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000008', 'Shopping',       'Compras',         'compras',         'shopping-bag',    '#f97316', 'OUTFLOW',  8, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000009', 'Subscriptions',  'Suscripciones',   'suscripciones',   'repeat',          '#06b6d4', 'OUTFLOW',  9, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000010', 'Insurance',      'Seguros',         'seguros',         'shield',          '#14b8a6', 'OUTFLOW', 10, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000011', 'Taxes',          'Impuestos',       'impuestos',       'receipt',         '#64748b', 'OUTFLOW', 11, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000012', 'Other Expenses', 'Otros Gastos',    'otros-gastos',    'more-horizontal', '#94a3b8', 'OUTFLOW', 12, true, false, NULL, NULL),

  -- INFLOW categories (13-17)
  ('a0000001-0001-4000-8000-000000000013', 'Salary',           'Salario',        'salario',        'briefcase',    '#22c55e', 'INFLOW', 13, true, true,  NULL, NULL),
  ('a0000001-0001-4000-8000-000000000014', 'Freelance',        'Freelance',      'freelance',      'laptop',       '#06b6d4', 'INFLOW', 14, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000015', 'Investments',      'Inversiones',    'inversiones',    'trending-up',  '#6366f1', 'INFLOW', 15, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000016', 'Gifts',            'Regalos',        'regalos',        'gift',         '#ec4899', 'INFLOW', 16, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000017', 'Other Income',     'Otros Ingresos', 'otros-ingresos', 'plus-circle',  '#94a3b8', 'INFLOW', 17, true, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
