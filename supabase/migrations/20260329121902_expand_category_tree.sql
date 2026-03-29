-- Expand category tree: add new parents + ~43 Colombian subcategories
-- Phase 1 of Category Kits & Tag System
--
-- Changes:
--   1. Rename Alimentación → Comer Fuera (needs → wants)
--   2. Insert 3 new parent categories (Seguros, Ahorro e Inversión, Educación)
--      Note: Entretenimiento already exists (a0000001-0000-0000-0000-000000000006)
--   3. Insert ~43 subcategories under 13 parents
--   4. Reparent user subcategories containing "mercado/supermercado/tienda" to Hogar

BEGIN;

-- ============================================================
-- 1. Rename Alimentación → Comer Fuera and change to variable (wants)
-- ============================================================
UPDATE public.categories
SET name       = 'Eating Out',
    name_es    = 'Comer Fuera',
    slug       = 'comer-fuera',
    icon       = 'utensils-crossed',
    is_essential = false,
    expense_type = 'variable'
WHERE id = 'b0000001-0001-4000-8000-000000000002';

-- ============================================================
-- 2. Insert 3 new parent categories (Entretenimiento already exists)
-- ============================================================
INSERT INTO public.categories
  (id, name, name_es, slug, icon, color, direction, is_system, is_essential, display_order, parent_id, user_id)
