# Category Kits & Tag System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Zeta's category tree to 13 Colombian-optimized parents with ~43 subcategories (Phase 1), then add a universal tag system with YNAB rhythm view (Phase 2).

**Architecture:** Phase 1 is a single Supabase migration that renames Alimentación → Comer Fuera, inserts 4 new parent categories + ~43 subcategories, and reparents Mercado to Hogar. Phase 2 adds 5 new tables (tag_groups, tags, 3 junction tables), seeds the Ritmo YNAB tag group, creates tag CRUD server actions, a shared TagPicker component, a budget rhythm view toggle, transaction tag filtering, and a tag management page.

**Tech Stack:** Supabase (PostgreSQL), Next.js 15 (Server Actions, App Router), TypeScript, Tailwind v4, shadcn/ui, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-category-kits-and-tag-system-design.md`

---

## Phase 1: Category Tree Expansion

### Task 1: Migration — Expand Category Tree

**Files:**
- Create: `supabase/migrations/20260330000001_expand_category_tree.sql`

- [ ] **Step 1: Create the migration file**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
npx supabase migration new expand_category_tree
```

- [ ] **Step 2: Write the migration SQL**

Write to the generated migration file (timestamp will vary):

```sql
-- Expand category tree: 8 → 13 parents, add ~43 Colombian subcategories
-- Phase 1 of Category Kits & Tag System
--
-- Changes:
--   1. Rename Alimentación → Comer Fuera (needs → wants)
--   2. Insert 4 new parent categories (Seguros, Ahorro e Inversión, Educación, Entretenimiento)
--   3. Insert ~43 subcategories under all 13 parents
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
-- 2. Insert 4 new parent categories
-- ============================================================
INSERT INTO public.categories
  (id, name, name_es, slug, icon, color, direction, is_system, is_essential, display_order, parent_id, user_id)
VALUES
  -- Needs parents
  ('b0000001-0001-4000-8000-000000000009', 'Insurance',            'Seguros',              'seguros',              'shield-check',  '#0ea5e9', 'OUTFLOW', true, true,  5, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000010', 'Savings & Investment', 'Ahorro e Inversión',   'ahorro-e-inversion',   'piggy-bank',    '#22c55e', 'OUTFLOW', true, false, 7, NULL, NULL),
  -- Wants parents
  ('b0000001-0001-4000-8000-000000000011', 'Education',            'Educación',            'educacion',            'graduation-cap','#8b5cf6', 'OUTFLOW', true, false, 8, NULL, NULL),
  ('b0000001-0001-4000-8000-000000000012', 'Entertainment',        'Entretenimiento',      'entretenimiento',      'clapperboard',  '#f43f5e', 'OUTFLOW', true, false, 9, NULL, NULL);

-- Update display_order for existing parents to make room
UPDATE public.categories SET display_order = 10 WHERE id = 'b0000001-0001-4000-8000-000000000005'; -- Estilo de vida
UPDATE public.categories SET display_order = 11 WHERE id = 'b0000001-0001-4000-8000-000000000002'; -- Comer Fuera (was Alimentación)

-- ============================================================
-- 3. Insert subcategories
-- ============================================================
-- UUID scheme: c0000001-PPPP-4000-8000-0000000000NN
--   PPPP = parent suffix (0001=Hogar, 0002=ComerFuera, etc.)
--   NN   = child order within parent

INSERT INTO public.categories
  (id, name, name_es, slug, icon, color, direction, is_system, is_essential, display_order, parent_id, user_id, expense_type)
VALUES
  -- ── Hogar (parent 001) ──────────────────────────────────
  ('c0000001-0001-4000-8000-000000000001', 'Rent/Mortgage',     'Arriendo/Hipoteca',   'arriendo-hipoteca',    'house',          NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000002', 'Building Admin',    'Administración',      'administracion',       'building',       NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000003', 'Groceries',         'Mercado',             'mercado',              'shopping-cart',  NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000004', 'Utilities',         'Servicios públicos',  'servicios-publicos',   'zap',            NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000005', 'Internet',          'Internet',            'internet',             'wifi',           NULL, 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000006', 'Mobile Phone',      'Celular',             'celular',              'smartphone',     NULL, 'OUTFLOW', true, false, 6, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000007', 'Maintenance',       'Mantenimiento',       'mantenimiento-hogar',  'wrench',         NULL, 'OUTFLOW', true, false, 7, 'b0000001-0001-4000-8000-000000000001', NULL, 'fixed'),
  ('c0000001-0001-4000-8000-000000000008', 'Household Items',   'Artículos hogar',     'articulos-hogar',      'lamp',           NULL, 'OUTFLOW', true, false, 8, 'b0000001-0001-4000-8000-000000000001', NULL, 'variable'),

  -- ── Comer Fuera (parent 002, renamed from Alimentación) ──
  ('c0000001-0002-4000-8000-000000000001', 'Restaurants',       'Restaurantes',        'restaurantes',         'utensils',       NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000002', NULL, 'variable'),
  ('c0000001-0002-4000-8000-000000000002', 'Delivery',          'Domicilios',          'domicilios',           'bike',           NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000002', NULL, 'variable'),
  ('c0000001-0002-4000-8000-000000000003', 'Coffee/Snacks',     'Café/Snacks',         'cafe-snacks',          'coffee',         NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000002', NULL, 'variable'),

  -- ── Transporte (parent 003) ─────────────────────────────
  ('c0000001-0003-4000-8000-000000000001', 'Public Transit',    'Transporte público',  'transporte-publico',   'bus',            NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000003', NULL, 'fixed'),
  ('c0000001-0003-4000-8000-000000000002', 'Gas',               'Gasolina',            'gasolina',             'fuel',           NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000003', NULL, 'variable'),
  ('c0000001-0003-4000-8000-000000000003', 'Tolls',             'Peajes',              'peajes',               'milestone',      NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000003', NULL, 'variable'),
  ('c0000001-0003-4000-8000-000000000004', 'Parking',           'Parqueadero',         'parqueadero',          'square-parking', NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000003', NULL, 'variable'),

  -- ── Salud (parent 004) ──────────────────────────────────
  ('c0000001-0004-4000-8000-000000000001', 'EPS',               'EPS',                 'eps',                  'hospital',       NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000004', NULL, 'fixed'),
  ('c0000001-0004-4000-8000-000000000002', 'Prepaid Medicine',  'Medicina prepagada',  'medicina-prepagada',   'stethoscope',    NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000004', NULL, 'fixed'),
  ('c0000001-0004-4000-8000-000000000003', 'Co-pays',           'Copagos',             'copagos',              'receipt',        NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000004', NULL, 'variable'),
  ('c0000001-0004-4000-8000-000000000004', 'Medications',       'Medicamentos',        'medicamentos',         'pill',           NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000004', NULL, 'variable'),
  ('c0000001-0004-4000-8000-000000000005', 'Dental',            'Odontología',         'odontologia',          'smile',          NULL, 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000004', NULL, 'variable'),

  -- ── Seguros (parent 009 — NEW) ──────────────────────────
  ('c0000001-0009-4000-8000-000000000001', 'Life Insurance',    'Seguro de vida',      'seguro-vida',          'heart-handshake',NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000009', NULL, 'fixed'),
  ('c0000001-0009-4000-8000-000000000002', 'Vehicle Insurance', 'Seguro vehículo',     'seguro-vehiculo',      'car',            NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000009', NULL, 'fixed'),
  ('c0000001-0009-4000-8000-000000000003', 'Home Insurance',    'Seguro hogar',        'seguro-hogar',         'home',           NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000009', NULL, 'fixed'),
  ('c0000001-0009-4000-8000-000000000004', 'ARL',               'ARL',                 'arl',                  'hard-hat',       NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000009', NULL, 'fixed'),

  -- ── Obligaciones (parent 006) ───────────────────────────
  ('c0000001-0006-4000-8000-000000000001', 'Loan Payment',      'Cuota crédito',       'cuota-credito',        'banknote',       NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000002', 'Credit Card',       'Tarjeta de crédito',  'tarjeta-credito',      'credit-card',    NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000003', 'Alimony',           'Pensión alimentaria', 'pension-alimentaria',  'users',          NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000004', 'Taxes',             'Impuestos',           'impuestos',            'landmark',       NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000005', 'Property Tax',      'Predial',             'predial',              'map-pin',        NULL, 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000006', 'SOAT',              'SOAT',                'soat',                 'file-badge',     NULL, 'OUTFLOW', true, false, 6, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000007', 'Vehicle Inspection','Tecnicomecánica',     'tecnicomecanica',      'clipboard-check',NULL, 'OUTFLOW', true, false, 7, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),
  ('c0000001-0006-4000-8000-000000000008', 'Vehicle Tax',       'Vehicular',           'vehicular',            'car',            NULL, 'OUTFLOW', true, false, 8, 'b0000001-0001-4000-8000-000000000006', NULL, 'fixed'),

  -- ── Entretenimiento (parent 012 — NEW) ──────────────────
  ('c0000001-0012-4000-8000-000000000001', 'Streaming',         'Streaming',           'streaming',            'tv',             NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000012', NULL, 'variable'),
  ('c0000001-0012-4000-8000-000000000002', 'Movies/Events',     'Cine/Eventos',        'cine-eventos',         'ticket',         NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000012', NULL, 'variable'),
  ('c0000001-0012-4000-8000-000000000003', 'Hobbies',           'Hobbies',             'hobbies',              'palette',        NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000012', NULL, 'variable'),
  ('c0000001-0012-4000-8000-000000000004', 'Subscriptions',     'Suscripciones',       'suscripciones',        'repeat',         NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000012', NULL, 'variable'),

  -- ── Estilo de Vida (parent 005) ─────────────────────────
  ('c0000001-0005-4000-8000-000000000001', 'Clothing',          'Ropa',                'ropa',                 'shirt',          NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),
  ('c0000001-0005-4000-8000-000000000002', 'Personal Care',     'Cuidado personal',    'cuidado-personal',     'sparkles',       NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),
  ('c0000001-0005-4000-8000-000000000003', 'Gym/Sports',        'Gym/Deporte',         'gym-deporte',          'dumbbell',       NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),
  ('c0000001-0005-4000-8000-000000000004', 'Gifts',             'Regalos',             'regalos',              'gift',           NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),
  ('c0000001-0005-4000-8000-000000000005', 'Pets',              'Mascotas',            'mascotas',             'paw-print',      NULL, 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000005', NULL, 'variable'),

  -- ── Educación (parent 011 — NEW) ────────────────────────
  ('c0000001-0011-4000-8000-000000000001', 'Tuition',           'Matrícula/Pensión',   'matricula-pension',    'school',         NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000011', NULL, 'variable'),
  ('c0000001-0011-4000-8000-000000000002', 'Supplies',          'Útiles/Materiales',   'utiles-materiales',    'pencil',         NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000011', NULL, 'variable'),
  ('c0000001-0011-4000-8000-000000000003', 'Courses',           'Cursos/Capacitación', 'cursos-capacitacion',  'book-open',      NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000011', NULL, 'variable'),
  ('c0000001-0011-4000-8000-000000000004', 'Books',             'Libros',              'libros',               'book',           NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000011', NULL, 'variable'),

  -- ── Ahorro e Inversión (parent 010 — NEW) ───────────────
  ('c0000001-0010-4000-8000-000000000001', 'Emergency Fund',    'Fondo de emergencia', 'fondo-emergencia',     'shield',         NULL, 'OUTFLOW', true, false, 1, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),
  ('c0000001-0010-4000-8000-000000000002', 'Severance',         'Cesantías',           'cesantias',            'landmark',       NULL, 'OUTFLOW', true, false, 2, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),
  ('c0000001-0010-4000-8000-000000000003', 'Voluntary Pension', 'Pensión voluntaria',  'pension-voluntaria',   'trending-up',    NULL, 'OUTFLOW', true, false, 3, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),
  ('c0000001-0010-4000-8000-000000000004', 'CDT/Investments',   'CDT/Inversiones',     'cdt-inversiones',      'bar-chart-3',    NULL, 'OUTFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),
  ('c0000001-0010-4000-8000-000000000005', 'Scheduled Savings', 'Ahorro programado',   'ahorro-programado',    'calendar-check', NULL, 'OUTFLOW', true, false, 5, 'b0000001-0001-4000-8000-000000000010', NULL, NULL),

  -- ── Ingresos (parent 007) ───────────────────────────────
  ('c0000001-0007-4000-8000-000000000001', 'Salary',            'Salario',             'salario',              'banknote',       NULL, 'INFLOW',  true, false, 1, 'b0000001-0001-4000-8000-000000000007', NULL, NULL),
  ('c0000001-0007-4000-8000-000000000002', 'Freelance',         'Freelance',           'freelance',            'laptop',         NULL, 'INFLOW',  true, false, 2, 'b0000001-0001-4000-8000-000000000007', NULL, NULL),
  ('c0000001-0007-4000-8000-000000000003', 'Bonus',             'Prima',               'prima',                'award',          NULL, 'INFLOW',  true, false, 3, 'b0000001-0001-4000-8000-000000000007', NULL, NULL),
  ('c0000001-0007-4000-8000-000000000004', 'Bonus Payment',     'Bonificación',        'bonificacion',         'badge-dollar-sign', NULL, 'INFLOW', true, false, 4, 'b0000001-0001-4000-8000-000000000007', NULL, NULL),

  -- ── Otros Ingresos (parent 008) ─────────────────────────
  ('c0000001-0008-4000-8000-000000000001', 'Rental Income',     'Arriendo recibido',   'arriendo-recibido',    'home',           NULL, 'INFLOW',  true, false, 1, 'b0000001-0001-4000-8000-000000000008', NULL, NULL),
  ('c0000001-0008-4000-8000-000000000002', 'Dividends',         'Dividendos',          'dividendos',           'trending-up',    NULL, 'INFLOW',  true, false, 2, 'b0000001-0001-4000-8000-000000000008', NULL, NULL),
  ('c0000001-0008-4000-8000-000000000003', 'Tax Refund',        'Devolución impuestos','devolucion-impuestos', 'receipt',        NULL, 'INFLOW',  true, false, 3, 'b0000001-0001-4000-8000-000000000008', NULL, NULL),
  ('c0000001-0008-4000-8000-000000000004', 'Asset Sale',        'Venta de bienes',     'venta-bienes',         'package',        NULL, 'INFLOW',  true, false, 4, 'b0000001-0001-4000-8000-000000000008', NULL, NULL);

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
```

