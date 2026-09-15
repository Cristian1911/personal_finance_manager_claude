# Primeras semanas — diseño de la experiencia inicial (día 0 → mes 3)

**Estado:** aprobado el 2026-09-15. Fase B implementada: #403 (recorte de nav, mergeado), #404 (filtro Sin categoría), #405 (suscripciones en Recurrentes), #406 (guía de página). Fase A (descubrimiento) pendiente, slices en §9 y en BACKLOG.

**Mockups:** `claude-ai-design/primeras-semanas/` (11 pantallas + mapa). Canvas publicado como Artifact (https://claude.ai/artifact/Xb1ADsabZcjXWDd3vGXVKT); DS cards en el proyecto "Zeta Design System" bajo el grupo "Primeras semanas".

**Revisión 2026-09-15 (tarde):** recorte de alcance y guía de página incorporados (§5 y §6). Periodo y ¿Comprarlo? salen de la cadena; Suscripciones deja de ser página en la nav y pasa a vivir dentro de Recurrentes.

## 1. Problema

La Fase 1 de la experiencia guiada (PR #312, jun-2026) cubrió el día 0: `EmptyState`, `InfoHint`, Primeros pasos, 3 coach-marks, honestidad del veredicto. Nunca se construyó lo que sigue: cómo un usuario descubre, con sus propios datos, para qué sirven Destinatarios, Recurrentes, Presupuesto o Tendencias, sin manual ni tour.

Hoy (verificado 2026-09-15):

- Al completarse Primeros pasos, `getFirstStepsData` devuelve `null` y nada lo reemplaza. La guía termina el día 1.
- La maquinaria de detección **ya existe** (sugerencias de destinatarios, `detectSubscriptions`, matcher de ocurrencias, anomalías de Tendencias, nudges de Deseos, `getWeeklyDigest`) pero está repartida en 4 superficies, se dispara de forma inconsistente y se presenta como tarea ("3 destinatarios sugeridos"), no como algo que Zeta hizo por el usuario.
- `getWeeklyDigest` está implementado con cero llamadas. `InfoHint` vive en 2 sitios. No existe ningún detector de "esto parece recurrente" sobre transacciones sueltas.

## 2. Principio

**El descubrimiento sigue a los datos, no al calendario.** Cada concepto se presenta en el momento en que los datos del usuario lo hacen real, con una gramática fija:

> Zeta notó X → esto es lo que desbloquea → una acción.

Reglas de copy:

- **Nunca se define el sustantivo primero.** Se muestra el efecto que el usuario ya recibió y después se nombra el lugar: "Reconocimos 14 comercios. Desde ahora se categorizan solos." y recién luego "Ver cuáles" lleva a Destinatarios.
- Los números hablan primero. Una cifra concreta del usuario, no una promesa genérica.
- Tuteo, sin emoji, sin signos de exclamación, brass como único acento.
- Toda revelación tiene descarte de un toque y no vuelve a aparecer.
- Copy con "parece" cuando la señal es probable (2 repeticiones); copy afirmativo cuando es cierta (metadata del extracto).

Continuidad con lo decidido en junio: sin tour, sin modal. Los coach-marks siguen siendo bloques inline sin overlay; lo único nuevo es que en tres pantallas densas van secuenciados de a dos (§6). "El tutorial es la pantalla misma", extendido de horas a semanas.

## 3. La cadena

```
movimientos → destinatarios (reconocimiento) → recurrentes (repetición) → presupuesto (límites) → veredicto
                      └ deudas (al importar una tarjeta)          tendencias / anomalías (necesitan ≥2 meses)
```

Periodo (el reparto entre ingresos) salía entre Recurrentes y Presupuesto; queda aparcado (§5). `fixedVsVariable` sigue leyendo las recurrentes programadas, así que la dependencia Recurrentes → Presupuesto se mantiene sin el paso intermedio.

Un concepto solo se revela cuando el anterior ya produjo datos. Por eso el orden es de dependencia, no de importancia.

### 3.1 Columna vertebral (con mockup)

| # | Momento | Concepto | Señal que dispara | Estado del motor | Copy (tarjeta Inicio) | Acción | Inline en |
|---|---|---|---|---|---|---|---|
| 0 | Día 0 | Chooser D1 | — | Mock jun-2026, sin código | ¿Cómo quieres empezar? | A · Sube tus extractos / B · Cuentas y saldo / C · Presupuesto / D · Explorar | `/onboarding` |
| 1 | Día 0, tras import | Destinatarios | comercios reconocidos por `matchDestinatario` + sugerencias del `SuggestedDestinatariosPanel` | Existe, presentado como tarea | Reconocimos 14 comercios. Desde ahora se categorizan solos. | Ver cuáles | step-results del import + cabecera de `/destinatarios` |
| 1b | Día 0, tras import TC | Deudas | metadata del extracto: saldo, día de corte, pago mínimo | Existe | Tu Visa Bancolombia: saldo $1.240.000. Pago mínimo $186.000 antes del 15. | Ver plan de pago | `/deudas` |
| 2 | Día 1–7 | Veredicto | ingreso confirmado + ≥1 tx → hero sale de "Sin datos aún" | Existe (D6) | Tu veredicto ya es real: $96.500 disponibles hoy. | — (el hero es la revelación) | hero |
| 3 | Sem 1–2 | Recurrentes | **NUEVO** `detectRecurringCandidates`: ≥2 cobros, mismo destinatario o `cleanDescription`, mismo día ±3 o gap 28–34 días, cualquier `capture_method` | No existe | Netflix se cobró el 5 de ago y el 5 de sep, $26.900 las dos veces. Parece un cobro mensual. ¿Lo ponemos en el calendario? (la tarjeta afirma solo las dos fechas observadas; la conclusión va con "parece") | Programar / No es recurrente | detalle de tx (chip "Parece recurrente") + panel en `/plan?tab=recurrentes` ("4 cobros parecen repetirse cada mes") |
| 4 | Lunes sem 2 | Digest | `getWeeklyDigest` con ≥7 días de datos | Existe, sin caller | Tu semana en números: $612.400 gastado. Restaurantes primero. 12% menos que la anterior. | Ver Tendencias | Inicio solamente |
| 6 | Cierre mes 1 | Presupuesto | primer mes calendario completo con tx desde la primera cuenta; `fixedVsVariable` + `avg3m` | Existe (cálculo) | Septiembre completo: $3.412.800. $1.670.670 fijo, $1.742.130 variable. ¿Ponemos un límite a lo variable? | Armar presupuesto (prellenado con promedios) | `/plan?tab=presupuesto` |
| 7 | Mes 2 | Tendencias | `movers` con ≥2 meses de historial por categoría. Las anomalías (`anomalies`, media móvil de 3 meses) esperan al tercer mes: hasta entonces la tarjeta muestra el estado honesto "Sin anomalías todavía" | Existe | Ya tienes dos meses. Restaurantes subió 18%, Transporte bajó 9%. | Ver Tendencias | `/tendencias` |
| 8 | Mes 2–3 | Suscripciones | `detectSubscriptions` (≥3 cobros) corriendo tras cualquier import o captura, no solo PDF | Existe, mal disparado | 3 cobros mensuales parecen suscripciones: $320.670 al mes. | Revisar | panel `SubscriptionSuggestions` arriba de la lista en `/plan?tab=recurrentes` + chip "Suscripción" en la plantilla vinculada (`subscriptions.recurring_template_id`). `/suscripciones` queda como página de gestión, sin entrada en la nav |

La fila 5 (Periodo) se retiró el 2026-09-15: Periodo queda aparcado (§5). Puedo pagar y Deseos también: no se revelan ni se enlazan desde el hero en esta ronda.

### 3.2 Fila en el mapa, sin mockup

| Concepto | Señal posible | Notas |
|---|---|---|
| Modos | ≥5 tx en moneda extranjera o con etiqueta de viaje en ≤10 días → "12 gastos en USD entre el 3 y el 9. ¿Agrupar como viaje?" | Aparcado (§5). Hoy no hay detector; la señal queda como detector futuro (P3). La feature de viajes (PR #400) ya trae la moneda. |
| Etiquetas | ninguna | Aparcado. Se descubren al usarlas en Movimientos; no merecen revelación. |
| Deudas personales | ninguna | Aparcado en la nav; las acciones contextuales del movimiento ("Vincular a deuda personal", "Repartir gasto") se quedan. |
| Categorizar | `uncategorized` en Bandeja | Aparcado en la nav. La AttentionCard de Movimientos pasa a enlazar el filtro "Sin categoría" dentro de Movimientos; la Bandeja sigue siendo la página de trabajo en lote. |

### 3.3 Gate de honestidad

Ninguna revelación se dispara con datos sintéticos. Reusa el piso de junio: F1 (cuenta líquida con saldo real) + (F2 ingreso o F3 tx del mes). Las revelaciones 6–8 requieren además F4 (≥2 meses).

`Dia0Import` no muestra "posibles recurrentes": un extracto mensual trae una sola ocurrencia por cobro. La línea aparece solo si el import cubre ≥2 periodos. Lo único que el día 0 afirma es lo que dice el extracto (saldo y pago mínimo de la tarjeta), y lo afirma como consecuencia del CTA ("Al importar queda en tu calendario"), no antes.

**Supuesto de la semana 1:** la revelación de Recurrentes necesita una segunda ocurrencia. En los mockups esa segunda ocurrencia viene de un segundo extracto (agosto) o de cobros capturados por correo o app. Un usuario con un solo extracto mensual la ve en la siguiente importación, no en la semana 1. El mapa no promete fechas: promete señales.

## 4. Mecanismo

### 4.1 Una fuente, dos renderers

- **`getDiscoveries()`** en `webapp/src/actions/discoveries.ts`. Federa los detectores existentes y el nuevo `detectRecurringCandidates`. Devuelve `Discovery[]` ordenado por la cadena: `{ id, kind, title, body, primary: {label, href}, secondary?: {label, action}, signalAt }`. Máximo 2 visibles en Inicio; el resto espera.
- **Tarjeta en Inicio.** `PrimerosPasos` evoluciona en vez de morir: mientras haya pasos, checklist; cuando haya descubrimientos, la misma tarjeta muestra la sección "Zeta notó" debajo de los pasos, y cuando los pasos terminan la tarjeta se queda con solo esa sección. Mismo slot, mismo icono, mismo dismiss/snooze.
- **Inline en el concepto.** `DiscoveryInline` en la pantalla del concepto (detalle de tx, `/plan?tab=recurrentes`, `/plan?tab=presupuesto`, `/tendencias`, `/destinatarios`, `/deudas`). Mismo `id`, mismo dismiss: descartar en un sitio lo apaga en los dos. Base: `components/ui/alert.tsx` existe pero es el shadcn stock (`rounded-lg border px-4 py-3 grid`), sin tokens Zeta; `DiscoveryInline` lo envuelve con `className` de tokens, no crea un banner nuevo.

### 4.2 Persistencia

`dashboard_config.guidedExperience.discoveries: Record<DiscoveryId, { seenAt?: string; dismissedAt?: string; actedAt?: string }>`. Extiende `types/dashboard-config.ts` y `validators/dashboard-config.ts`. Sin migración.

**Prerrequisito:** `skipOnboardingWithDefaults` deja `dashboard_config` en `NULL` y `patchGuided` devuelve `{success: true}` sin escribir. Hoy eso ya rompe dismiss/snooze/coach-marks para usuarios que saltaron el onboarding; con descubrimientos lo rompería peor. Fix: seed lazy de `getDefaultConfig(purpose)` en `patchGuided` cuando el config es `NULL`.

### 4.3 Detector nuevo

`packages/shared/src/utils/recurring-candidates.ts`: generalización de `subscription-detector.ts` con opciones. Entrada: transacciones OUTFLOW de los últimos 3 meses con `destinatario_id`, `clean_description`, `transaction_date`, `amount`. Agrupa por `destinatario_id`, y si es null por `cleanDescription`. Candidato si ≥2 cobros con mismo día del mes ±3 o gap de 28–34 días, y montos dentro de ±10% de la mediana. Excluye pagos a deuda, transferencias y retiros (reusa el guard de `auto-categorize.ts`). Corre tras `importTransactions`, tras cada lote de captura (email, Telegram, quick capture) y al abrir Inicio si la última corrida tiene más de 24 h. Un `ponytail:` documenta el techo: sin cadencia semanal ni anual.

### 4.4 Digest

Tarjeta los lunes en Inicio con `getWeeklyDigest`. El engine tiene mapas de emoji y títulos; pasan por la regla de marca antes de renderizar. Descarte hasta el lunes siguiente. Sin push ni email en esta ronda.

### 4.5 Arreglos baratos que van con el recorte (§5)

- `inicio-discovery-rail.tsx`, `plan-decision-rail.tsx` y `burndown-expandable.tsx` tienen cero imports: se borran (antes se pensaba corregir el enlace del primero).
- `/suscripciones` no entra a la nav: el panel de sugerencias vive dentro de Recurrentes (§3.1 fila 8).
- `runSubscriptionDetection` tras captura por email/Telegram/quick capture, no solo tras import PDF.
- `patchGuided` siembra `getDefaultConfig(app_purpose)` cuando `dashboard_config` es NULL (§4.2). Va en el primer PR del recorte porque la guía de página (§6) depende de él.

## 5. Recorte de alcance (decisión del usuario, 2026-09-15)

La mitad del problema "muchas opciones" es el número de opciones: la grilla de Más tenía 14 tiles en 5 grupos, Plan 5 pestañas, y convivían dos paradigmas de presupuesto (Presupuesto y Periodo). Primero se recorta; después se guía lo que queda.

| Nivel | Features | Dónde viven |
|---|---|---|
| **Núcleo** | Inicio · Movimientos (captura, import, filtro "Sin categoría") · Cuentas · Recurrentes (facturas + suscripciones en una lista, chip "Suscripción") · Deudas · Destinatarios · Tendencias | Tab bar + Más: 7 tiles en 4 grupos que siguen la historia de la app. **Cuentas y saldos** (Cuentas, Importar) mete el dinero · **Entender** (Destinatarios, Tendencias) explica a quién y cuánto · **Planificar** (Recurrentes, Deudas o Plan según `nav_focus`) mira adelante · **Sistema** (Ajustes) |
| **Aparcado** | Periodo · ¿Comprarlo? · Deseos · Modos · Etiquetas · Deudas personales · Categorizar (bandeja) · Categorías | Más → "Herramientas avanzadas": sección colapsada al final de la grilla (`ui/collapsible.tsx`, cerrada por defecto, sin persistir). En desktop, el mismo grupo colapsado en el sidebar. |

Reglas del aparcado:

- Rutas, datos y deep links intactos. `/plan?tab=periodo`, `/deseos`, `/puedo-pagar` siguen renderizando; solo desaparecen sus entradas de nav, sus pestañas en Plan, sus chips de drill y sus widgets en Inicio.
- `PlanTab` se deriva de `PLAN_TABS`, así que las pestañas no se quitan del array: se marcan `nav: false` y el `<nav>` las filtra. `VALID_TABS` y `MOBILE_TAB_TITLES` no cambian.
- `puedo_comprarlo` sale del `DEFAULT_LAYOUT` compartido (`packages/shared`) y pasa a `available: false`; quien ya lo tenía en su layout lo conserva.
- Las acciones contextuales de un movimiento ("Vincular a deuda personal", "Repartir gasto") se quedan: no son ruido de nav.
- Destinatarios conserva su nombre. No se renombra.
- Suscripciones se pliega en Recurrentes (§3.1 fila 8): panel de sugerencias arriba de la lista + chip por plantilla vinculada; el botón "Suscripciones ›" y el footer del empty state desaparecen. El chip no aparece en los mockups porque en la semana 2 la persona aún no tiene ninguna suscripción detectada (necesita 3 cobros) y el chip es un `Badge variant="outline"` stock.

Sin tour ni modal: la decisión de junio se mantiene.

## 6. Guía de página

Coach-marks secuenciados, dos por página, sin overlay ni portal, solo en las tres pantallas densas que sobreviven al recorte. Extiende `components/guided/coach-mark.tsx` con `useCoachMarkSequence(ids)` (el primer id no visto es el activo; descartar marca visto y avanza en el mismo render) y una prop opcional `step` ("1 de 2") que se pinta como eyebrow brass. El bloque sigue siendo un hermano inline previo del ancla, como los tres call sites de hoy. Persistencia en `seenCoachMarks`, sin migración.

| Página | id | Ancla | Copy |
|---|---|---|---|
| Importar · Subir | `import-upload` | dropzone | Sube el PDF tal como lo manda el banco. Zeta detecta el banco; no tienes que elegirlo. |
| Importar · Subir | `import-password` | campo de clave (solo en la ruta PDF, por eso este par no lleva "N de 2") | Si el PDF pide clave, guárdala con un alias y no la vuelves a escribir. |
| Presupuesto · Armar | `budget-builder-sum` | barra Σ sticky | Reparte solo lo que te importa. La barra muestra cuánto llevas asignado de tu ingreso. |
| Presupuesto · Armar | `budget-builder-add` | primera fila "Agregar categoría" | Agrega una categoría y ponle un tope. Empieza con dos o tres; puedes sumar más después. |
| Planificador | `planner-steps` | pestañas de pasos | Los cuatro pasos van en orden, pero puedes volver a cualquiera tocando su pestaña. |
| Planificador | `planner-compare` | contenido del paso Comparar (`planner/compare-step.tsx`) | Recomendado marca el plan que paga menos intereses en total. Mira también los meses: a veces vale pagar un poco más por terminar antes. |

Copy ajustada al implementar (#406) para afirmar solo lo que cada pantalla hace: el builder no ofrece "promedio de tres meses" (eso vive en la hoja de edición del presupuesto), la intro del planificador ya enumera los cuatro pasos, y "Recomendado" se elige por menor interés total. `debt-simulator.tsx`, donde el borrador anclaba `planner-compare`, tenía cero imports y se borró.

Reconciliar conserva su marca `import-reconciliation` independiente. Movimientos no entra: tras el recorte sus herramientas son dos chips con contador que se explican solos. Mockup: `GuiaImport`.

## 7. Pantallas

Todas 390×844 salvo el mapa. Persona: Camila, ingreso $4.200.000 el 30, cuenta de ahorros + Visa Bancolombia.

| Archivo | Momento | Qué muestra |
|---|---|---|
| `Main` (mapa, 1600×900) | — | Línea de tiempo día 0 → mes 3, la cadena de dependencia, cada revelación como tick brass con señal y copy |
| `Dia0Chooser` | Día 0 | D1 tal cual (jun-2026) |
| `Dia0Import` | Día 0 | "Lo que encontramos": 184 movimientos · 14 comercios reconocidos · Visa con saldo y pago mínimo |
| `Dia1Inicio` | Día 1 | Hero honesto "Sin datos aún" + Primeros pasos 2 de 4 |
| `Sem1Inicio` | Sem 1–2 | Hero real + tarjeta con "Zeta notó": comercios y Netflix |
| `Sem1Movimiento` | Sem 1–2 | Detalle de Netflix con chip "Parece recurrente" y acciones |
| `Sem2Recurrentes` | Sem 2 | `/plan?tab=recurrentes` con panel inline "4 cobros que se repiten" |
| `Sem2Digest` | Lunes sem 2 | Inicio con "Tu semana en números" |
| `GuiaImport` | Cualquier día | Paso Subir de Importar con los dos coach-marks (§6): sobre el dropzone y, tras subir un PDF con clave, sobre el campo de contraseña |
| `Mes1Presupuesto` | Cierre mes 1 | `/plan?tab=presupuesto` con "Septiembre completo" y "límite a lo variable" |
| `Mes2Tendencias` | Mes 2 | `/tendencias` con "Ya tienes dos meses", los movers y el estado honesto de anomalías ("Sin anomalías todavía", tres meses) |
| `Mas` (390×1100) | — | Grilla de Más recortada a 7 tiles y la sección "Herramientas avanzadas" (dibujada abierta; en la app arranca cerrada) |

`Sem3Periodo` se retiró el 2026-09-15 con el recorte. Las pestañas de Plan en `Sem2Recurrentes` y `Mes1Presupuesto` muestran solo Resumen · Presupuesto · Recurrentes.

## 8. Fuera de alcance

Código de app (plan aparte). Móvil RN (la capa guiada no existe ahí; se espeja después con el estado `guidedExperience` sincronizado). Push y email. Rediseño del chooser D1. Fases T2–T6 del brief de evolución. Detectores para las features aparcadas (Modos).

## 9. Slices de implementación (orden, cada uno su PR)

Primero el recorte y la guía (Fase B), después el descubrimiento (Fase A). El orden importa: la guía de página depende del seed de `patchGuided`, que va en el primer PR.

1. **B1a `feat/recorte-nav`** — grilla de Más + "Herramientas avanzadas", `WORKSPACE_NAV`/`ADVANCED_NAV` en desktop, pestañas de Plan con `nav: false`, chips de drill, widget Deseos y sus dos fetches, CTA de `timeline-model` → Recurrentes, tres archivos muertos, seed de `patchGuided`. Solo esconder y borrar. Gates `zetas-front-guy`, `perf-auditor`.
2. **B1b `feat/filtro-sin-categoria`** — filtro "Sin categoría" (validator `categoryId: uuid | "none"`, `.is("category_id", null)`, chip, href de la AttentionCard) y retirar el panel "Compra consciente" de Movimientos. Gate `server-action-reviewer`.
3. **B1c `feat/suscripciones-en-recurrentes`** — panel de sugerencias + chip "Suscripción" en Recurrentes (desktop y móvil web), `puedo_comprarlo` fuera de `DEFAULT_LAYOUT`. Gates `mobile-webapp-parity`, `cache-doctor`, `server-action-reviewer`.
4. **B2 `feat/guia-de-pagina`** — `useCoachMarkSequence` + prop `step` + las 6 marcas de §6. Gates `zetas-front-guy`, `perf-auditor`.
5. `detectRecurringCandidates` en `@zeta/shared` con test (TDD) + chip "Parece recurrente" en detalle de tx + `runSubscriptionDetection` tras capturas. Gate `recurring-doctor`.
6. `getDiscoveries()` + tipos + persistencia + `PrimerosPasos` con sección "Zeta notó". Gates `server-action-reviewer`, `cache-doctor` (no query sin caché en el render path de Inicio), `perf-auditor`.
7. `DiscoveryInline` en las 6 pantallas de concepto.
8. Digest semanal en Inicio.
9. D1 chooser (reemplaza el paso de estimaciones).