VALUES
  ('b0000001-0001-4000-8000-000000000009', 'Insurance',            'Seguros',              'seguros',              'shield-check',  '#0ea5e9', 'OUTFLOW', true, true,  5, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000010', 'Savings & Investment', 'Ahorro e Inversión',   'ahorro-e-inversion',   'piggy-bank',    '#22c55e', 'OUTFLOW', true, false, 7, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000011', 'Education',            'Educación',            'educacion',            'graduation-cap','#8b5cf6', 'OUTFLOW', true, false, 8, NULL, NULL);

-- Update display_order for existing parents to make room
UPDATE public.categories SET display_order = 10 WHERE id = 'b0000001-0001-4000-8000-000000000005'; -- Estilo de vida
UPDATE public.categories SET display_order = 11 WHERE id = 'b0000001-0001-4000-8000-000000000002'; -- Comer Fuera (was Alimentación)
UPDATE public.categories SET display_order = 9  WHERE id = 'a0000001-0000-0000-0000-000000000006'; -- Entretenimiento (existing)

-- ============================================================
-- 3. Insert subcategories (color inherits from parent)
-- ============================================================

INSERT INTO public.categories
  (id, name, name_es, slug, icon, color, direction, is_system, is_essential, display_order, parent_id, user_id, expense_type)
VALUES
  -- ── Hogar (parent 001, color #6366f1) ───────────────────
  ('c0000001-0001-4000-8000-000000000001', 'Rent/Mortgage',     'Arriendo/Hipoteca',   'arriendo-hipoteca',    'house',          '#6366f1', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000002', 'Building Admin',    'Administración',      'administracion',       'building',       '#6366f1', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000003', 'Groceries',         'Mercado',             'mercado',              'shopping-cart',  '#6366f1', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000004', 'Utilities',         'Servicios públicos',  'servicios-publicos',   'zap',            '#6366f1', 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000005', 'Internet',          'Internet',            'internet',             'wifi',           '#6366f1', 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000006', 'Mobile Phone',      'Celular',             'celular',              'smartphone',     '#6366f1', 'OUTFLOW', true, false, 6, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000007', 'Maintenance',       'Mantenimiento',       'mantenimiento-hogar',  'wrench',         '#6366f1', 'OUTFLOW', true, false, 7, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000008', 'Household Items',   'Artículos hogar',     'articulos-hogar',      'lamp',           '#6366f1', 'OUTFLOW', true, false, 8, 'b0000001-0001-4000-8000-000000000001', NULL, 'variable'),

  -- ── Comer Fuera (parent 002, color #10b981) ─────────────
  ('c0000001-0002-4000-8000-000000000001', 'Restaurants',       'Restaurantes',        'restaurantes',         'utensils',       '#10b981', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000002', NULL, 'variable'),
  ('c0000001-0002-4000-8000-000000000002', 'Delivery',          'Domicilios',          'domicilios',           'bike',           '#10b981', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000002', NULL, 'variable'),
  ('c0000001-0002-4000-8000-000000000003', 'Coffee/Snacks',     'Café/Snacks',         'cafe-snacks',          'coffee',         '#10b981', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000002', NULL, 'variable'),

  -- ── Transporte (parent 003, color #f59e0b) ──────────────
  ('c0000001-0003-4000-8000-000000000001', 'Public Transit',    'Transporte público',  'transporte-publico',   'bus',            '#f59e0b', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000003', NULL, 'fixed'),
  ('c0000001-0003-4000-8000-000000000002', 'Gas',               'Gasolina',            'gasolina',             'fuel',           '#f59e0b', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000003', NULL, 'variable'),
  ('c0000001-0003-4000-8000-000000000003', 'Tolls',             'Peajes',              'peajes',               'milestone',      '#f59e0b', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000003', NULL, 'variable'),
  ('c0000001-0003-4000-8000-000000000004', 'Parking',           'Parqueadero',         'parqueadero',          'square-parking', '#f59e0b', 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000003', NULL, 'variable'),

  -- ── Salud (parent 004, color #ef4444) ───────────────────
  ('c0000001-0004-4000-8000-000000000001', 'EPS',               'EPS',                 'eps',                  'hospital',       '#ef4444', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000004', NULL, 'fixed'),
  ('c0000001-0004-4000-8000-000000000002', 'Prepaid Medicine',  'Medicina prepagada',  'medicina-prepagada',   'stethoscope',    '#ef4444', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000004', NULL, 'fixed'),
  ('c0000001-0004-4000-8000-000000000003', 'Co-pays',           'Copagos',             'copagos',              'receipt',        '#ef4444', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000004', NULL, 'variable'),
  ('c0000001-0004-4000-8000-000000000004', 'Medications',       'Medicamentos',        'medicamentos',         'pill',           '#ef4444', 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000004', NULL, 'variable'),
  ('c0000001-0004-4000-8000-000000000005', 'Dental',            'Odontología',         'odontologia',          'smile',          '#ef4444', 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000004', NULL, 'variable'),

  -- ── Seguros (parent 009, color #0ea5e9 — NEW) ──────────
  ('c0000001-0009-4000-8000-000000000001', 'Life Insurance',    'Seguro de vida',      'seguro-vida',          'heart-handshake','#0ea5e9', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000009', NULL, 'fixed'),
  ('c0000001-0009-4000-8000-000000000002', 'Vehicle Insurance', 'Seguro vehículo',     'seguro-vehiculo',      'car',            '#0ea5e9', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000009', NULL, 'fixed'),
  ('c0000001-0009-4000-8000-000000000003', 'Home Insurance',    'Seguro hogar',        'seguro-hogar',         'home',           '#0ea5e9', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000009', NULL, 'fixed'),
  ('c0000001-0009-4000-8000-000000000004', 'ARL',               'ARL',                 'arl',                  'hard-hat',       '#0ea5e9', 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000009', NULL, 'fixed'),

  -- ── Obligaciones (parent 006, color #64748b) ───────────
  ('c0000001-0006-4000-8000-000000000001', 'Loan Payment',      'Cuota crédito',       'cuota-credito',        'banknote',       '#64748b', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000002', 'Credit Card',       'Tarjeta de crédito',  'tarjeta-credito',      'credit-card',    '#64748b', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000003', 'Alimony',           'Pensión alimentaria', 'pension-alimentaria',  'users',          '#64748b', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000004', 'Taxes',             'Impuestos',           'impuestos',            'landmark',       '#64748b', 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000005', 'Property Tax',      'Predial',             'predial',              'map-pin',        '#64748b', 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000006', 'SOAT',              'SOAT',                'soat',                 'file-badge',     '#64748b', 'OUTFLOW', true, false, 6, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000007', 'Vehicle Inspection','Tecnicomecánica',     'tecnicomecanica',      'clipboard-check','#64748b', 'OUTFLOW', true, false, 7, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000008', 'Vehicle Tax',       'Vehicular',           'vehicular',            'car',            '#64748b', 'OUTFLOW', true, false, 8, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),

  -- ── Entretenimiento (existing parent a0000001-...-000000000006, color #8b5cf6) ──
  ('c0000001-0012-4000-8000-000000000001', 'Streaming',         'Streaming',           'streaming',            'tv',             '#8b5cf6', 'OUTFLOW', true, false, 1, 'a0000001-0000-0000-0000-000000000006', NULL, 'variable'),
  ('c0000001-0012-4000-8000-000000000002', 'Movies/Events',     'Cine/Eventos',        'cine-eventos',         'ticket',         '#8b5cf6', 'OUTFLOW', true, false, 2, 'a0000001-0000-0000-0000-000000000006', NULL, 'variable'),
  ('c0000001-0012-4000-8000-000000000003', 'Hobbies',           'Hobbies',             'hobbies',              'palette',        '#8b5cf6', 'OUTFLOW', true, false, 3, 'a0000001-0000-0000-0000-000000000006', NULL, 'variable'),
  ('c0000001-0012-4000-8000-000000000004', 'Subscriptions',     'Suscripciones',       'suscripciones',        'repeat',         '#8b5cf6', 'OUTFLOW', true, false, 4, 'a0000001-0000-0000-0000-000000000006', NULL, 'variable'),

  -- ── Estilo de Vida (parent 005, color #ec4899) ──────────
  ('c0000001-0005-4000-8000-000000000001', 'Clothing',          'Ropa',                'ropa',                 'shirt',          '#ec4899', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),
  ('c0000001-0005-4000-8000-000000000002', 'Personal Care',     'Cuidado personal',    'cuidado-personal',     'sparkles',       '#ec4899', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),
  ('c0000001-0005-4000-8000-000000000003', 'Gym/Sports',        'Gym/Deporte',         'gym-deporte',          'dumbbell',       '#ec4899', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),
  ('c0000001-0005-4000-8000-000000000004', 'Gifts',             'Regalos',             'regalos',              'gift',           '#ec4899', 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),
  ('c0000001-0005-4000-8000-000000000005', 'Pets',              'Mascotas',            'mascotas',             'paw-print',      '#ec4899', 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),

  -- ── Educación (parent 011, color #8b5cf6 — NEW) ────────
  ('c0000001-0011-4000-8000-000000000001', 'Tuition',           'Matrícula/Pensión',   'matricula-pension',    'school',         '#8b5cf6', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000011', NULL, 'variable'),
  ('c0000001-0011-4000-8000-000000000002', 'Supplies',          'Útiles/Materiales',   'utiles-materiales',    'pencil',         '#8b5cf6', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000011', NULL, 'variable'),
  ('c0000001-0011-4000-8000-000000000003', 'Courses',           'Cursos/Capacitación', 'cursos-capacitacion',  'book-open',      '#8b5cf6', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000011', NULL, 'variable'),
  ('c0000001-0011-4000-8000-000000000004', 'Books',             'Libros',              'libros',               'book',           '#8b5cf6', 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000011', NULL, 'variable'),

  -- ── Ahorro e Inversión (parent 010, color #22c55e — NEW) ─
  ('c0000001-0010-4000-8000-000000000001', 'Emergency Fund',    'Fondo de emergencia', 'fondo-emergencia',     'shield',         '#22c55e', 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),
  ('c0000001-0010-4000-8000-000000000002', 'Severance',         'Cesantías',           'cesantias',            'landmark',       '#22c55e', 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),
  ('c0000001-0010-4000-8000-000000000003', 'Voluntary Pension', 'Pensión voluntaria',  'pension-voluntaria',   'trending-up',    '#22c55e', 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),
  ('c0000001-0010-4000-8000-000000000004', 'CDT/Investments',   'CDT/Inversiones',     'cdt-inversiones',      'bar-chart-3',    '#22c55e', 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),
  ('c0000001-0010-4000-8000-000000000005', 'Scheduled Savings', 'Ahorro programado',   'ahorro-programado',    'calendar-check', '#22c55e', 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),

  -- ── Ingresos (parent 007, color #22c55e) ────────────────
  ('c0000001-0007-4000-8000-000000000001', 'Salary',            'Salario',             'salario',              'banknote',       '#22c55e', 'INFLOW',  true, false, 1, 'b0000001-0001-4000-8000-000000000007', NULL, NULL),
  ('c0000001-0007-4000-8000-000000000002', 'Freelance',         'Freelance',           'freelance',            'laptop',         '#22c55e', 'INFLOW',  true, false, 2, 'b0000001-0001-4000-8000-000000000007', NULL, NULL),
  ('c0000001-0007-4000-8000-000000000003', 'Bonus',             'Prima',               'prima',                'award',          '#22c55e', 'INFLOW',  true, false, 3, 'b0000001-0001-4000-8000-000000000007', NULL, NULL),
  ('c0000001-0007-4000-8000-000000000004', 'Bonus Payment',     'Bonificación',        'bonificacion',         'badge-dollar-sign','#22c55e','INFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000007', NULL, NULL),

  -- ── Otros Ingresos (parent 008, color #64748b) ──────────
  ('c0000001-0008-4000-8000-000000000001', 'Rental Income',     'Arriendo recibido',   'arriendo-recibido',    'home',           '#64748b', 'INFLOW',  true, false, 1, 'b0000001-0001-4000-8000-000000000008', NULL, NULL),
  ('c0000001-0008-4000-8000-000000000002', 'Dividends',         'Dividendos',          'dividendos',           'trending-up',    '#64748b', 'INFLOW',  true, false, 2, 'b0000001-0001-4000-8000-000000000008', NULL, NULL),
  ('c0000001-0008-4000-8000-000000000003', 'Tax Refund',        'Devolución impuestos','devolucion-impuestos', 'receipt',        '#64748b', 'INFLOW',  true, false, 3, 'b0000001-0001-4000-8000-000000000008', NULL, NULL),
  ('c0000001-0008-4000-8000-000000000004', 'Asset Sale',        'Venta de bienes',     'venta-bienes',         'package',        '#64748b', 'INFLOW',  true, false, 4, 'b0000001-0001-4000-8000-000000000008', NULL, NULL);

-- ============================================================
-- 4. Reparent user subcategories with grocery-related names
--    from old Alimentación (now Comer Fuera) to Hogar
-- ============================================================
UPDATE public.categories
SET parent_id = 'b0000001-0001-4000-8000-000000000001'  -- Hogar
WHERE parent_id = 'b0000001-0001-4000-8000-000000000002' -- Comer Fuera (was Alimentación)
  AND is_system = false
  AND (
    lower(name_es) LIKE '%mercado%'
    OR lower(name_es) LIKE '%supermercado%'
    OR lower(name_es) LIKE '%tienda%'
    OR lower(name) LIKE '%grocer%'
    OR lower(name) LIKE '%market%'
  );

COMMIT;
