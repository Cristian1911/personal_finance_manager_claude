# 01 · Objetivos de la experiencia guiada

## Problema (fricción #1)
Los usuarios **no saben qué puede hacer la app ni por dónde empezar.** Las capacidades más diferenciadoras son las más escondidas; el onboarding entrega *datos estimados* sin construir un modelo mental y suelta al usuario en un tablero silencioso.

## Valor central (no negociable)
**Cada pantalla responde "¿voy bien?" sin necesidad de explicación.** La data existe — falta presentarla con jerarquía, propósito y los hooks de guía correctos.

## Objetivos del diseño

1. **Matar el "¿por dónde empiezo?"** con una pantalla de elección de camino ("¿Cómo quieres empezar?") que reemplaza el paso de estimados. El usuario elige el on-ramp más fácil para él; todos convergen al mismo set mínimo de datos.
2. **Llegar rápido a números reales, no estimados.** Priorizar el camino de import (1 acción enciende 5+ superficies). El onboarding debe terminar con el tablero respondiendo "¿voy bien?" con verdad, no con cifras inventadas.
3. **Enseñar amplitud sin tour.** *"El tutorial es la pantalla misma":* guía contextual, en sitio, descartable. La tarjeta "Primeros pasos" persiste en Home (hoy desaparece al primer movimiento) y revela las capacidades ocultas gradualmente.
4. **Honestidad por encima de completitud.** Nunca mostrar veredictos sintéticos: ni el pill verde "Vas bien" con 0 gasto, ni el gauge de salud ~50 "Atento" en cuenta nueva. Si no hay datos, decir "Sin datos suficientes".
5. **Cohesión onboarding ↔ app.** La meta y el camino elegidos siembran el `nav_focus`, el checklist y el primer CTA — un hilo continuo, no un corte seco.
6. **Reusar, no inflar.** Aprovechar el design system y los primitivos existentes. Construir solo **2 nuevos**: `EmptyState` e `InfoHint`. NO construir motor de tour, centro de ayuda, ni framework de coach-marks.

## Restricciones
- **Idioma:** español primero (todo el copy de UI en español).
- **Alcance:** webapp mobile-first (fuente de verdad del diseño; el móvil RN la espeja después).
- **Variante:** seguir Variant A (Safe) del design system salvo indicación contraria.
- **Velocidad > animaciones.** Updates optimistas. Sin librerías pesadas.
- **Tokens:** sin colores hardcodeados — usar tokens (`text-z-brass`, `bg-z-surface-2`, `border-white/6`, etc.).
- **Botones:** solo variantes BRASS / GHOST existentes.
- **Focus mode** en onboarding y formularios (tab bar oculta) con header `variant="sub"` + back.

## Entregables que pedimos a Claude Design
1. **Pantalla "¿Cómo quieres empezar?"** (chooser de 3 caminos + fallback "explorar"). Ver `02-funcionalidades.md` Parte 4.
2. **Tarjeta "Primeros pasos"** (checklist sembrado por camino+meta, con estados: colapsada/expandida, ítems tachados, descarte).
3. **Patrón `EmptyState`** con las 6 reescrituras (Periodo, Recurrentes, Deudas, Deseos, Destinatarios, zero-tx).
4. **Patrón `InfoHint "?"`** aplicado a los números/jerga clave (hero, health meters, Modo, 50/30/20, moneda/CC, Patrimonio).
5. **3 coach-marks** (FAB, drill-down de Tendencias, conciliación) — una sola vez, sin overlay pesado.
6. **Estados de honestidad** para el gauge de salud y el pill del hero cuando faltan datos.

## Cómo medir éxito
- Un usuario nuevo llega a un tablero con **números reales** en < 2 min.
- Desde Home + nav, ninguna capacidad "wow" queda invisible (¿Puedo pagarlo?, Tendencias drill-down, import por voz/correo, deudas personales).
- Cero veredictos falsos antes de tener datos que los respalden.
