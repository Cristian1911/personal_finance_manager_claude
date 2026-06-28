# 02 · Funcionalidades — qué hace Zeta y qué dato la enciende

> Insumo para Claude Design. Define las capacidades, qué tan escondidas están, el **dato mínimo** que vuelve cada pantalla "real", y las **rampas de entrada** a diseñar.
> Fuente: auditoría multi-agente leyendo el código real (`wf_84fcc03e`, `wf_ce98c057`).

---

## Parte 1 · Mapa de capacidades (por trabajo del usuario)

Color = qué tan fácil la descubre un usuario nuevo. 🟢 Obvio · 🟡 Encontrable · 🔴 Oculto.

**Capturar** — 🟢 registro manual · 🟡 importar PDF/pantallazo · 🟡 captura rápida (texto) · 🔴 voz · 🔴 Telegram · 🔴 correo reenviado · 🔴 tokens IA/MCP
**Entender** — 🟢 hero "disponible por día" · 🟡 Tendencias · 🔴 drill-down de categorías · 🔴 lente "¿Cambios?" · 🟡 health score · 🟡 heatmap
**Planear** — 🟢 Plan (hub) · 🟡 presupuesto + 50/30/20 · 🔴 Periodo (sobres) · 🟡 planificador de deudas · 🟡 recurrentes · 🔴 suscripciones (huérfana)
**Decidir** — 🟡 Deseos/Wishlist · 🔴 ¿Puedo pagarlo? (el "wow", fuera de nav)
**Configurar** — 🟡 cuentas + patrimonio · 🔴 perfil/moneda/salario · 🔴 deudas personales · 🔴 automatización de destinatarios · 🔴 etiquetas/Ritmo YNAB

**Núcleo Oculto** (epicentro de fricción, lo más diferenciador + peor entrada): voz · Telegram · MCP · correo · Periodo · **¿Puedo pagarlo?** · suscripciones · drill-down + ¿Cambios? · deudas personales · reglas de destinatario · Ritmo YNAB.

→ Detalle completo + matriz de ubicación de guía: `04-brief-estrategia.md`.

---

## Parte 2 · Matriz de activación (qué dato vuelve cada pantalla "real")

Ordenada de activación más barata a más cara. "Si falta" = vacío / estimado / oculto / degradado.

| Capacidad | Dato mínimo para ser **real** | Si falta |
|---|---|---|
| Overview de deudas renderiza | 1 cuenta CC/LOAN activa (sin saldo ni tasa) | vacío |
| Accounts overview / Patrimonio (valor actual) | 1 cuenta activa con `current_balance` | oculto |
| ¿Puedo pagarlo? formulario | 1 cuenta activa no-LOAN | vacío |
| Tendencias renderiza | 1 cuenta activa | vacío |
| **Hero "disponible por día"** | **1 cuenta líquida con `current_balance≠0`. SIN ingreso, tx ni presupuesto** | degradado ($0/día) |
| **Plan "margen actual"** | misma cuenta líquida con saldo | degradado ($0) |
| ¿Puedo pagarlo? veredicto liquidez | `current_balance` en 1 cuenta no-deuda | degradado (sin colchón) |
| Deuda total / planificador corre | 1 cuenta de deuda con `balance>0` | vacío |
| Utilización de crédito | CC con `credit_limit>0` + saldo | oculto |
| 50/30/20 (referencia) | 1 número de ingreso (estimado basta) | oculto |
| Health meters GASTO/DEUDA | `income>0` + OUTFLOW del mes / snapshots | oculto ("Sin datos") |
| **Hero veredicto** (Vas bien/justo/Te pasaste) + gasto de hoy + calendario | OUTFLOW **reales** del mes + `available>0` | degradado (pill "Vas bien" FALSO-POSITIVO) |
| Vista real de Budget (no wizard) | `budget_mode≠NULL` (solo lo escribe Finalizar wizard) | degradado (wizard 3 pasos) |
| Límites por categoría + progreso | ≥1 fila `budgets` con `amount>0` | zero (0%/$0) |
| Interés / "más cara" / avalancha real | `interest_rate` válida (10-150% EA) + `balance>0` | oculto ("Sin tasa") |
| Cuenta regresiva libre-de-deudas | `monthly_payment` o snapshot `minimum_payment` (NO usa fallback 5%) | oculto |
| Salary bar | `income>0` **Y** ≥1 deuda con saldo | oculto |
| Tendencias MoM/Movers + histórico Patrimonio | gasto en misma categoría ≥2 meses consecutivos / ≥2 puntos | oculto |
| Tendencias Anomalías | ≥3 meses de historial de categoría | oculto |
| Sparkline por cuenta | filas `statement_snapshots` (solo las crea import, NO entrada manual) | vacío |
| Deseos — score por ítem | ítem `enriched` + urgencia + funding + cuenta | oculto (solo monto) |
| Recurrentes (obligaciones) | plantilla MANUAL (import NO crea no-deuda) | vacío |
| Periodo (sobres) | fila `planning_periods` activa + entradas (seed necesita plantillas) | vacío |

