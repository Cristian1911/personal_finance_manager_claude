# Prompt para Claude Design — Experiencia guiada de Zeta

> Pega este prompt en Claude Design. Ya tiene el design system de Zeta integrado (tokens, componentes, brand). Los insumos extra están en esta carpeta.

---

## Prompt

Diseña la **experiencia guiada de Zeta** — el sistema que resuelve la fricción #1 de la app: **los usuarios no saben qué puede hacer ni por dónde empezar.**

Ya tienes integrado el design system de Zeta (tokens brass/dark, componentes shadcn/ui, brand). Usa estos insumos adjuntos:
- `01-objetivos.md` — objetivos, valor central, restricciones, entregables y métricas de éxito.
- `02-funcionalidades.md` — mapa de capacidades, qué tan escondida está cada una, la **matriz de activación** (qué dato vuelve cada pantalla "real"), el **set mínimo viable de datos**, y las **4 rampas de entrada** a diseñar.
- `03-pantallazos/actual/` — capturas del estado ACTUAL de la app (sobre estas pantallas se ancla la guía).
- `03-pantallazos/concepto/` + `guided-experience-mockup.html` — mi mockup conceptual interactivo (dirección propuesta; ábrelo para ver el sistema en contexto).
- `04-brief-estrategia.md` — estrategia completa + matriz de ubicación de cada mecanismo de guía.

### Principio rector
**"El tutorial es la pantalla misma."** Sin tour modal. Guía contextual, en sitio, descartable. Cada pieza vive donde vive la capacidad. Cada pantalla debe responder **"¿voy bien?"** sin explicación.

### Diseña estos entregables (mobile-first, español, Variant A / Safe)

1. **Pantalla "¿Cómo quieres empezar?"** — el chooser que reemplaza el paso de estimados del onboarding. 3 cards de camino (A · Sube tus extractos ⭐ recomendado · B · Crea tus cuentas y saldo · C · Tengo claro mi presupuesto) + link fallback "No estoy seguro — explorar primero". Cada card: ícono, título, qué pide, etiqueta esfuerzo+valor. Acento brass solo en el recomendado. Ver `02-funcionalidades.md` Parte 4.

2. **Tarjeta "Primeros pasos"** (Home) — checklist persistente sembrado por camino + meta, que sobrevive al primer movimiento. Estados: colapsada/expandida, ítems tachados con progreso (N de total), descarte/snooze. Variantes por meta (salir de deudas / ahorrar / entender gastos) y por camino elegido.

3. **Patrón `EmptyState`** (primitivo nuevo) — estructura: ícono, título de valor, subtítulo "¿qué hago primero?", CTA(s). Muestra las 6 aplicaciones: Periodo, Recurrentes, Deudas, Deseos, Destinatarios, zero-transacciones (con copy de `02-funcionalidades.md` / `04-brief-estrategia.md`).

4. **Patrón `InfoHint "?"`** (primitivo nuevo) — disparador "?" → popover (tap) / tooltip (hover). Aplícalo a: hero "disponible por día" (+ nudge si falta ingreso), health meters, "Modo" de presupuesto, 50/30/20, moneda/campos de tarjeta en cuentas, "Patrimonio".

5. **3 coach-marks** (una sola vez, sin overlay pesado): FAB (voz/pantallazo/texto), drill-down de Tendencias, paso de conciliación del import.

6. **Estados de honestidad** — cómo se ve el gauge de salud y el pill del hero cuando faltan datos (mostrar "Sin datos suficientes" en vez de un veredicto sintético verde/~50).

### Restricciones
- Español primero · mobile-first · tokens del design system (sin colores hardcodeados) · botones BRASS/GHOST · focus mode en onboarding (tab bar oculta, header con back).
- Velocidad > animaciones. Reusar componentes existentes; construir solo los 2 primitivos nuevos. No inventar motor de tour ni centro de ayuda.
- Honestidad: nunca un veredicto antes de tener datos que lo respalden.

### Formato de salida
Para cada entregable: pantalla/componente en alta fidelidad + variantes de estado + el copy en español exacto. Señala qué reusa del design system y qué es nuevo. Prioriza Fase 1 (chooser + Primeros pasos + EmptyState) que es el de mayor impacto.
