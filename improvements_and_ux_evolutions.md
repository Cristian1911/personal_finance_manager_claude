# Mejoras y Evolución UX — Personal Finance Manager

> Escrito: febrero 2026
> Basado en: auditoría del estado actual de la app + investigación de tendencias fintech 2026 (Reddit, X, blogs técnicos)

---

## Contexto: Hacia Dónde Va el Fintech en 2026

La tendencia dominante en fintech es el **paso de apps reactivas a apps proactivas con agentes IA**. El patrón anterior era: el usuario abre la app, navega menús, lee datos. El patrón 2026 es: la app detecta algo relevante, notifica al usuario, y ya tomó o propone una acción.

Nuestra app hoy es excelente en el núcleo (importación PDF, categorización, dashboard, deudas), pero es completamente **reactiva**. Estas mejoras apuntan a ese salto.

---

## Parte 1: Gaps de UX y Funcionalidad

### 1.1 Flujo de Onboarding (Alta prioridad)

**Problema actual**: Un usuario nuevo llega al dashboard y ve un estado vacío sin orientación. La importación de PDF — el killer feature — está enterrada en `/import`.

**Qué falta**:
- Wizard de bienvenida: "Crea tu primera cuenta → Importa tu primer extracto"
- Checklist de configuración visible en el dashboard hasta completarlo
- Tooltip o callout en la primera visita que explique qué puede hacer la app

**Referencia de patrón**: Notion's empty state CTAs, Copilot's onboarding checklist.

---

### 1.2 Alertas y Notificaciones Proactivas (Alta prioridad)

**Problema actual**: La app no le habla al usuario. El usuario tiene que ir a buscar la información.

**Qué falta**:
- Centro de notificaciones in-app (campana en el topbar con historial)
- Alertas de reglas predefinidas:
  - "Gastaste 40% más en Restaurantes que el mes pasado"
  - "Tu pago de la tarjeta Visa vence en 3 días" (ya hay reminders en dashboard, pero no hay alerta activa)
  - "Tu tasa de ahorro bajó al 5% — el mes pasado era 22%"
  - "Detectamos una transacción inusual de $850,000 COP en [categoría]"
- Email digest semanal (opcional, opt-in): resumen de la semana

**Implementación sin IA**: Todo esto puede ser rule-based. No requiere LLM. Requiere un job periódico (Supabase Edge Function con cron) que evalúe reglas y escriba en una tabla `notifications`.

**Modelo de datos sugerido**:
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  type text, -- 'payment_due', 'spending_spike', 'savings_drop', etc.
  title text,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);