- [ ] **Step 3: Push the migration**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
npx supabase db push
```

Expected: Migration applies successfully. No errors.

- [ ] **Step 4: Regenerate TypeScript types**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts.tmp
# Strip potential compdef warning line and verify header
head -1 src/types/database.ts.tmp
# Should start with "export type Json ="
mv src/types/database.ts.tmp src/types/database.ts
```

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

Expected: Clean build, no type errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat(categories): expand tree to 13 parents with 43 Colombian subcategories

- Rename Alimentación → Comer Fuera (variable/wants)
- Add parents: Seguros, Ahorro e Inversión, Educación, Entretenimiento
- Seed subcategories: EPS, SOAT, Mercado, Cesantías, etc.
- Reparent grocery-related user categories to Hogar"
```

---

### Task 2: Verify Allocation Logic Handles New Categories

**Files:**
- Read (no changes needed): `webapp/src/actions/allocation.ts`

- [ ] **Step 1: Verify allocation.ts logic is compatible**

Read `webapp/src/actions/allocation.ts`. The current logic:
- `expense_type === "fixed"` → needs (50%)
- `expense_type === "variable"` or `null` → wants (30%)
- savings = income - needs - wants

New "Ahorro e Inversión" subcategories have `expense_type = NULL`. This means they'll be counted as "wants" if they have outflow transactions. This is **incorrect** — savings transfers should not count as "wants."

**Decision point:** If Ahorro e Inversión transactions represent transfers to savings accounts (not spending), they should be categorized as transfers, not outflows. If they're tracked as outflow spending (e.g., "I moved $500K to my CDT"), the allocation needs a third expense_type.

For now, the allocation formula `savings = income - needs - wants` already captures this correctly: money not spent on needs/wants IS savings. Transactions tagged under Ahorro e Inversión would typically be transfers between accounts (which don't appear in spending), not outflow transactions. No code change needed.

- [ ] **Step 2: Confirm with a manual test**

Open the app, navigate to the budget/plan page. Verify:
1. New parent categories appear in the CategoryZoneManager
2. Subcategories are visible under each parent
3. The 50/30/20 allocation bars still calculate correctly
4. Comer Fuera shows as a "wants" category (was "needs" as Alimentación)

---

## Phase 2: Tag System

### Task 3: Migration — Create Tag Tables

**Files:**
- Create: `supabase/migrations/[timestamp]_create_tag_system.sql`

- [ ] **Step 1: Create the migration**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
npx supabase migration new create_tag_system
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- Tag system: groups, tags, and junction tables for categories/destinatarios/transactions
-- Phase 2 of Category Kits & Tag System

BEGIN;

-- ============================================================
-- 1. tag_groups — organizes tags into named sections
-- ============================================================
CREATE TABLE public.tag_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  color         TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tag_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and system tag groups"
  ON public.tag_groups FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

CREATE POLICY "Users can insert own tag groups"
  ON public.tag_groups FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()) AND is_system = false);

CREATE POLICY "Users can update own tag groups"
  ON public.tag_groups FOR UPDATE
  USING (user_id = (SELECT auth.uid()) AND is_system = false);

CREATE POLICY "Users can delete own tag groups"
  ON public.tag_groups FOR DELETE
  USING (user_id = (SELECT auth.uid()) AND is_system = false);

-- ============================================================
-- 2. tags — individual tag values
-- ============================================================
CREATE TABLE public.tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id      UUID REFERENCES public.tag_groups(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  color         TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique slug per user (COALESCE handles NULL user_id for system tags)
CREATE UNIQUE INDEX tags_user_slug_unique
  ON public.tags (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), slug);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and system tags"
  ON public.tags FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

CREATE POLICY "Users can insert own tags"
  ON public.tags FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()) AND is_system = false);

CREATE POLICY "Users can update own tags"
  ON public.tags FOR UPDATE
  USING (user_id = (SELECT auth.uid()) AND is_system = false);

CREATE POLICY "Users can delete own tags"
  ON public.tags FOR DELETE
  USING (user_id = (SELECT auth.uid()) AND is_system = false);

-- ============================================================
-- 3. Junction tables
-- ============================================================

-- category_tags
CREATE TABLE public.category_tags (
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, tag_id)
);

ALTER TABLE public.category_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view category tags for accessible categories"
  ON public.category_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND (c.user_id = (SELECT auth.uid()) OR c.user_id IS NULL)
  ));

CREATE POLICY "Users can manage category tags for own categories"
  ON public.category_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND (c.user_id = (SELECT auth.uid()) OR c.user_id IS NULL)
  ));

-- destinatario_tags
CREATE TABLE public.destinatario_tags (
  destinatario_id UUID NOT NULL REFERENCES public.destinatarios(id) ON DELETE CASCADE,
  tag_id          UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (destinatario_id, tag_id)
);

ALTER TABLE public.destinatario_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view destinatario tags for own destinatarios"
  ON public.destinatario_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.destinatarios d
    WHERE d.id = destinatario_id AND d.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can manage destinatario tags for own destinatarios"
  ON public.destinatario_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.destinatarios d
    WHERE d.id = destinatario_id AND d.user_id = (SELECT auth.uid())
  ));

-- transaction_tags
CREATE TABLE public.transaction_tags (
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id         UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transaction tags for own transactions"
  ON public.transaction_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_id AND t.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can manage transaction tags for own transactions"
  ON public.transaction_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_id AND t.user_id = (SELECT auth.uid())
  ));

-- ============================================================
-- 4. Performance indexes
-- ============================================================
CREATE INDEX idx_tags_group_id ON public.tags(group_id);
CREATE INDEX idx_tags_user_id ON public.tags(user_id);
CREATE INDEX idx_tag_groups_user_id ON public.tag_groups(user_id);
CREATE INDEX idx_category_tags_tag_id ON public.category_tags(tag_id);
CREATE INDEX idx_destinatario_tags_tag_id ON public.destinatario_tags(tag_id);
CREATE INDEX idx_transaction_tags_tag_id ON public.transaction_tags(tag_id);

-- ============================================================
-- 5. Seed: Ritmo YNAB system tag group + 5 tags
-- ============================================================
INSERT INTO public.tag_groups (id, user_id, name, color, is_system, display_order)
VALUES ('d0000001-0001-4000-8000-000000000001', NULL, 'Ritmo YNAB', '#818cf8', true, 1);

INSERT INTO public.tags (id, user_id, group_id, name, slug, color, is_system, display_order)
VALUES
  ('d0000002-0001-4000-8000-000000000001', NULL, 'd0000001-0001-4000-8000-000000000001', 'Fijos',            'fijos',             '#ef4444', true, 1),
  ('d0000002-0001-4000-8000-000000000002', NULL, 'd0000001-0001-4000-8000-000000000001', 'Frecuentes',       'frecuentes',        '#3b82f6', true, 2),
  ('d0000002-0001-4000-8000-000000000003', NULL, 'd0000001-0001-4000-8000-000000000001', 'No Mensuales',     'no-mensuales',      '#a855f7', true, 3),
  ('d0000002-0001-4000-8000-000000000004', NULL, 'd0000001-0001-4000-8000-000000000001', 'Metas',            'metas',             '#22c55e', true, 4),
  ('d0000002-0001-4000-8000-000000000005', NULL, 'd0000001-0001-4000-8000-000000000001', 'Calidad de Vida',  'calidad-de-vida',   '#eab308', true, 5);

-- ============================================================
-- 6. Auto-assign Ritmo tags to system subcategories
-- ============================================================

-- Fijos
INSERT INTO public.category_tags (category_id, tag_id)
VALUES
  ('c0000001-0001-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000001'), -- Arriendo
  ('c0000001-0001-4000-8000-000000000002', 'd0000002-0001-4000-8000-000000000001'), -- Administración
  ('c0000001-0001-4000-8000-000000000004', 'd0000002-0001-4000-8000-000000000001'), -- Servicios públicos
  ('c0000001-0001-4000-8000-000000000005', 'd0000002-0001-4000-8000-000000000001'), -- Internet
  ('c0000001-0001-4000-8000-000000000006', 'd0000002-0001-4000-8000-000000000001'), -- Celular
  ('c0000001-0004-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000001'), -- EPS
  ('c0000001-0004-4000-8000-000000000002', 'd0000002-0001-4000-8000-000000000001'), -- Prepagada
  ('c0000001-0006-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000001'), -- Cuota crédito
  ('c0000001-0006-4000-8000-000000000002', 'd0000002-0001-4000-8000-000000000001'); -- Tarjeta crédito

-- Frecuentes
INSERT INTO public.category_tags (category_id, tag_id)
VALUES
  ('c0000001-0001-4000-8000-000000000003', 'd0000002-0001-4000-8000-000000000002'), -- Mercado
  ('c0000001-0003-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000002'), -- Transporte público
  ('c0000001-0003-4000-8000-000000000002', 'd0000002-0001-4000-8000-000000000002'), -- Gasolina
  ('c0000001-0002-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000002'), -- Restaurantes
  ('c0000001-0002-4000-8000-000000000002', 'd0000002-0001-4000-8000-000000000002'), -- Domicilios
  ('c0000001-0002-4000-8000-000000000003', 'd0000002-0001-4000-8000-000000000002'); -- Café/Snacks

-- No Mensuales
INSERT INTO public.category_tags (category_id, tag_id)
VALUES
  ('c0000001-0006-4000-8000-000000000006', 'd0000002-0001-4000-8000-000000000003'), -- SOAT
  ('c0000001-0006-4000-8000-000000000007', 'd0000002-0001-4000-8000-000000000003'), -- Tecnicomecánica
  ('c0000001-0006-4000-8000-000000000005', 'd0000002-0001-4000-8000-000000000003'), -- Predial
  ('c0000001-0009-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000003'), -- Seguro vida
  ('c0000001-0009-4000-8000-000000000002', 'd0000002-0001-4000-8000-000000000003'), -- Seguro vehículo
  ('c0000001-0009-4000-8000-000000000003', 'd0000002-0001-4000-8000-000000000003'), -- Seguro hogar
  ('c0000001-0009-4000-8000-000000000004', 'd0000002-0001-4000-8000-000000000003'), -- ARL
  ('c0000001-0006-4000-8000-000000000004', 'd0000002-0001-4000-8000-000000000003'), -- Impuestos
  ('c0000001-0011-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000003'), -- Matrícula
  ('c0000001-0006-4000-8000-000000000008', 'd0000002-0001-4000-8000-000000000003'); -- Vehicular

-- Metas
INSERT INTO public.category_tags (category_id, tag_id)
VALUES
  ('c0000001-0010-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000004'), -- Fondo emergencia
  ('c0000001-0010-4000-8000-000000000002', 'd0000002-0001-4000-8000-000000000004'), -- Cesantías
  ('c0000001-0010-4000-8000-000000000003', 'd0000002-0001-4000-8000-000000000004'), -- Pensión voluntaria
  ('c0000001-0010-4000-8000-000000000004', 'd0000002-0001-4000-8000-000000000004'), -- CDT/Inversiones
  ('c0000001-0010-4000-8000-000000000005', 'd0000002-0001-4000-8000-000000000004'); -- Ahorro programado

-- Calidad de Vida
INSERT INTO public.category_tags (category_id, tag_id)
VALUES
  ('c0000001-0012-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000005'), -- Streaming
  ('c0000001-0012-4000-8000-000000000002', 'd0000002-0001-4000-8000-000000000005'), -- Cine/Eventos
  ('c0000001-0012-4000-8000-000000000003', 'd0000002-0001-4000-8000-000000000005'), -- Hobbies
  ('c0000001-0005-4000-8000-000000000003', 'd0000002-0001-4000-8000-000000000005'), -- Gym/Deporte
  ('c0000001-0005-4000-8000-000000000001', 'd0000002-0001-4000-8000-000000000005'), -- Ropa
  ('c0000001-0005-4000-8000-000000000004', 'd0000002-0001-4000-8000-000000000005'), -- Regalos
  ('c0000001-0011-4000-8000-000000000003', 'd0000002-0001-4000-8000-000000000005'); -- Cursos/Capacitación

COMMIT;
```