**Dos trampas de honestidad** (la app *parece* saber más de lo que sabe):
1. **Gauge de salud** muestra ~50 "Atento" sintético en cuenta nueva (COLCHÓN→99 meses sin gastos fijos, AHORRO→0). Debe **ocultarse / marcarse "Sin datos suficientes"** hasta tener ingreso + tx.
2. **Pill del hero** "Vas bien" es falso-positivo con `spentToday=0`. Sin OUTFLOW reales el veredicto no es confiable.

---

## Parte 3 · El Set Mínimo Viable (el piso)

**Piso** para que "¿voy bien?" sea respondible con números **reales, no estimados**:

- **F1 — 1 cuenta líquida con `current_balance` real** → enciende hero "disponible por día", Plan margen, ¿Puedo pagarlo?, Patrimonio. *(No necesita ingreso, tx ni presupuesto.)*
- **F2 — 1 número de ingreso** (`estimated_monthly_income` o detectado) → health meters, 50/30/20, barra salario, ingreso base.
- **F3 — transacciones del mes en curso** → veredicto del hero, AHORRO/GASTO, overlay 50/30/20. *(Sin F3, los veredictos son sintéticos — ver trampas.)*
- **F4 — historial ≥2-3 meses** → Tendencias MoM/Movers/Anomalías, histórico de Patrimonio, sparklines.

**Piso honesto = F1 + (F3 o 1 extracto).** El balance da el número; las transacciones convierten el veredicto de sintético a real.

| Tier | Datos | Desbloquea |
|---|---|---|
| **Piso** | F1 | runway de caja real (hero, margen, afford, patrimonio) |
| **Usable** | F1 + F2 | health meters reales, presupuesto 50/30/20, salary bar, ingreso base |
| **Pleno** | + F3 + F4 + tasa/pago en deudas | veredictos reales, Tendencias completa, sparklines, avalancha real, countdown |

---

## Parte 4 · Rampas de entrada ("¿Por dónde empiezo?") — A DISEÑAR

Cuatro caminos. Distinto compromiso esfuerzo ↔ verdad real encendida. Todos convergen al piso.

### A · "Sube tus extractos" (import PDF) — ⭐ recomendado por defecto
- **Pitch:** *"Sube el PDF de tu banco o tarjeta. En un toque tendrás cuentas, movimientos y deudas — sin escribir nada."*
- **Pide:** 1 PDF. El wizard mapea a cuenta o la crea. Cero escritura manual.
- **Enciende ya (1 sola acción):** cuentas con saldo + `credit_limit` + `interest_rate` + `payment_day`; transacciones reales; `statement_snapshots` (→ sparklines, progreso deuda, countdown); plantilla de pago de deuda auto-creada; hero, margen, patrimonio, afford reales. Con ≥2-3 meses: Tendencias MoM/Anomalías + histórico.
- **Queda bloqueado:** presupuesto (`budget_mode` NULL) → nudge *"define límites en 1 min"*; obligaciones no-deuda → nudge *"confirma suscripciones detectadas"*.
- **Esfuerzo:** 30-60 s. **Único on-ramp tier-1.**

