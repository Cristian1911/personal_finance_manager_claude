# Creación participativa de presupuesto — Diseño

**Fecha:** 2026-06-28
**Estado:** Aprobado (diseño) — pendiente plan de implementación
**Enfoque:** A — extender el builder existente y enrutar la creación inicial a él

## Problema

El Paso 3 del `BudgetWizard` ("Asigna tu primer presupuesto") **pre-llena cada categoría con un split parejo del ingreso** (todas en 125.000). Es un presupuesto falso: no involucra al usuario, no refleja su realidad, y muestra números inventados — lo contrario del principio de honestidad del milestone ("ninguna pantalla muestra un veredicto/dato que no se sostiene"). El usuario no sabe su total de "Hogar", pero sí sabe internet, servicios, mantenimiento — y si ya importó movimientos (aunque sin categoría), debería poder usarlos.

## Objetivos

- La creación de presupuesto es **participativa**: el usuario elige qué categorías presupuestar y construye cada una; nada se pre-llena con números inventados.
- **Desglose por líneas** por categoría (subcategorías) con **calculadora** y **quitar línea ("−")**.
- **Selector de transacciones**: elegir movimientos reales (típicamente sin categorizar) para una categoría/línea → su suma rellena el monto **y se categorizan** esas transacciones.
- **Modo 50/30/20** como capa: agrupa categorías en 3 sets con cap = % del salario, con el mismo funcionamiento por dentro.
- Máximo reuso (el builder ya tiene líneas + calculadora; el "−" ya se agregó).

## No-objetivos

- No rediseñar la vista de presupuesto ya existente (grid, treemap, tendencias).
- No un nuevo modelo de datos para "líneas de transacción" persistidas: las tx elegidas se **categorizan** (infra existente) y su suma alimenta el monto; el budget persiste como monto por categoría/subcategoría.
- No bloquear por cap (solo avisa).
- No tocar el escenario "Simular cambio".

## Componentes y acciones a reusar (estado actual)

- `webapp/src/components/budget/budget-wizard.tsx` — Paso 1 ingreso (`StepIncome`), Paso 2 estilo (`StepStylePreview`, `StyleCard`), Paso 3 plano (`StepAllocation`, **se elimina**). `handleFinalize` ya hace `setBudgetMode` + `updateEstimatedIncome` + `bulkUpsertBudgets`.
- `webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx:117` — renderiza `<BudgetWizard>` cuando `!budgetMode`. Ya enlaza a `/presupuesto/armar` desde la vista de presupuesto.
- `webapp/src/components/budget/budget-builder.tsx` — builder por líneas (página `app/(dashboard)/presupuesto/armar/page.tsx`). Maneja `draft: Record<categoryId, string>`, `groupTotal`, `applyBudgetComposition`, `handleCreateSub`, `createdSubs`, `removeLine` (agregado hoy). Surface a extender.
- `webapp/src/components/budget/budget-group-lines.tsx` — líneas por grupo: `CurrencyInput` (calculadora vía `safeEvaluate`), chips sugeridos (recurrente/prom 3m), "Otra línea…" (crear subcategoría), y **"−" quitar línea** (`onRemoveLine`, agregado hoy).
- `webapp/src/components/ui/currency-input.tsx` — calculadora ya implementada (`+ − * /`, evalúa en blur).
- `webapp/src/actions/budgets.ts` — `applyBudgetComposition(diff)`, `bulkUpsertBudgets`, `getBudgetMode`/`setBudgetMode`.
- `webapp/src/actions/categories.ts` — `getCategoriesWithBudgetData(month, currency)` (datos `CategoryBudgetData` con `children`, `childRecurring`, `childAvg3m`, `childBudgets`, `childrenSpent`), `createCategory`.
- `webapp/src/actions/categorize.ts` — `categorizeTransaction`, `assignDestinatario`.
- `webapp/src/actions/categorize.ts` / transacciones — fuente de movimientos sin categorizar (`getUncategorizedTransactions` ya existe en `actions/categorize`).
- `@zeta/shared` — `categoryBudgetGroup`, `isFixedBudgetCategory` para mapear categoría → set 50/30/20.
- Patrón de sheet de selección reusable: `LinkPickerSheet` (recurring) como referencia para el selector de transacciones.

## Diseño detallado

### 1. Flujo / routing
- `StepStylePreview` (Paso 2) agrega una tercera opción de estilo: **50/30/20** (`mode = "50_30_20"`), junto a Flexible (`per_category`) y Estricto (`zero_based`).
- `BudgetWizard` elimina `StepAllocation` (Paso 3 plano). Al continuar desde el Paso 2: persistir `setBudgetMode(mode)` + `updateEstimatedIncome(income)` y **enrutar a `/presupuesto/armar`** (el builder). El indicador de pasos pasa a 2.
- El split parejo automático (`initAllocations`) se elimina.
- `BudgetBuilder` se vuelve la superficie única de creación y edición. Recibe `mode` (para 50/30/20) además de `groups`, `income`, `currency`.

