-- ============================================================
-- Add category groups (parent categories) and reorganize
-- existing 17 flat categories into a grouped hierarchy.
-- ============================================================

-- 1. Insert 7 group categories (parents)
-- UUIDs use a0000002-... prefix to distinguish from leaf a0000001-...

INSERT INTO categories (id, name, name_es, slug, icon, color, direction, display_order, is_active, is_system, is_essential, parent_id, user_id)
VALUES
  -- OUTFLOW groups
  ('a0000002-0001-4000-8000-000000000001', 'Home',                  'Hogar',                    'hogar',              'home',          '#6366f1', 'OUTFLOW', 10, true, true, false, NULL, NULL),
  ('a0000002-0001-4000-8000-000000000002', 'Food & Transportation', 'Alimentación y Transporte', 'alimentacion-transporte', 'shopping-cart', '#10b981', 'OUTFLOW', 20, true, true, false, NULL, NULL),
  ('a0000002-0001-4000-8000-000000000003', 'Health & Personal',     'Salud y Personal',          'salud-personal',     'heart',         '#ef4444', 'OUTFLOW', 30, true, true, false, NULL, NULL),
  ('a0000002-0001-4000-8000-000000000004', 'Leisure',               'Ocio',                      'ocio',               'sparkles',      '#ec4899', 'OUTFLOW', 40, true, true, false, NULL, NULL),
  ('a0000002-0001-4000-8000-000000000005', 'Obligations',           'Obligaciones',              'obligaciones',       'file-text',     '#64748b', 'OUTFLOW', 50, true, true, false, NULL, NULL),
  -- INFLOW groups
  ('a0000002-0001-4000-8000-000000000006', 'Active Income',         'Ingresos Activos',          'ingresos-activos',   'wallet',        '#22c55e', 'INFLOW',  60, true, true, false, NULL, NULL),
  ('a0000002-0001-4000-8000-000000000007', 'Passive Income',        'Ingresos Pasivos',          'ingresos-pasivos',   'piggy-bank',    '#6366f1', 'INFLOW',  70, true, true, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;


-- 2. Assign parent_id on existing leaf categories

-- Hogar: Vivienda, Servicios
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000001', display_order = 11
  WHERE id = 'a0000001-0001-4000-8000-000000000001'; -- Vivienda
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000001', display_order = 12
  WHERE id = 'a0000001-0001-4000-8000-000000000004'; -- Servicios

-- Alimentación y Transporte: Alimentación, Transporte
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000002', display_order = 21
  WHERE id = 'a0000001-0001-4000-8000-000000000002'; -- Alimentación
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000002', display_order = 22
  WHERE id = 'a0000001-0001-4000-8000-000000000003'; -- Transporte

-- Salud y Personal: Salud, Educación
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000003', display_order = 31
  WHERE id = 'a0000001-0001-4000-8000-000000000005'; -- Salud
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000003', display_order = 32
  WHERE id = 'a0000001-0001-4000-8000-000000000006'; -- Educación

-- Ocio: Entretenimiento, Compras, Suscripciones
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000004', display_order = 41
  WHERE id = 'a0000001-0001-4000-8000-000000000007'; -- Entretenimiento
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000004', display_order = 42
  WHERE id = 'a0000001-0001-4000-8000-000000000008'; -- Compras
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000004', display_order = 43
  WHERE id = 'a0000001-0001-4000-8000-000000000009'; -- Suscripciones

-- Obligaciones: Seguros, Impuestos
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000005', display_order = 51
  WHERE id = 'a0000001-0001-4000-8000-000000000010'; -- Seguros
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000005', display_order = 52
  WHERE id = 'a0000001-0001-4000-8000-000000000011'; -- Impuestos

-- Otros Gastos: standalone (no parent), reorder
UPDATE categories SET display_order = 55
  WHERE id = 'a0000001-0001-4000-8000-000000000012'; -- Otros Gastos

-- Ingresos Activos: Salario, Freelance
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000006', display_order = 61
  WHERE id = 'a0000001-0001-4000-8000-000000000013'; -- Salario
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000006', display_order = 62
  WHERE id = 'a0000001-0001-4000-8000-000000000014'; -- Freelance

-- Ingresos Pasivos: Inversiones, Regalos, Otros Ingresos
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000007', display_order = 71
  WHERE id = 'a0000001-0001-4000-8000-000000000015'; -- Inversiones
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000007', display_order = 72
  WHERE id = 'a0000001-0001-4000-8000-000000000016'; -- Regalos
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000007', display_order = 73
  WHERE id = 'a0000001-0001-4000-8000-000000000017'; -- Otros Ingresos