### B · "Crea tus cuentas y saldo" (manual)
- **Pitch:** *"¿Sin extractos a mano? Dinos qué cuentas tienes y cuánto hay en cada una. Suficiente para saber si vas bien hoy."*
- **Pide:** por cuenta `name` + `type` + `current_balance` (req.; moneda default COP). Deuda útil: + `interest_rate` + `monthly_payment`.
- **Enciende ya:** todo el runway de caja (hero, margen, afford liquidez, patrimonio), deuda overview + utilización + planificador.
- **Bloqueado:** sparklines/histórico (necesitan snapshots → *"sube un extracto"*); avalancha real/"más cara" (necesitan tasa → *"agrega el APR"*); countdown (necesita pago → *"dinos tu pago mensual"*); veredicto del hero/AHORRO/GASTO (necesitan tx).
- **Esfuerzo:** 1-2 min/cuenta. **Segundo mejor.**

### C · "Tengo claro mi presupuesto" (income → 50/30/20)
- **Pitch:** *"¿Ya sabes cuánto entra y en qué se va? Arma tu plan 50/30/20 en tres pasos."*
- **Pide:** BudgetWizard 3 pasos (income pre-llenado si onboarding lo capturó; 50/30/20 auto-derivado).
- **Enciende ya:** vista de presupuesto real, 50/30/20, health meters income-gated, presión del Plan.
- **Bloqueado:** % gastado / restante / overlay 50/30/20 ACTUAL (necesitan tx); **saldos** (sin A/B el hero = $0). **No ofrecer solo** — siempre complemento de A/B.
- **Esfuerzo:** 1-2 min.

### D · "Aún no sé / explorar" (skip, fallback)
- **Pide:** nada. Crea cuenta placeholder $0. Todo vacío/estimado.
- **Nudge:** checklist "Primeros pasos" con Camino A como primer ítem.

### Ranking valor-por-esfuerzo
| # | Camino | Esfuerzo | Superficies reales |
|---|---|---|---|
| 1 | **A · Extractos** | 30-60 s | 5+ (cuentas, ledger, snapshots, deuda, recurrentes) |
| 2 | **B · Cuentas+saldo** | 1-2 min/cuenta | runway, patrimonio, afford, deuda |
| 3 | **C · Presupuesto** | 1-2 min | budget, 50/30/20, health meters |
| 4 | **D · Skip** | 0 s | nada |

### Convergencia
| Camino | Satisface | Pendiente | Prompt de cierre |
|---|---|---|---|
| A | F1, F2, F3 (+F4 si ≥2-3 meses) | presupuesto | *"Define tu presupuesto en 1 min"* |
| B | F1 | F2, F3, F4 | *"Confirma tu ingreso"* → *"Sube un extracto: enciende tu historial"* |
| C | F2 | F1, F3, F4 | *"Conecta tus cuentas para ver tu saldo real"* |
| D | — | F1-F4 | checklist completo |

**Regla:** el checklist "Primeros pasos" persiste hasta tener **F1 + (F2 o F3)** — el umbral para que "¿voy bien?" no dé falsos positivos.

---

## Parte 5 · Mecanismos de guía (qué diseñar, dónde)

Sin tour modal. *"El tutorial es la pantalla misma."* Reusar design system; construir solo 2 primitivos.

1. **EmptyState contextual** (primitivo nuevo) — responde "¿qué me da esto?" + "¿qué hago primero?". Reemplaza ~40 vacíos. Pantallas: Periodo, Recurrentes, Deudas, Deseos, Destinatarios, zero-tx.
2. **InfoHint "?"** (primitivo nuevo) — solo en jerga/números que el usuario debe creer. Pantallas: hero "disponible por día", health meters, Modo de presupuesto, 50/30/20, moneda/CC en cuentas, Patrimonio.
3. **Checklist "Primeros pasos"** (reusa discovery-rail + DashboardAlerts) — puente onboarding↔home, sembrado por camino + meta, persiste pasado el primer movimiento.
4. **3 coach-marks** (solo invisibles): FAB (voz/pantallazo), drill-down de Tendencias, paso de conciliación.
5. **Progressive disclosure**: import auto-salta pasos sin decisiones; destinatarios "Avanzado"; correo "Opciones avanzadas".
6. **Estados de honestidad**: ocultar gauge / marcar "Sin datos suficientes" hasta F2+F3; no pill verde falso.
