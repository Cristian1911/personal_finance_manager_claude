# UI/UX Redesign - Week 1 Tracking Spec (Base de Verdad)

## Objetivo de Semana 1
Tener una base de medición confiable para mapear uso real antes de rediseñar.

Se entrega:
- Taxonomía de eventos única para web y mobile
- Esquema de datos para eventos de producto
- Definición de funnels y KPIs base
- Plan de instrumentación por flujo crítico
- Reglas de calidad de datos

---

## KPI Base (14 días)
Estos KPIs se deben medir en una ventana fija de 14 días antes de cambios grandes de UX.

1. Activation D7
- Definición: % de usuarios nuevos que completan primer flujo de valor en <= 7 días.
- Flujo de valor: cuenta creada + onboarding + primer movimiento importado o creado.

2. Time to First Value (TTFV)
- Definición: tiempo entre `auth_signup_completed` y `first_financial_insight_rendered`.
- Unidad: minutos (p50, p75, p90).

3. Categorization Latency
- Definición: tiempo de `uncategorized_item_seen` a `transaction_categorized`.
- Unidad: horas (p50/p90).

4. Budget Adoption
- Definición: % de usuarios activos con al menos un presupuesto mensual activo.

5. Weekly Return
- Definición: % de usuarios activos que regresan a `dashboard_viewed` en semana siguiente.

---

## Taxonomía de Eventos

Convención:
- snake_case
- prefijo por dominio de producto
- evitar verbos ambiguos (`clicked_button` prohibido)

### Dominio auth/onboarding
- `auth_signup_completed`
- `auth_login_completed`
- `onboarding_started`
- `onboarding_step_completed`
- `onboarding_completed`

### Dominio import
- `import_flow_opened`
- `import_file_selected`
- `import_parse_requested`
- `import_parse_succeeded`
- `import_parse_failed`
- `import_account_mapping_completed`
- `import_confirm_submitted`
- `import_completed`

### Dominio transactions/categorization
- `transactions_page_viewed`
- `uncategorized_item_seen`
- `category_suggestion_shown`
- `category_picker_opened`
- `category_selected`
- `transaction_categorized`
- `bulk_categorize_applied`

### Dominio budget/debt
- `budget_page_viewed`
- `budget_created`
- `budget_updated`
- `debt_page_viewed`
- `debt_simulation_run`
- `debt_strategy_selected`

### Dominio dashboard/value
- `dashboard_viewed`
- `priority_card_viewed`
- `priority_card_clicked`
- `first_financial_insight_rendered`

---

## Propiedades Obligatorias por Evento

Campos base (todos los eventos):
- `event_name` (text)
- `event_time` (timestamptz)
- `user_id` (uuid)
- `session_id` (text)
- `platform` (`web` | `mobile`)
- `entry_point` (`direct` | `sidebar` | `cta` | `redirect` | `notification`)
- `flow` (`onboarding` | `import` | `categorize` | `budget` | `debt` | `dashboard`)
- `step` (text)
- `success` (bool)
- `duration_ms` (int, nullable)
- `error_code` (text, nullable)
- `metadata` (jsonb)

Propiedades específicas clave:
- Import:
  - `file_source` (`pdf_upload` | `camera_scan`)
  - `parser_bank` (text)
  - `statements_count` (int)
  - `transactions_detected` (int)
- Categorización:
  - `category_source` (`suggestion` | `manual_picker` | `bulk` | `merchant_batch`)
  - `pending_uncategorized` (int)
- Dashboard:
  - `alerts_visible` (int)
  - `priorities_visible` (int)

---

## Funnels de Semana 1

### F1 - Activación inicial
1. `auth_signup_completed`
2. `onboarding_started`
3. `onboarding_completed`
4. `import_flow_opened` OR `transactions_page_viewed`
5. `import_completed` OR `transaction_categorized`
6. `first_financial_insight_rendered`

### F2 - Importación completa
1. `import_flow_opened`
2. `import_file_selected`
3. `import_parse_requested`
4. `import_parse_succeeded`
5. `import_account_mapping_completed`
6. `import_confirm_submitted`
7. `import_completed`

### F3 - Categorización operativa
1. `uncategorized_item_seen`
2. `category_picker_opened` OR `category_suggestion_shown`
3. `category_selected`
4. `transaction_categorized`

### F4 - Presupuesto
1. `budget_page_viewed`
2. `budget_created` OR `budget_updated`

### F5 - Retorno semanal
1. `dashboard_viewed` (semana N)
2. `dashboard_viewed` (semana N+1)

---

## Plan de Instrumentación (Semana 1)

### Backend / DB
- Crear tabla `product_events` (Supabase).
- Habilitar RLS para lectura/escritura de eventos propios.
- Indexar por `user_id`, `event_name`, `event_time`, `flow`.

### Web (archivos objetivo)
- `webapp/src/app/onboarding/page.tsx`
  - `onboarding_started`, `onboarding_step_completed`, `onboarding_completed`
- `webapp/src/components/import/*`
  - eventos de F2 completos
- `webapp/src/components/categorize/*`
  - eventos de F3
- `webapp/src/app/(dashboard)/dashboard/page.tsx`
  - `dashboard_viewed`, `priority_card_*`, `first_financial_insight_rendered`
- `webapp/src/actions/import-transactions.ts`
  - `import_completed` (source of truth server-side)

### Mobile (fase 1)
- `mobile/app/*`
  - `dashboard_viewed`, `transactions_page_viewed`

---

## Calidad de Datos (obligatorio)

1. Sin duplicados en eventos de finalización
- dedupe key: `user_id + event_name + flow + step + date_trunc('minute', event_time)`

2. Ningún evento crítico sin `flow` ni `entry_point`
- se rechaza o marca como inválido.

3. Validaciones de tipado
- `duration_ms >= 0`
- `success=false` requiere `error_code`

4. Monitoreo diario de cobertura
- ratio de usuarios activos con al menos 1 evento crítico > 95%

---

## Dashboard de Métricas (SQL inicial)

### Activation D7
```sql
with signups as (
  select user_id, min(event_time) as signup_time
  from product_events
  where event_name = 'auth_signup_completed'
  group by user_id
), activated as (
  select distinct e.user_id
  from product_events e
  join signups s on s.user_id = e.user_id
  where e.event_name in ('import_completed', 'transaction_categorized', 'first_financial_insight_rendered')
    and e.event_time <= s.signup_time + interval '7 day'
)
select
  (select count(*) from activated)::numeric
  / nullif((select count(*) from signups), 0) as activation_d7;
```

### TTFV (p50)
```sql
with base as (
  select
    s.user_id,
    min(s.event_time) as signup_time,
    min(v.event_time) as value_time
  from product_events s
  join product_events v on v.user_id = s.user_id
  where s.event_name = 'auth_signup_completed'
    and v.event_name = 'first_financial_insight_rendered'
  group by s.user_id
)
select percentile_cont(0.5)
within group (order by extract(epoch from (value_time - signup_time))/60.0) as ttfv_min_p50
from base
where value_time is not null;
```

---

## Definición de Hecho para iniciar Semana 2
Semana 1 termina cuando:
- tabla de eventos activa en producción
- eventos de funnels F1/F2/F3 enviados con propiedades mínimas
- 7 días de datos limpios acumulados
- dashboard base con KPIs visibles
