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