- [ ] **Step 3: Push migration and regenerate types**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta
npx supabase db push
cd webapp
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts.tmp
head -1 src/types/database.ts.tmp
mv src/types/database.ts.tmp src/types/database.ts
```

- [ ] **Step 4: Build to verify types**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat(tags): create tag system tables with Ritmo YNAB seed

- tag_groups, tags, category_tags, destinatario_tags, transaction_tags
- RLS policies on all tables
- Seed Ritmo YNAB group with 5 system tags
- Auto-assign rhythm tags to system subcategories"
```

---

### Task 4: Tag Types and Server Actions

**Files:**
- Modify: `webapp/src/types/domain.ts` — add tag-related types
- Create: `webapp/src/actions/tags.ts` — CRUD operations
- Create: `webapp/src/lib/validators/tags.ts` — Zod schemas

- [ ] **Step 1: Add tag types to domain.ts**

Add after the existing category types in `webapp/src/types/domain.ts`:

```typescript
// Tags
export type TagGroup = Tables<"tag_groups">;
export type Tag = Tables<"tags">;
export type TagWithGroup = Tag & { group: TagGroup | null };
export type TagGroupWithTags = TagGroup & { tags: Tag[] };

export type TaggableEntity = "category" | "destinatario" | "transaction";
```