### 2. Builder participativo (extiende `BudgetBuilder` + `BudgetGroupLines`)
- **Arranca sin montos.** Hoy `initialDraft` pre-llena `baseBudget`/`childBudgets` existentes; en creación no hay ninguno → arranca vacío (correcto). Las tarjetas de categoría se muestran colapsadas con total "—".
- **Selección de categorías:** en vez de listar todas las categorías como secciones, mostrar las que tienen monto > 0 como secciones activas y las demás detrás de un selector "**+ Agregar categoría**" (chips/picker). El usuario decide cuáles presupuestar. (Las categorías con recurrentes/promedio se ofrecen primero.)
- **Por categoría (igual en todos los modos):** desglose por líneas con `BudgetGroupLines` — calculadora, chips sugeridos, "Otra línea…", **"−" quitar**, y el nuevo **"Desde transacciones"** (§3). Total = suma de líneas.
- Barra total general vs ingreso (ya existe en el builder).

### 3. Selector de transacciones (nuevo)
- Componente nuevo: `webapp/src/components/budget/budget-tx-picker-sheet.tsx` (sheet móvil + dialog desktop; reusar patrón de `LinkPickerSheet`).
- Disparador: botón **"Desde transacciones"** a nivel de categoría/línea dentro de `BudgetGroupLines`.
- Contenido: lista de movimientos del usuario, por defecto **sin categorizar** (`getUncategorizedTransactions`), con buscador y toggle "ver todas". Una fila por tx: comercio + fecha + monto + checkbox.
- Acción al confirmar (N seleccionadas):
  1. A cada tx se le **asigna la categoría/subcategoría** destino (`categorizeTransaction`).
  2. La **suma** de las seleccionadas **rellena el monto** de esa categoría/línea en el draft del builder.
- Las transacciones quedan categorizadas (objetivo doble). No se persiste un "line-per-tx" en el budget; el monto persistido es el del presupuesto.
- Estado vacío: si no hay transacciones, el botón "Desde transacciones" se oculta/deshabilita con hint ("Importa o registra movimientos para usar esto").

### 4. Modo 50/30/20 (capa sobre el builder)
- Cuando `mode === "50_30_20"`, el builder agrupa las categorías en **3 sets**: Necesidades (50%), Deseos (30%), Ahorro/Deuda (20%). Mapeo categoría→set vía `categoryBudgetGroup`/`expense_type`/`is_essential` (existente).
- Cada set muestra un **cap = % del salario** (Necesidades = 0.5·ingreso, etc.) y una barra "asignado vs cap" — **informativa, avisa si se pasa, no bloquea**.
- Dentro de cada set, **el mismo builder por líneas + transacciones** por categoría.
- En modos `per_category`/`zero_based` no hay sets (lista plana de categorías como hoy).

### 5. Datos / persistencia
- Guardar vía `applyBudgetComposition(diff)` (existente): budgets por categoría/subcategoría = suma de líneas.
- El selector de transacciones usa `categorizeTransaction` (existente) para las tx elegidas.
- **Cambio de tipo/validación (menor):** agregar el valor `"50_30_20"` a:
  - el enum/tipo de `budget_mode` (`webapp/src/types/domain.ts` `BudgetMode`, y validador en `lib/validators/dashboard-config.ts` si aplica al wizard, + cualquier `z.enum` de budget_mode en `actions/budget.ts`/validadores de budgets),
  - los lugares que hacen `switch (mode)` / mapeos de etiqueta de modo (`budget-wizard` `StylePreview`, `BudgetAjustesSheet`, etc.).
  - No requiere migración de DB si `budget_mode` es columna `text` (verificar; si es enum de Postgres, agregar migración del valor — spawn `supabase-migrator`).
- Sin nuevo modelo de datos para líneas de transacción.

### 6. Estados (honestidad)
- **Sin ingreso:** el builder funciona; sin barra "vs ingreso" ni caps 50/30/20 (no inventa metas) + nudge "Confirma tu ingreso". (En 50/30/20 sin ingreso, los caps no se muestran.)
- **Sin transacciones:** "Desde transacciones" oculto/deshabilitado con hint.
- Nada se da por presupuestado hasta que el usuario asigne.

## Fases

- **P1** — Routing wizard→builder + arranque vacío + selección de categorías ("+ Agregar categoría"). Reusa líneas/calculadora/"−". Elimina `StepAllocation` + `initAllocations`.
- **P2** — Selector de transacciones (`budget-tx-picker-sheet`): selecciona tx sin categorizar → categoriza + rellena monto.
- **P3** — Modo 50/30/20 por sets (estilo nuevo en Paso 2 + agrupación + caps informativos en el builder), incluido el cambio de `BudgetMode`.

## Decisiones (aprobadas)
- (a) El cap 50/30/20 **avisa, no bloquea**.
- (b) El selector de transacciones **categoriza** las tx elegidas (no solo toma el monto).

## Verificación
- Gate continuo (dev server vivo en :3000): `pnpm -C webapp exec tsc --noEmit` (no `pnpm build`).
- Gates de proyecto antes de PR: `zetas-front-guy` (UI), `server-action-reviewer` (si se tocan/crean acciones del selector de tx o de budget_mode), `import-flow-doctor`/categorize si el selector toca categorización.
- Por fase, una verificación mínima ejecutable (p.ej. el cómputo de suma de líneas, el mapeo categoría→set 50/30/20, el rellenado desde tx).

## Riesgos / notas
- Verificar si `budget_mode` es columna `text` o enum Postgres (define si P3 necesita migración).
- El selector de transacciones categoriza tx → invalidar vistas (`updateTag` de las vistas financieras) tras categorizar.
- La selección de categorías no debe romper la edición existente del builder (usuarios con budget ya armado deben ver sus categorías activas como hoy).
