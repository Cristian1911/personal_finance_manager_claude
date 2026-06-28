# 03 · Pantallazos — índice y dónde ancla la guía

> **`actual/` recapturado 2026-06-27** — estado ACTUAL del webapp, sesión autenticada con datos reales, layout móvil (~504px, 2× DPR). Reemplaza el set anterior (estaba desactualizado).
> ⚠️ Privacidad: contienen datos financieros reales del usuario (cuentas, saldos). Si se comparten con el agente web de Claude Design, tenerlo presente.

## `actual/` — estado ACTUAL (sobre estas pantallas se diseña la guía)

| Archivo | Pantalla | Guía que se ancla aquí |
|---|---|---|
| `01-dashboard.png` | Home / Dashboard | **InfoHint** en hero "gasto de hoy / disponible por día" · **Checklist "Primeros pasos"** · estado de honestidad del gauge "Ritmo" |
| `02-movimientos.png` | Movimientos | **EmptyState** zero-tx · superficie "Categorizar 755 por resolver" |
| `03-import.png` | Importar (wizard · PASO 1 DE 4) | **Explicador de conciliación** · progressive disclosure (ya existe "Más sobre este flujo") · es el on-ramp **A** |
| `04-cuentas.png` | Cuentas | **InfoHint** moneda + campos de tarjeta + "Patrimonio" · on-ramp **B** |
| `05-deudas.png` | Deudas (overview) | **EmptyState** "marca una cuenta como deuda" · InfoHint salary-bar |
| `06-deuda-planificador.png` | Planificador de deudas | nudge "agrega la tasa (APR)" cuando falta `interest_rate` |
| `07-presupuesto.png` | Presupuesto (895% sobre límite) | **InfoHint** "Modo" + 50/30/20 · on-ramp **C** (BudgetWizard) |
| `08-recurrentes.png` | Recurrentes | **EmptyState** "registra lo que se repite" · enlace a Suscripciones |
| `09-tendencias.png` | Tendencias | **Coach-mark** drill-down de categorías |
| `10-puedo-pagar.png` | ¿Debería comprar esto? | capacidad **oculta** — exponer en nav + discovery rail (hoy mal enlazada) |
| `11-destinatarios.png` | Destinatarios | **EmptyState** "crea una regla, Zeta categoriza siempre" · disclosure "Avanzado" |
| `12-deseos.png` | Deseos | **EmptyState inline** en ítem sin enriquecer (score oculto) |
| `13-deudas-personales.png` | Deudas personales (IOU) | capacidad **oculta** — diferenciar de deudas de banco |
| `14-settings.png` | Ajustes | descubrir capacidades ocultas (correo, Telegram, MCP, contraseñas PDF) |
| `15-suscripciones.png` | Suscripciones (ruta huérfana) | agregar entrada de nav · sugerencias auto-detectadas |
| `16-categorizar.png` | Categorizar (755 sin categoría) | contexto de auto-categorización + reglas de destinatario |

## `concepto/` — dirección propuesta
- `00-mapa-capacidades.png` — captura del mockup conceptual (pestaña Mapa de capacidades).
- **`../../guided-experience-mockup.html`** (servido en `localhost:4555`) — mockup interactivo: Mapa · Onboarding→Home · Patrones · Rampas. **Ábrelo — mejor insumo de concepto.**
- **`../../ds-guided/preview/*.html`** — 5 previews on-brand construidos con tu DS real (chooser, primeros-pasos, empty-state, info-hint, coach-marks). Sirven en `localhost:4555/ds-guided/preview/`.
