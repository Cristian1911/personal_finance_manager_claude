-- Zeta v2's 25 system categories (packages/shared/src/engine/categories.ts), for the v2
-- Supabase project ONLY. Kept out of supabase/migrations on purpose: a migration would also
-- add them to the web app's production categories. Idempotent; run with
--   psql "$SUPABASE_DEV_DB_URL" -f supabase/v2/seed-categories.sql
INSERT INTO public.categories (id, name, name_es, slug, icon, color, direction, display_order, is_system, parent_id, user_id)
VALUES
  ('c2000000-0000-4000-8000-000000000001', 'Mercado', 'Mercado', 'v2-mercado', 'circle', '#8C7F63', 'OUTFLOW', 1, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000002', 'Restaurantes y café', 'Restaurantes y café', 'v2-restaurantes-y-cafe', 'circle', '#8C7F63', 'OUTFLOW', 2, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000003', 'Domicilios', 'Domicilios', 'v2-domicilios', 'circle', '#8C7F63', 'OUTFLOW', 3, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000004', 'Apps y taxis', 'Apps y taxis', 'v2-apps-y-taxis', 'circle', '#8C7F63', 'OUTFLOW', 4, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000005', 'Transporte público', 'Transporte público', 'v2-transporte-publico', 'circle', '#8C7F63', 'OUTFLOW', 5, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000006', 'Carro y moto', 'Carro y moto', 'v2-carro-y-moto', 'circle', '#8C7F63', 'OUTFLOW', 6, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000007', 'Vivienda', 'Vivienda', 'v2-vivienda', 'circle', '#8C7F63', 'OUTFLOW', 7, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000008', 'Servicios', 'Servicios', 'v2-servicios', 'circle', '#8C7F63', 'OUTFLOW', 8, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000009', 'Casa y mantenimiento', 'Casa y mantenimiento', 'v2-casa-y-mantenimiento', 'circle', '#8C7F63', 'OUTFLOW', 9, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000010', 'Salud', 'Salud', 'v2-salud', 'circle', '#8C7F63', 'OUTFLOW', 10, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000011', 'Mascotas', 'Mascotas', 'v2-mascotas', 'circle', '#8C7F63', 'OUTFLOW', 11, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000012', 'Suscripciones', 'Suscripciones', 'v2-suscripciones', 'circle', '#8C7F63', 'OUTFLOW', 12, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000013', 'Compras', 'Compras', 'v2-compras', 'circle', '#8C7F63', 'OUTFLOW', 13, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000014', 'Entretenimiento y hobbies', 'Entretenimiento y hobbies', 'v2-entretenimiento-y-hobbies', 'circle', '#8C7F63', 'OUTFLOW', 14, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000015', 'Viajes', 'Viajes', 'v2-viajes', 'circle', '#8C7F63', 'OUTFLOW', 15, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000016', 'Regalos', 'Regalos', 'v2-regalos', 'circle', '#8C7F63', 'OUTFLOW', 16, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000017', 'Cuidado personal y deporte', 'Cuidado personal y deporte', 'v2-cuidado-personal-y-deporte', 'circle', '#8C7F63', 'OUTFLOW', 17, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000018', 'Educación', 'Educación', 'v2-educacion', 'circle', '#8C7F63', 'OUTFLOW', 18, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000019', 'Pago de tarjeta o crédito', 'Pago de tarjeta o crédito', 'v2-pago-de-tarjeta-o-credito', 'circle', '#8C7F63', 'OUTFLOW', 19, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000020', 'Intereses, comisiones e impuestos', 'Intereses, comisiones e impuestos', 'v2-intereses-comisiones-e-impuestos', 'circle', '#8C7F63', 'OUTFLOW', 20, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000021', 'Préstamos entre personas', 'Préstamos entre personas', 'v2-prestamos-entre-personas', 'circle', '#8C7F63', 'OUTFLOW', 21, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000022', 'Ahorro e inversión', 'Ahorro e inversión', 'v2-ahorro-e-inversion', 'circle', '#8C7F63', 'OUTFLOW', 22, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000023', 'Salario', 'Salario', 'v2-salario', 'circle', '#8C7F63', 'INFLOW', 23, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000024', 'Otros ingresos', 'Otros ingresos', 'v2-otros-ingresos', 'circle', '#8C7F63', 'INFLOW', 24, true, NULL, NULL),
  ('c2000000-0000-4000-8000-000000000025', 'Efectivo y otros', 'Efectivo y otros', 'v2-efectivo-y-otros', 'circle', '#8C7F63', 'OUTFLOW', 25, true, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
