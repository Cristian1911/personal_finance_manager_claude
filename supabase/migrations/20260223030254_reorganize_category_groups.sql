-- ============================================================
-- Reorganize category groups: collapse 7 groups → 6 (4 OUTFLOW + 2 INFLOW)
-- Add 4 new leaf categories: Cuidado Personal, Pagos de Deuda,
-- Transferencias, Mascotas
-- ============================================================

BEGIN;

-- 1. Detach all leaf categories from old OUTFLOW groups
UPDATE categories SET parent_id = NULL
  WHERE parent_id IN (
    'a0000002-0001-4000-8000-000000000001',  -- Hogar
    'a0000002-0001-4000-8000-000000000002',  -- Alimentación y Transporte
    'a0000002-0001-4000-8000-000000000003',  -- Salud y Personal
    'a0000002-0001-4000-8000-000000000004',  -- Ocio
    'a0000002-0001-4000-8000-000000000005'   -- Obligaciones
  );

-- 2. Delete old OUTFLOW parent groups
DELETE FROM categories WHERE id IN (
  'a0000002-0001-4000-8000-000000000001',
  'a0000002-0001-4000-8000-000000000002',
  'a0000002-0001-4000-8000-000000000003',
  'a0000002-0001-4000-8000-000000000004',
  'a0000002-0001-4000-8000-000000000005'
);

-- 3. Insert 4 new OUTFLOW parent groups
INSERT INTO categories (id, name, name_es, slug, icon, color, direction, display_order, is_active, is_system, is_essential, parent_id, user_id)
VALUES
  ('a0000002-0001-4000-8000-000000000008', 'Essentials',    'Esenciales',      'esenciales',      'house',       '#6366f1', 'OUTFLOW', 10, true, true, false, NULL, NULL),
  ('a0000002-0001-4000-8000-000000000009', 'Lifestyle',     'Estilo de Vida',  'estilo-de-vida',  'sparkles',    '#ec4899', 'OUTFLOW', 20, true, true, false, NULL, NULL),
  ('a0000002-0001-4000-8000-000000000010', 'Obligations',   'Obligaciones',    'obligaciones',    'file-text',   '#64748b', 'OUTFLOW', 30, true, true, false, NULL, NULL),
  ('a0000002-0001-4000-8000-000000000011', 'Other',         'Otros',           'otros',           'more-horizontal', '#94a3b8', 'OUTFLOW', 40, true, true, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Insert 4 new leaf categories
INSERT INTO categories (id, name, name_es, slug, icon, color, direction, display_order, is_active, is_system, is_essential, parent_id, user_id)
VALUES
  ('a0000001-0001-4000-8000-000000000018', 'Personal Care',   'Cuidado Personal', 'cuidado-personal', 'spray-can',        '#d946ef', 'OUTFLOW', 24, true, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000019', 'Debt Payments',   'Pagos de Deuda',   'pagos-de-deuda',   'banknote',         '#ea580c', 'OUTFLOW', 35, true, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000020', 'Transfers',       'Transferencias',   'transferencias',   'arrow-right-left', '#0ea5e9', 'OUTFLOW', 41, true, true, false, NULL, NULL),
  ('a0000001-0001-4000-8000-000000000021', 'Pets',            'Mascotas',         'mascotas',         'paw-print',        '#a3e635', 'OUTFLOW', 42, true, true, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. Assign leaf categories to new OUTFLOW parents

-- Esenciales: Vivienda, Servicios, Alimentación, Transporte
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000008', display_order = 11
  WHERE id = 'a0000001-0001-4000-8000-000000000001'; -- Vivienda
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000008', display_order = 12
  WHERE id = 'a0000001-0001-4000-8000-000000000004'; -- Servicios
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000008', display_order = 13
  WHERE id = 'a0000001-0001-4000-8000-000000000002'; -- Alimentación
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000008', display_order = 14
  WHERE id = 'a0000001-0001-4000-8000-000000000003'; -- Transporte

-- Estilo de Vida: Entretenimiento, Compras, Suscripciones, Cuidado Personal
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000009', display_order = 21
  WHERE id = 'a0000001-0001-4000-8000-000000000007'; -- Entretenimiento
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000009', display_order = 22
  WHERE id = 'a0000001-0001-4000-8000-000000000008'; -- Compras
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000009', display_order = 23
  WHERE id = 'a0000001-0001-4000-8000-000000000009'; -- Suscripciones
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000009', display_order = 24
  WHERE id = 'a0000001-0001-4000-8000-000000000018'; -- Cuidado Personal

-- Obligaciones: Salud, Educación, Seguros, Impuestos, Pagos de Deuda
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000010', display_order = 31
  WHERE id = 'a0000001-0001-4000-8000-000000000005'; -- Salud
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000010', display_order = 32
  WHERE id = 'a0000001-0001-4000-8000-000000000006'; -- Educación
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000010', display_order = 33
  WHERE id = 'a0000001-0001-4000-8000-000000000010'; -- Seguros
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000010', display_order = 34
  WHERE id = 'a0000001-0001-4000-8000-000000000011'; -- Impuestos
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000010', display_order = 35
  WHERE id = 'a0000001-0001-4000-8000-000000000019'; -- Pagos de Deuda

-- Otros: Transferencias, Mascotas, Otros Gastos
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000011', display_order = 41
  WHERE id = 'a0000001-0001-4000-8000-000000000020'; -- Transferencias
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000011', display_order = 42
  WHERE id = 'a0000001-0001-4000-8000-000000000021'; -- Mascotas
UPDATE categories SET parent_id = 'a0000002-0001-4000-8000-000000000011', display_order = 43
  WHERE id = 'a0000001-0001-4000-8000-000000000012'; -- Otros Gastos

-- 6. Update INFLOW group display_order (keep groups unchanged, just reorder)
UPDATE categories SET display_order = 50
  WHERE id = 'a0000002-0001-4000-8000-000000000006'; -- Ingresos Activos
UPDATE categories SET display_order = 51
  WHERE id = 'a0000001-0001-4000-8000-000000000013'; -- Salario
UPDATE categories SET display_order = 52
  WHERE id = 'a0000001-0001-4000-8000-000000000014'; -- Freelance

UPDATE categories SET display_order = 60
  WHERE id = 'a0000002-0001-4000-8000-000000000007'; -- Ingresos Pasivos
UPDATE categories SET display_order = 61
  WHERE id = 'a0000001-0001-4000-8000-000000000015'; -- Inversiones
UPDATE categories SET display_order = 62
  WHERE id = 'a0000001-0001-4000-8000-000000000016'; -- Regalos
UPDATE categories SET display_order = 63
  WHERE id = 'a0000001-0001-4000-8000-000000000017'; -- Otros Ingresos

COMMIT;