```

---

### 1.3 Búsqueda de Transacciones (Media prioridad)

**Problema actual**: Filtrar transacciones solo permite: mes, cuenta, categoría, dirección. Sin búsqueda de texto.

**Qué falta**:
- Input de búsqueda full-text por descripción/comercio
- Filtro por rango de fechas arbitrario (no solo por mes)
- Filtro por monto (ej. transacciones > $100,000 COP)
- Vista de resultados paginados con "X transacciones encontradas"

**Implementación**: `ilike '%query%'` en Supabase sobre `description`, `merchant_name`, `raw_description`. Agregar índice GIN para performance si escala.

---

### 1.4 Presupuestos por Categoría (Alta prioridad)

**Problema actual**: Hay un esqueleto en `InteractiveMetricCard` para presupuesto pero no está implementado. El gráfico de categorías muestra actuals sin comparar contra un target.

**Qué falta**:
- Tabla `budgets` en la DB: `user_id`, `category_id`, `amount`, `period` (monthly)
- UI para crear/editar presupuesto por categoría desde `/categories`
- En el gráfico de categorías del dashboard: barra de progreso actual vs target
- Alerta cuando se llega al 80% y al 100% del presupuesto mensual
- Card de "Presupuestos" en el dashboard mostrando el estado de cada uno

**Valor**: Esta es la característica que más convierte usuarios free → paid en herramientas PFM (YNAB, Copilot). El usuario siente control real.

---

### 1.5 Evolución del Patrimonio Neto (Media prioridad)

**Problema actual**: Solo hay historial de balance por cuenta (desde snapshots). No hay un gráfico de "mi patrimonio neto total a lo largo del tiempo".

**Qué falta**:
- Snapshot periódico del patrimonio neto total (suma de todas las cuentas en ese momento)
- Gráfico de área en el dashboard mostrando la evolución mensual del net worth
- Podría derivarse de los `statement_snapshots` existentes + snapshots manuales periódicos

**Implementación**: Supabase Edge Function con cron que tome un snapshot de net worth cada 1ro del mes.

---

### 1.6 Proyección de Flujo de Caja (Media prioridad)

**Problema actual**: El dashboard muestra el pasado (gastos del mes, trend de 6 meses). No dice nada sobre el futuro.

**Qué falta**:
- "Próximos 30 días" calculado desde transacciones recurrentes activas
- Vista de calendario con ingresos/gastos esperados por día
- Alerta si el saldo proyectado cae a negativo en algún día del mes
- Sin IA: pura aritmética con las recurrentes existentes

---

### 1.7 Análisis por Comercio (Baja prioridad)

**Problema actual**: Las transacciones tienen `merchant_name` pero no hay ninguna vista que lo agregue.

**Qué falta**:
- Sección "Top comercios" en el dashboard o en transactions
- ¿Cuánto gasté en Éxito este mes? ¿En Netflix acumulado?
- Podría ser un tab en `/transactions` o una sección expandible

---

### 1.8 Simulador de Deuda (Deferred → Priorizar)

**Problema actual**: Marcado como deferred en el HANDOVER. El botón "Simulador de pago" existe en `/deudas` pero `/deudas/simulador` no está completo.

**Qué falta**:
- Snowball vs Avalanche: comparar ambas estrategias con los datos reales del usuario
- Gráfico de "tiempo hasta quedar libre de deudas"
- Sliders para ajustar pago mensual extra y ver el impacto

**Valor alto**: Los usuarios con deuda (el segmento principal de Colombia) aman este tipo de herramienta.

---

### 1.9 Metas de Ahorro (Baja prioridad)

**Qué falta**:
- Tabla `savings_goals`: nombre, monto objetivo, fecha límite, cuenta asociada
- Barra de progreso en dashboard: "Vacaciones 2026: $1.2M / $3M COP"
- Sugerencia de cuánto ahorrar mensualmente para llegar al goal

---

### 1.10 Exportación de Datos (Media prioridad)

**Problema**: El usuario no puede sacar sus datos. Esto afecta la confianza.

**Qué falta**:
- Botón en Settings: "Exportar mis transacciones (CSV)"
- Filtros opcionales: rango de fechas, cuenta
- Futuro: exportar para declaración de renta DIAN

---

### 1.11 Experiencia Móvil (Media prioridad)

**Problema actual**: `mobile-nav.tsx` existe, pero los charts de Recharts y las tablas de transacciones probablemente no están optimizados para pantallas pequeñas.

**Qué falta**:
- Recharts con `ResponsiveContainer` + tamaño de fuente adaptativo en mobile
- Tablas de transacciones con scroll horizontal o vista de card en mobile
- Botones de acción principales flotantes (FAB) en mobile para "Añadir transacción" o "Importar extracto"
- Testear flujo de importación PDF en mobile (el input de archivo puede ser complicado en iOS)

**Tendencia 2026**: El aesthetic que domina en fintech mobile es dark navy + glassmorphism. La app usa shadcn/ui con theme claro. Considerar un dark mode como opción.

---

### 1.12 Notas en Transacciones (Baja prioridad)

**Qué falta**:
- Campo `notes` en `transactions` (ya puede estar en la DB)
- Input de texto libre en el detalle de transacción
- Util para marcar: "esto fue para el regalo de cumpleaños de mamá"

---

## Parte 2: Evoluciones con IA (Roadmap)

Estas features requieren LLM y tienen costo por uso. Ver Parte 3 para el modelo de pricing.

### 2.1 Chat con tus Finanzas

El patrón más trendy del sector: en lugar de navegar dashboards, el usuario pregunta en lenguaje natural.

**Ejemplos de queries que debería responder**:
- "¿Cuánto gasté en comida el mes pasado?"
- "¿Cuál es mi peor mes de gastos del año?"
- "¿Cuándo puedo pagar mi tarjeta Visa si ahorro $200k mensuales extra?"
- "¿Qué categoría creció más este trimestre?"

**Implementación**:
- Input de chat en el dashboard (sidebar o drawer)
- El contexto que se envía al LLM: resumen de cuentas, gastos del mes, categorías top, deudas
- El LLM genera una respuesta en texto natural + opcionalmente sugiere un filtro/vista
- Usar Claude Haiku para reducir costos (ver Parte 3)

**NO necesita acceso full a todas las transacciones** — un resumen comprimido es suficiente para el 90% de las preguntas.

---

### 2.2 Insights Narrativos Mensuales

Al inicio de cada mes, un párrafo generado por IA que resume el mes anterior:

> "En enero gastaste $3.2M COP, un 15% más que en diciembre. Tu mayor incremento fue en Restaurantes (+$420k). Ahorraste el 18% de tus ingresos — excelente. Tu deuda con Bancolombia bajó $250k."

**Implementación**:
- Edge Function serverless que corre el día 1 de cada mes
- Envía resumen estructurado al LLM → recibe párrafo narrativo
- Se guarda en DB → se muestra en dashboard

---

### 2.3 Categorización Mejorada con IA

**Problema actual**: La auto-categorización es keyword-based (`auto-categorize.ts`). Falla con comercios nuevos o descripciones ambiguas.

**Evolución**: LLM como fallback cuando el keyword matching no encuentra categoría.
- Solo se invoca cuando `category_id` es null después del keyword pass
- Prompt: "Este es un extracto bancario colombiano. Descripción: `TRANSFERENCIA DAVIPLATA 3001234567`. ¿A qué categoría corresponde?"
- Costo muy bajo porque solo se invoca en casos ambiguos

---

### 2.4 Detección de Anomalías con Explicación

Rule-based para detectar, LLM solo para explicar:
- Regla: si una transacción es >3σ del promedio histórico en esa categoría → anomalía
- LLM genera la explicación: "Esta transacción de $1.8M en Tecnología es 4x mayor que tu gasto típico. ¿Es una compra esperada?"

---

## Parte 3: Modelo de Pricing

### El problema de costos

La app tiene dos tipos de features por costo:

| Feature | Costo para ti | Quién paga? |
|---|---|---|
| PDF parsing (pdfplumber) | CPU del servidor, fijo | Tú (infraestructura) |
| Charts, analytics, dashboard | Supabase queries + Next.js | Tú (infra, casi nada) |
| Categorización keyword-based | Nada (computación local) | Nadie |
| AI Chat con finanzas | ~$0.005–$0.018 por query | Usuario debería pagarlo |
| AI Insights mensuales | ~$0.02 por usuario/mes | Marginal, incluible en Pro |
| Edge Functions cron | Supabase free tier cubre bastante | Tú |

### Propuesta de Tiers

#### Plan Gratuito — "Básico"
**Para**: Usuarios que quieren probar, estudiantes, personas con finanzas simples.

Incluye:
- ✅ Cuentas ilimitadas
- ✅ Transacciones manuales ilimitadas
- ✅ Dashboard completo (todas las gráficas)
- ✅ Categorías ilimitadas
- ✅ Transacciones recurrentes
- ✅ Dashboard de deudas
- ✅ **2 importaciones PDF por mes** (el límite es la restricción principal)
- ✅ 3 meses de historial visible
- ❌ AI Chat
- ❌ Insights narrativos mensuales
- ❌ Presupuestos por categoría (o limitado a 3)
- ❌ Exportación de datos
- ❌ Notificaciones por email

**Lógica del límite de PDF**: El parsing tiene costo de servidor. 2 extractos/mes (tarjeta + ahorros) es suficiente para evaluar, pero no para uso intensivo (múltiples cuentas).

---

#### Plan Pro — "Completo" (~$19,900–25,000 COP/mes ≈ $5 USD)
**Para**: Usuarios con múltiples cuentas, quienes importan mensualmente, personas con deuda activa.

Incluye todo lo de Básico, más:
- ✅ **Importaciones PDF ilimitadas**
- ✅ Historial ilimitado
- ✅ Presupuestos por categoría (ilimitados)
- ✅ Exportación de datos (CSV)
- ✅ Notificaciones email (pagos próximos, alertas de gasto)
- ✅ Proyección de flujo de caja
- ✅ Simulador de deuda (Snowball vs Avalanche)
- ✅ **AI Chat con tus finanzas** (50 queries/mes incluidas)
- ✅ **Insight narrativo mensual** (resumen de IA cada mes)

---

#### Plan Familiar — Futuro (~$35,000 COP/mes)
- Todo Pro
- Hasta 4 perfiles vinculados
- Dashboard compartido (ej. vista de patrimonio familiar)
- En roadmap lejano

---

### Análisis de Costos vs Revenue

**Costo LLM por usuario Pro activo (Claude Haiku)**:
- AI Chat: 30 queries/mes × $0.005 = $0.15 USD
- Insight mensual: 1 × $0.02 = $0.02 USD
- **Total LLM: ~$0.17 USD/usuario Pro/mes**

**Revenue por usuario Pro**:
- $19,900 COP ≈ $4.80 USD (a TRM ~$4,100)
- **Margen LLM**: $0.17 / $4.80 = 3.5% → muy saludable

**Costo infraestructura (estimado a pequeña escala)**:
- Supabase Pro: $25 USD/mes (hasta ~100k usuarios activos)
- PDF Parser (Railway o Fly.io, 512MB): $5–10 USD/mes
- Vercel (Next.js): Free tier aguanta bastante, Pro a $20/mes si se necesita
- **Total fijo: ~$40–55 USD/mes**

**Break-even**: Con $55 USD de infra fija y margen de ~$4.63 USD por usuario Pro, necesitas **12 usuarios pagos** para cubrir infraestructura. Muy alcanzable.

---

### Estrategia de Conversión Free → Pro

El mejor gancho de conversión en PFMs es el **límite de imports**. El usuario importa sus 2 extractos de enero → empieza a ver valor → en febrero quiere importar tarjeta + cuenta corriente + crédito de vehículo → necesita Pro.

Señales de upgrade a mostrar:
1. Contador visible de imports restantes: "Has usado 2 de 2 importaciones este mes — [Actualiza a Pro]"
2. Cuando intenta un 3er import: modal explicando el límite con botón de upgrade
3. Cuando abre AI Chat en free: "Esta función está disponible en Pro — [Ver planes]"

**No hacer**: No limitar el dashboard ni las gráficas en free. El usuario debe ver todo el valor de los datos que ya tiene. El límite debe estar en la adquisición de datos nuevos (imports) y en features de IA.

---

### Implementación del Paywall en Supabase

Agregar a la tabla `profiles`:
```sql
alter table profiles add column plan text default 'free' check (plan in ('free', 'pro', 'family'));
alter table profiles add column plan_expires_at timestamptz;
alter table profiles add column pdf_imports_this_month integer default 0;
alter table profiles add column pdf_imports_reset_at timestamptz;
```

En cada Server Action de import:
1. Leer `plan` y `pdf_imports_this_month` del perfil
2. Si `plan = 'free'` y `pdf_imports_this_month >= 2` → retornar error con `upgrade_required: true`
3. Si pasó la fecha de reset → resetear contador

Para pagos: integrar **Wompi** (el estándar en Colombia) o **Stripe** (si se apunta a mercado regional más amplio). Wompi acepta PSE, Nequi, tarjetas débito colombianas.

---

## Resumen: Priorización Sugerida

| Prioridad | Feature | Impacto | Costo IA? |
|---|---|---|---|
| 🔴 Alta | Presupuestos por categoría | Retención | No |
| 🔴 Alta | Onboarding wizard | Activación | No |
| 🔴 Alta | Sistema de paywall + plan Pro | Revenue | No |
| 🟠 Media | Alertas proactivas (rule-based) | Engagement | No |
| 🟠 Media | Búsqueda de transacciones | UX básica | No |
| 🟠 Media | Simulador de deuda (completar) | Retención deuda | No |
| 🟠 Media | Proyección de flujo de caja | Diferenciador | No |
| 🟠 Media | Exportación de datos | Confianza | No |
| 🟡 Baja | Evolución patrimonio neto | Engagement | No |
| 🟡 Baja | Análisis por comercio | Nice-to-have | No |
| 🟡 Baja | Metas de ahorro | Engagement | No |
| 🤖 AI | AI Chat con finanzas | Diferenciador Pro | Sí (Haiku) |
| 🤖 AI | Insight narrativo mensual | Delight | Sí (Haiku) |
| 🤖 AI | Categorización con IA (fallback) | Calidad datos | Sí (Haiku) |
