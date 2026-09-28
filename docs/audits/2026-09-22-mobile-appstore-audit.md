# Audit móvil pre-App Store — UX vs recorte webapp + paridad (2026-09-22)

Dos pasadas solo-código (sin simulador): `ux-analyst` (recorte #403–#406 + revisión Apple) y
`mobile-webapp-parity` (PRs #386–#418). Veredicto UX: **MOSTLY_COHESIVE** — la historia
Inicio → Movimientos → Plan funciona; falta aplicar el recorte y el camino demo está roto.

## P0 — bloquean el build

| # | Qué | Dónde | Arreglo | Tamaño |
|---|---|---|---|---|
| 1 | **Import PDF nativo duplica compras a cuotas.** No pasa `original_amount`/`installment_current`/`installment_total`/`installment_group_id` a `createTransaction` → idempotency key sobre la cuota, no el precio total (webapp usa `original_amount ?? amount`). `getReconciliationCandidates` no selecciona `currency_code`, `original_amount`, `installment_*` → el fix de #415 no aplica en móvil. | `mobile/app/(tabs)/import.tsx:852`, `mobile/lib/repositories/transactions.ts` ~600–665 | Pasar los campos (el repo ya los soporta) + ampliar el SELECT. Sin migración. | M |
| 2 | **Modo demo no permite escribir** (Apple 2.1). FAB → "Requiere cuenta" (`capture.tsx:404`); `return` silencioso en `recurrentes/new.tsx:58`, `account/create.tsx:61`, `presupuesto-armar.tsx:182,217`, `BudgetsRoot.tsx:164`, `capture-voice.tsx:104`; Importar falla tarde con "No hay sesión activa" (`import.tsx:449,671`). Semilla pobre (5 mov., sin recurrentes/presupuesto/destinatarios; "Nomina" sin tilde). | `mobile/lib/auth.tsx`, `mobile/lib/demo-data.ts` | `userId` efectivo = `DEMO_USER_ID` en demo (escrituras solo locales, nunca a la cola de push); aviso explícito en Importar; semilla con 2 recurrentes, 1 presupuesto, 3 destinatarios. En notas de App Review: cuenta de revisión como camino principal. | M |
| 3 | **Hero de Inicio da veredicto sin datos** — "VAS BIEN · $0/día" el día 0. Webapp muestra "Gasto de hoy" + "Sin datos aún" cuando no hay ingreso configurado. | `mobile/components/inicio/HybridHero.tsx:119-121,158-172` vs `webapp/src/components/dashboard/hybrid-hero.tsx:126-138` | Replicar la rama `incomeConfigured`. | S |
| 4 | **"Captura rápida" = `Alert("Próximamente")`** (Apple 2.1). Choca con la decisión 2026-07-28 de dejarla visible. | `mobile/components/ui/MobileTabBar.tsx:99-102`, `FabMenuSheet.tsx:69-86` | **Decisión del usuario pendiente.** Opción mínima: `QUICK_CAPTURE_ENABLED=false` oculta el tile sin borrar código. | S |

## P1 — recorte de la webapp sin aplicar en móvil

| # | Qué | Dónde | Arreglo | Tamaño |
|---|---|---|---|---|
| 5 | Hub Más: 14 tiles en 5 grupos. Webapp: Cuentas y saldos · Entender · Planificar · Sistema + "Herramientas avanzadas" colapsada (Categorizar, Categorías, Etiquetas, Periodo, Deseos, ¿Comprarlo?, Deudas personales). | `mobile/app/(tabs)/menu.tsx:34-88` vs `webapp/src/components/mobile/mobile-link-grid.tsx:44-73` | Reagrupar + sección colapsada (`useState(false)`); "Personas" → "Deudas personales"; sin tile Suscripciones. `/modos` no existe en móvil → se omite. | S |
| 6 | Entradas de nav a lo aparcado fuera de Más. | `settings.tsx:831-840` (Suscripciones, Etiquetas), `AvatarMenu.tsx:174-178` (Categorizar) | Quitar. | S |
| 7 | Plan sigue ofreciendo Periodo. | `mobile/components/plan/PlanToolsChips.tsx:68-78` + fetch en `PlanRoot` | Quitar chip y props. | S |
| 8 | Pantallas duplicadas: `(tabs)/accounts` vs `/accounts-list`; `(tabs)/budgets` sin enlaces entrantes. | `mobile/app/(tabs)/_layout.tsx:30-31`, `settings.tsx:819` | Dejar `/accounts-list` y `/presupuesto`; borrar las otras. | S |
| 9 | 6 widgets "Próximamente" en el catálogo (2 en inglés: "Avance de payoff", "Top merchants") + placeholder `UNKNOWN_RENDER`. | `AddWidgetSheet.tsx:88-92`, `mobile/lib/dashboard/widgets.ts:39-45`, `InicioRoot.tsx:56-70` | Filtrar `available:false`; borrar placeholder. | S |
| 10 | Permisos de ubicación declarados con la función apagada (`LOCATION_FEATURE_ENABLED=false`). | `mobile/app.json`, `mobile/lib/services/location/index.ts:10` | Quitar `NSLocation*`, plugin `expo-location`, `ACCESS_*_LOCATION` mientras siga apagada. Revisar Data Safety. | S |
| 11 | Importar paso 1 sin explicación ni header ("Toca para abrir el selector"). Sustituto de los coach-marks (spec §8 los deja fuera en nativo). | `mobile/app/(tabs)/import.tsx:1175-1205` | Copy de la webapp + nota bajo el campo de clave + `MobileHeader variant="sub"`. | S |
| 12 | Recurrentes vacío sin salida; suscripciones detectadas viven aparte. | `RecurrentesRoot.tsx:170-176`, `mobile/app/subscriptions.tsx` | Empty state con "Agregar recurrente" + bloque de detectadas arriba. | M |
| 13 | "Ver todas" de categorización manda a `/categorizar` (aparcado). | `MovimientosHerramientas.tsx:170`, `MovimientosRoot.tsx:80-84` | Filtro `uncategorized` en Movimientos (#404). | M |
| 14 | Etiquetas al crear (#396) ausentes. | `mobile/app/transactions/new.tsx` | Reusar el picker del detalle. | S–M |

## P2 — backlog

- Papelera duplicada en `transaction/[id].tsx:609` (dejar la del pie) — S.
- Header modal hundido ~60pt (7 pantallas, `MobileHeader` + `presentation:"modal"`) — toca ~40 pantallas, no en este build.
- Selector de día de 31 círculos (`AccountFormFields.tsx:57-59`).
- Personas: filas con aspecto tocable sin acción (se mitiga al aparcarla).
- Viaje activo no etiqueta capturas móviles (modos webapp-only, BACKLOG:174) — cae a la bandeja del viaje, no corrompe.
- Prompt "¿este abono incluye la cuota?" (#394) ausente en `findAndLinkLocalOccurrence`.
- Detección de recurrentes/suscripciones tras captura móvil: eventual, al sincronizar.
- Ya en BACKLOG y siguen abiertos: `budgets.is_demo`, `pd_role='origin'` en ingresos, Personas escritura, `occurrence_id` en SQLite, `categories.is_active`, vincular transferencias (#390) sin UI.
- Coach-marks nativos (dependen de sincronizar `guidedExperience`), chip "Parece recurrente", "Zeta notó".

## Descartado (verificado sin riesgo)

`recurring_occurrences` (móvil nunca inserta), `flow_class` (no se pisa en update), `dashboard_config` (móvil usa `mobile_dashboard_config`), snapshot único #417 (dedup local ya usa la misma clave), `push.ts` maneja `23505`, `personal_debts` solo lectura, `DEFAULT_LAYOUT`/`nav_focus` ya compartidos, #400 portado completo.

## Ya bien para Apple

Sign in with Apple · Eliminar cuenta (oculto en demo) · privacidad/términos · permisos bajo demanda en español · sin IAP (no hace falta "Restaurar compras").

## Slice propuesto para el build (1.3.1)

**Entra:** P0 1–4 + P1 5–11 + papelera duplicada. Todo S salvo import-cuotas y demo (M).
**Gates:** `mobile-webapp-parity` + `mobile-sync-doctor` (demo nunca empuja filas `DEMO_USER_ID`; import), `zetas-front-guy`, `mobile-perf-doctor` si se toca lista.
**Siguiente build (1.3.2):** P1 12–14.

## Estado 2026-09-24 (rama `feat/mobile-appstore-1.3.1`, PR abierto 2026-09-28)

Hecho: P0 1–3 (cuotas en import nativo + fix de merge que degradaba `capture_method`; demo con escrituras solo locales, trigger `sync_queue_block_demo` + engine/push no-op + semilla nueva; hero honesto), P1 5–11, papelera duplicada, `backBehavior="history"` en tabs. P0 4 (Captura rápida) se queda visible por decisión del usuario.

Verificado: `tsc --noEmit` limpio · `zetas-front-guy` PASS · semilla ejecutada sobre node:sqlite con todas las migraciones (34 tx, 0 FK, 0 fechas futuras) · trigger probado (bloquea con perfil demo, libera al borrarlo, bloquea payload demo) · `mobile-sync-doctor` PASS (key de idempotencia idéntica a webapp, sin regresión en correo) · semilla atómica + trigger recreado en cada apertura · permiso iOS "Siempre" de ubicación retirado · `markEntryCompleted` solo local · `raw_description` pasado en import.

Sin verificar: recorrido en simulador. `idb` no encuentra SimulatorKit (Xcode 27 lo movió a `Contents/SharedFrameworks`) y los deep links piden confirmación; hace falta la ventana del Simulator o arreglar la ruta de idb.

Pendiente (1.3.2):
- Pantallas aún atadas a `session` en demo (no-op silencioso): `account/edit/[id]`, `recurrentes/[id]/edit`, `ReassignSheet`, `purchase-decision`, `DeseosRoot`, `CategoriesRoot`, `etiquetas`, `periodo`.
- Importar pasos 2–4 sin `MobileHeader`.
- Recurrentes en demo: una sola ocurrencia local por plantilla (el servidor genera el resto).
- Saldos de la semilla fijos, no derivados de los movimientos.
- P1 12–14 de este audit.