- [ ] **Step 2: Create tag validators**

Write `webapp/src/lib/validators/tags.ts`:

```typescript
import { z } from "zod";

export const tagGroupSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50),
  color: z.string().nullable().optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50),
  group_id: z.string().uuid().nullable().optional(),
});

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 3: Create tag server actions**

Write `webapp/src/actions/tags.ts`:

```typescript
"use server";

import { cache } from "react";
import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { tagGroupSchema, tagSchema, generateSlug } from "@/lib/validators/tags";
import type { ActionResult, TagGroupWithTags, Tag, TaggableEntity } from "@/types/domain";

// ── Queries ───────────────────────────────────────────────

export const getTagGroups = cache(async (): Promise<ActionResult<TagGroupWithTags[]>> => {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: groups, error: groupsError } = await supabase
    .from("tag_groups")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("display_order");

  if (groupsError) return { success: false, error: groupsError.message };

  const { data: tags, error: tagsError } = await supabase
    .from("tags")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("display_order");

  if (tagsError) return { success: false, error: tagsError.message };

  const groupsWithTags: TagGroupWithTags[] = groups.map((g) => ({
    ...g,
    tags: tags.filter((t) => t.group_id === g.id),
  }));

  return { success: true, data: groupsWithTags };
});

export const getTagsForEntity = cache(
  async (entityType: TaggableEntity, entityId: string): Promise<Tag[]> => {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return [];

    const tableName = `${entityType}_tags` as const;
    const idColumn = `${entityType}_id` as const;

    const { data } = await supabase
      .from(tableName)
      .select("tag_id")
      .eq(idColumn, entityId);

    if (!data || data.length === 0) return [];

    const tagIds = data.map((r) => r.tag_id);
    const { data: tags } = await supabase
      .from("tags")
      .select("*")
      .in("id", tagIds)
      .order("display_order");

    return tags ?? [];
  }
);

export const getAllTags = cache(async (): Promise<Tag[]> => {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data } = await supabase
    .from("tags")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("display_order");

  return data ?? [];
});

// ── Tag Group Mutations ───────────────────────────────────

export async function createTagGroup(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = tagGroupSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || null,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("tag_groups")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      is_system: false,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidateTag("tags");
  return { success: true, data: { id: data.id } };
}

export async function updateTagGroup(
  id: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = tagGroupSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || null,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("tag_groups")
    .update({ name: parsed.data.name, color: parsed.data.color ?? null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("tags");
  return { success: true, data: null };
}

export async function deleteTagGroup(id: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("tag_groups")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_system", false);

  if (error) return { success: false, error: error.message };

  revalidateTag("tags");
  return { success: true, data: null };
}

// ── Tag Mutations ─────────────────────────────────────────

export async function createTag(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = tagSchema.safeParse({
    name: formData.get("name"),
    group_id: formData.get("group_id") || null,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const slug = generateSlug(parsed.data.name);

  const { data, error } = await supabase
    .from("tags")
    .insert({
      user_id: user.id,
      group_id: parsed.data.group_id ?? null,
      name: parsed.data.name,
      slug,
      is_system: false,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya existe una etiqueta con ese nombre" };
    }
    return { success: false, error: error.message };
  }

  revalidateTag("tags");
  return { success: true, data: { id: data.id } };
}

export async function deleteTag(id: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_system", false);

  if (error) return { success: false, error: error.message };

  revalidateTag("tags");
  return { success: true, data: null };
}

// ── Entity Tag Mutations ──────────────────────────────────

export async function addTagToEntity(
  tagId: string,
  entityType: TaggableEntity,
  entityId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const tableName = `${entityType}_tags` as const;
  const idColumn = `${entityType}_id` as const;

  const { error } = await supabase
    .from(tableName)
    .insert({ [idColumn]: entityId, tag_id: tagId } as never);

  if (error) {
    if (error.code === "23505") return { success: true, data: null }; // already tagged
    return { success: false, error: error.message };
  }

  revalidateTag("tags");
  if (entityType === "transaction") revalidateTag("zeta");
  return { success: true, data: null };
}

export async function removeTagFromEntity(
  tagId: string,
  entityType: TaggableEntity,
  entityId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const tableName = `${entityType}_tags` as const;
  const idColumn = `${entityType}_id` as const;

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq(idColumn, entityId)
    .eq("tag_id", tagId);

  if (error) return { success: false, error: error.message };

  revalidateTag("tags");
  if (entityType === "transaction") revalidateTag("zeta");
  return { success: true, data: null };
}

export async function bulkTagTransactions(
  tagId: string,
  transactionIds: string[]
): Promise<ActionResult<{ tagged: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const rows = transactionIds.map((id) => ({ transaction_id: id, tag_id: tagId }));

  const { error } = await supabase
    .from("transaction_tags")
    .upsert(rows, { onConflict: "transaction_id,tag_id", ignoreDuplicates: true });

  if (error) return { success: false, error: error.message };

  revalidateTag("tags");
  revalidateTag("zeta");
  return { success: true, data: { tagged: transactionIds.length } };
}
```

- [ ] **Step 4: Build to verify**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/types/domain.ts webapp/src/actions/tags.ts webapp/src/lib/validators/tags.ts
git commit -m "feat(tags): add tag types, validators, and server actions

- TagGroup, Tag, TagGroupWithTags types in domain.ts
- Zod validators with slug normalization
- Full CRUD: groups, tags, entity tagging, bulk tag"
```

---

### Task 5: TagPicker Shared Component

**Files:**
- Create: `webapp/src/components/tags/tag-picker.tsx`
- Create: `webapp/src/components/tags/tag-chip.tsx`

- [ ] **Step 1: Create TagChip component**

Write `webapp/src/components/tags/tag-chip.tsx`:

```tsx
"use client";

import { X } from "lucide-react";
import type { Tag } from "@/types/domain";

interface TagChipProps {
  tag: Tag;
  groupColor?: string | null;
  onRemove?: () => void;
  size?: "sm" | "md";
}

export function TagChip({ tag, groupColor, onRemove, size = "md" }: TagChipProps) {
  const color = tag.color ?? groupColor ?? "rgba(255,255,255,0.15)";
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${sizeClasses}`}
      style={{
        borderColor: color,
        backgroundColor: `${color}15`,
      }}
    >
      <span style={{ color }}>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
        >
          <X className="size-3" style={{ color }} />
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Create TagPicker component**

Write `webapp/src/components/tags/tag-picker.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { createTag, addTagToEntity, removeTagFromEntity } from "@/actions/tags";
import { generateSlug } from "@/lib/validators/tags";
import { TagChip } from "./tag-chip";
import type { Tag, TagGroupWithTags, TaggableEntity } from "@/types/domain";

interface TagPickerProps {
  entityType: TaggableEntity;
  entityId: string;
  currentTags: Tag[];
  allTagGroups: TagGroupWithTags[];
  onTagsChange?: (tags: Tag[]) => void;
}

export function TagPicker({
  entityType,
  entityId,
  currentTags,
  allTagGroups,
  onTagsChange,
}: TagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<Tag[]>(currentTags);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allTags = allTagGroups.flatMap((g) =>
    g.tags.map((t) => ({ ...t, groupColor: g.color, groupName: g.name }))
  );

  const currentTagIds = new Set(tags.map((t) => t.id));
  const filtered = allTags.filter(
    (t) =>
      !currentTagIds.has(t.id) &&
      (t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.includes(generateSlug(search)))
  );

  // Group filtered tags by group name
  const grouped = new Map<string, typeof filtered>();
  for (const t of filtered) {
    const key = t.groupName ?? "Sin grupo";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  const canCreate =
    search.length > 0 && !allTags.some((t) => t.slug === generateSlug(search));

  function handleAdd(tag: Tag) {
    const updated = [...tags, tag];
    setTags(updated);
    onTagsChange?.(updated);
    setSearch("");
    startTransition(async () => {
      await addTagToEntity(tag.id, entityType, entityId);
    });
  }

  function handleRemove(tagId: string) {
    const updated = tags.filter((t) => t.id !== tagId);
    setTags(updated);
    onTagsChange?.(updated);
    startTransition(async () => {
      await removeTagFromEntity(tagId, entityType, entityId);
    });
  }

  async function handleCreate() {
    const fd = new FormData();
    fd.set("name", search.trim());
    const result = await createTag(fd);
    if (result.success) {
      const newTag: Tag = {
        id: result.data.id,
        user_id: null,
        group_id: null,
        name: search.trim(),
        slug: generateSlug(search),
        color: null,
        is_system: false,
        display_order: 0,
        created_at: new Date().toISOString(),
      };
      handleAdd(newTag);
    }
  }

  const tagGroupMap = new Map(allTagGroups.map((g) => [g.id, g]));

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {/* Applied tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            groupColor={tag.group_id ? tagGroupMap.get(tag.group_id)?.color : null}
            onRemove={() => handleRemove(tag.id)}
            size="sm"
          />
        ))}
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="rounded-full border border-dashed border-white/20 px-3 py-0.5 text-xs text-muted-foreground hover:bg-white/5"
        >
          + Agregar
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="rounded-lg border border-white/15 bg-z-surface-2 shadow-lg">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Buscar o crear etiqueta..."
              className="w-full rounded-md border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={isPending}
            />
          </div>

          <div className="max-h-48 overflow-y-auto border-t border-white/10">
            {[...grouped.entries()].map(([groupName, groupTags]) => (
              <div key={groupName}>
                <div className="px-3 py-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  {groupName}
                </div>
                {groupTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleAdd(tag)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-white/5"
                    disabled={isPending}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ))}

            {canCreate && (
              <div className="border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-white/5"
                  disabled={isPending}
                >
                  Crear: &quot;<span className="text-indigo-400">{search.trim()}</span>&quot; ↵
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build to verify**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/tags/
git commit -m "feat(tags): add TagPicker and TagChip shared components

- TagChip: colored chip with optional remove button
- TagPicker: autocomplete with group headers, inline create, slug normalization"
```

---

### Task 6: Add Tag Management Page

**Files:**
- Create: `webapp/src/app/(dashboard)/etiquetas/page.tsx`
- Modify: `webapp/src/app/(dashboard)/gestionar/page.tsx` — add Etiquetas link

- [ ] **Step 1: Create the etiquetas page**

Write `webapp/src/app/(dashboard)/etiquetas/page.tsx`:

```tsx
import { connection } from "next/server";
import { getTagGroups } from "@/actions/tags";
import { TagManager } from "@/components/tags/tag-manager";

export default async function EtiquetasPage() {
  await connection();
  const result = await getTagGroups();

  if (!result.success) {
    return <p className="p-6 text-destructive">{result.error}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Etiquetas</h1>
        <p className="text-sm text-muted-foreground">
          Organiza etiquetas en grupos para anotar transacciones, destinatarios y categorías.
        </p>
      </div>
      <TagManager tagGroups={result.data} />
    </div>
  );
}
```

- [ ] **Step 2: Create TagManager component**

Write `webapp/src/components/tags/tag-manager.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createTagGroup, deleteTagGroup, createTag, deleteTag } from "@/actions/tags";
import { TagChip } from "./tag-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TagGroupWithTags } from "@/types/domain";

interface TagManagerProps {
  tagGroups: TagGroupWithTags[];
}

export function TagManager({ tagGroups }: TagManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newGroupName, setNewGroupName] = useState("");
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});

  // Separate system groups, user groups, and ungrouped tags
  const systemGroups = tagGroups.filter((g) => g.is_system);
  const userGroups = tagGroups.filter((g) => !g.is_system);

  function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const fd = new FormData();
    fd.set("name", newGroupName.trim());
    startTransition(async () => {
      await createTagGroup(fd);
      setNewGroupName("");
      router.refresh();
    });
  }

  function handleDeleteGroup(id: string) {
    startTransition(async () => {
      await deleteTagGroup(id);
      router.refresh();
    });
  }

  function handleCreateTag(groupId: string | null) {
    const key = groupId ?? "__ungrouped";
    const name = newTagInputs[key]?.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    if (groupId) fd.set("group_id", groupId);
    startTransition(async () => {
      await createTag(fd);
      setNewTagInputs((prev) => ({ ...prev, [key]: "" }));
      router.refresh();
    });
  }

  function handleDeleteTag(id: string) {
    startTransition(async () => {
      await deleteTag(id);
      router.refresh();
    });
  }

  function renderGroup(group: TagGroupWithTags, editable: boolean) {
    const key = group.id;
    return (
      <div key={group.id} className="rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{group.name}</h3>
            {group.is_system && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                sistema
              </span>
            )}
          </div>
          {editable && (
            <button
              type="button"
              onClick={() => handleDeleteGroup(group.id)}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              disabled={isPending}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {group.tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              groupColor={group.color}
              onRemove={editable ? () => handleDeleteTag(tag.id) : undefined}
              size="sm"
            />
          ))}
          {editable && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateTag(group.id);
              }}
              className="flex items-center"
            >
              <Input
                value={newTagInputs[key] ?? ""}
                onChange={(e) => setNewTagInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="+ agregar"
                className="h-7 w-28 border-dashed text-xs"
                disabled={isPending}
              />
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* System groups */}
      {systemGroups.map((g) => renderGroup(g, false))}

      {/* User groups */}
      {userGroups.map((g) => renderGroup(g, true))}

      {/* New group form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreateGroup();
        }}
        className="flex gap-2"
      >
        <Input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Nuevo grupo de etiquetas..."
          className="flex-1"
          disabled={isPending}
        />
        <Button type="submit" variant="outline" size="sm" disabled={isPending || !newGroupName.trim()}>
          <Plus className="mr-1 size-4" />
          Crear grupo
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Add Etiquetas link to Gestionar page**

In `webapp/src/app/(dashboard)/gestionar/page.tsx`, add to the `organizationActions` array after the Destinatarios entry:

```typescript
  {
    href: "/etiquetas",
    icon: Tags,
    label: "Etiquetas",
    description: "Crea y organiza etiquetas para anotar transacciones por viaje, persona o evento.",
  },
```

Note: `Tags` icon is already imported in the file (used by Categorizar).

- [ ] **Step 4: Build to verify**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/(dashboard)/etiquetas/ webapp/src/components/tags/tag-manager.tsx webapp/src/app/(dashboard)/gestionar/page.tsx
git commit -m "feat(tags): add Etiquetas management page

- Tag group CRUD with inline tag creation
- System groups shown read-only (Ritmo YNAB)
- Linked from Gestionar page"
```

---

### Task 7: Wire TagPicker into Transaction Edit

**Files:**
- Modify: The transaction edit form/modal (find exact component via codebase search)

- [ ] **Step 1: Find the transaction edit component**

Search for the transaction edit form:

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
grep -rl "transaction.*edit\|edit.*transaction\|TransactionForm\|transaction-form" src/components/ --include="*.tsx" | head -10
```

- [ ] **Step 2: Add TagPicker to transaction edit form**

In the transaction edit form component, add after the category selector:

```tsx
import { TagPicker } from "@/components/tags/tag-picker";
import { getTagGroups, getTagsForEntity } from "@/actions/tags";
```

And in the JSX, add after the category field:

```tsx
<div className="space-y-1">
  <label className="text-sm text-muted-foreground">Etiquetas</label>
  <TagPicker
    entityType="transaction"
    entityId={transaction.id}
    currentTags={transactionTags}
    allTagGroups={tagGroups}
  />
</div>
```

The parent page/component needs to fetch and pass `tagGroups` and `transactionTags` as props. Add to the data fetching:

```typescript
const [tagGroupsResult, transactionTags] = await Promise.all([
  getTagGroups(),
  getTagsForEntity("transaction", transactionId),
]);
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/ webapp/src/app/
git commit -m "feat(tags): wire TagPicker into transaction edit form"
```

---

### Task 8: Add Tag Filter to Transaction List

**Files:**
- Modify: Transaction list page/component (find exact path via search)

- [ ] **Step 1: Find the transaction list component**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
grep -rl "TransactionList\|transaction-list\|transaction.*filter" src/ --include="*.tsx" | head -10
```

- [ ] **Step 2: Add tag filter chip**

In the transaction list filter bar, add a tag filter alongside existing filters. The filter works by:

1. Fetching tag groups for the dropdown
2. When a tag is selected, querying `transaction_tags` to get matching transaction IDs
3. Adding those IDs as an `IN` filter on the transaction query

In the transaction list action (likely in `webapp/src/actions/transactions.ts`), add an optional `tagId` parameter:

```typescript
// Add to the getTransactions function parameters
tagId?: string

// Add to the query if tagId is provided
if (tagId) {
  const { data: taggedIds } = await supabase
    .from("transaction_tags")
    .select("transaction_id")
    .eq("tag_id", tagId);

  if (taggedIds && taggedIds.length > 0) {
    query = query.in("id", taggedIds.map((r) => r.transaction_id));
  } else {
    // No transactions with this tag — return empty
    return { success: true, data: [] };
  }
}
```

- [ ] **Step 3: Add tag filter UI**

Add a tag filter chip to the filter bar. When clicked, opens a dropdown of all tags (grouped). Selection adds the chip and passes `tagId` to the query.

- [ ] **Step 4: Build and verify**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/ webapp/src/components/ webapp/src/app/
git commit -m "feat(tags): add tag filter to transaction list

- Filter transactions by tag via transaction_tags join
- Tag filter chip in filter bar alongside date/account/category"
```

---

### Task 9: Budget Rhythm View Toggle

**Files:**
- Modify: `webapp/src/app/(dashboard)/plan/page.tsx` or budget page — add toggle
- Create: `webapp/src/components/budget/rhythm-view.tsx`
- Modify: `webapp/src/actions/categories.ts` — add rhythm-grouped query

- [ ] **Step 1: Add rhythm-grouped category query**

Add to `webapp/src/actions/categories.ts`:

```typescript
export async function getCategoriesByRhythm(
  month?: string,
  currency: CurrencyCode = "COP"
): Promise<ActionResult<{ rhythmTag: string; color: string; categories: CategoryBudgetData[] }[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Get regular budget data
  const budgetResult = await getCategoriesWithBudgetData(month, currency);
  if (!budgetResult.success) return budgetResult as ActionResult<never>;

  // Get all category_tags for the Ritmo YNAB group
  const { data: ritmoTags } = await supabase
    .from("tags")
    .select("id, name, color, group_id")
    .eq("group_id", "d0000001-0001-4000-8000-000000000001"); // Ritmo YNAB group

  if (!ritmoTags || ritmoTags.length === 0) {
    return { success: true, data: [] };
  }

  const { data: categoryTagLinks } = await supabase
    .from("category_tags")
    .select("category_id, tag_id")
    .in("tag_id", ritmoTags.map((t) => t.id));

  // Build a map: categoryId → ritmo tag
  const categoryRitmoMap = new Map<string, { name: string; color: string }>();
  for (const link of categoryTagLinks ?? []) {
    const tag = ritmoTags.find((t) => t.id === link.tag_id);
    if (tag) {
      categoryRitmoMap.set(link.category_id, { name: tag.name, color: tag.color ?? "#818cf8" });
    }
  }

  // Flatten all subcategories from budget data
  const allSubcategories = budgetResult.data.flatMap((parent) => parent.children ?? []);

  // Group subcategories by rhythm tag
  const rhythmGroups = new Map<string, { color: string; categories: CategoryBudgetData[] }>();
  for (const sub of allSubcategories) {
    const rhythm = categoryRitmoMap.get(sub.id);
    if (rhythm) {
      if (!rhythmGroups.has(rhythm.name)) {
        rhythmGroups.set(rhythm.name, { color: rhythm.color, categories: [] });
      }
      rhythmGroups.get(rhythm.name)!.categories.push(sub);
    }
  }

  // Sort by the Ritmo tag display_order
  const tagOrder = ritmoTags.map((t) => t.name);
  const result = tagOrder
    .filter((name) => rhythmGroups.has(name))
    .map((name) => ({
      rhythmTag: name,
      color: rhythmGroups.get(name)!.color,
      categories: rhythmGroups.get(name)!.categories,
    }));

  return { success: true, data: result };
}
```

- [ ] **Step 2: Create RhythmView component**

Write `webapp/src/components/budget/rhythm-view.tsx`:

```tsx
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface RhythmViewProps {
  groups: { rhythmTag: string; color: string; categories: CategoryBudgetData[] }[];
  currency: CurrencyCode;
}

export function RhythmView({ groups, currency }: RhythmViewProps) {
  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const totalSpent = group.categories.reduce((sum, c) => sum + (c.spent ?? 0), 0);
        const totalBudget = group.categories.reduce((sum, c) => sum + (c.budget ?? 0), 0);

        return (
          <div key={group.rhythmTag} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: group.color }}>
                {group.rhythmTag}
              </h3>
              <span className="text-sm text-muted-foreground">
                {formatCurrency(totalSpent, currency)} / {formatCurrency(totalBudget, currency)}
              </span>
            </div>

            <div className="space-y-1">
              {group.categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-white/3">
                  <span className="text-sm">{cat.name_es ?? cat.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(cat.spent ?? 0, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Add toggle to budget/plan page**

Find the budget page and add a pill toggle:

```tsx
const [viewMode, setViewMode] = useState<"domain" | "rhythm">("domain");

// In the header area:
<div className="flex gap-1 rounded-full bg-white/5 p-0.5">
  <button
    onClick={() => setViewMode("domain")}
    className={`rounded-full px-4 py-1 text-sm transition-colors ${
      viewMode === "domain" ? "bg-indigo-500/20 font-semibold text-indigo-300" : "text-muted-foreground"
    }`}
  >
    Dominio
  </button>
  <button
    onClick={() => setViewMode("rhythm")}
    className={`rounded-full px-4 py-1 text-sm transition-colors ${
      viewMode === "rhythm" ? "bg-indigo-500/20 font-semibold text-indigo-300" : "text-muted-foreground"
    }`}
  >
    Ritmo
  </button>
</div>

// In the body, conditionally render:
{viewMode === "domain" ? (
  <ExistingBudgetView ... />
) : (
  <RhythmView groups={rhythmData} currency={currency} />
)}
```

- [ ] **Step 4: Build and verify**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/categories.ts webapp/src/components/budget/rhythm-view.tsx webapp/src/app/
git commit -m "feat(tags): add budget Ritmo view toggle (Domain ⇄ Rhythm)

- getCategoriesByRhythm action groups subcategories by Ritmo YNAB tag
- RhythmView component renders grouped spending
- Pill toggle in budget page header"
```

---

### Task 10: Wire TagPicker into Destinatario Form

**Files:**
- Modify: Destinatario edit form (find exact component)

- [ ] **Step 1: Find the destinatario form**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
grep -rl "destinatario.*form\|DestinatarioForm\|destinatario-form" src/components/ --include="*.tsx" | head -5
```

- [ ] **Step 2: Add TagPicker to destinatario form**

Same pattern as Task 7 — add TagPicker after the rules section:

```tsx
<div className="space-y-1">
  <label className="text-sm text-muted-foreground">Etiquetas</label>
  <TagPicker
    entityType="destinatario"
    entityId={destinatario.id}
    currentTags={destinatarioTags}
    allTagGroups={tagGroups}
  />
</div>
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/ webapp/src/app/
git commit -m "feat(tags): wire TagPicker into destinatario form"
```

---

### Task 11: Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
pnpm install
pnpm build
```

Expected: Clean build, zero errors.

- [ ] **Step 2: Manual smoke test**

Open the app and verify:
1. **Categories page:** 13 parent groups visible with subcategories
2. **Gestionar → Etiquetas:** Ritmo YNAB group visible with 5 tags
3. **Create a user tag group** (e.g., "Viaje test") and add a tag
4. **Transaction edit:** TagPicker appears, can add/remove tags
5. **Transaction list:** Tag filter works
6. **Budget page:** Dominio/Ritmo toggle switches views correctly
7. **50/30/20 allocation:** Still calculates correctly with new categories

- [ ] **Step 3: Commit any final fixes if needed**
